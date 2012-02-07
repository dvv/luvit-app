--
-- ReST resource routing
--

local Table = require('table')
local parse_url = require('url').parse
local urldecode = require('querystring').urldecode
local JSON = require('json')

return function (options)

  -- defaults
  if options == nil then options = { } end
  -- whether PUT /Foo/_new means POST /Foo
  -- useful to free POST verb for pure PRC calls
  local brand_new_id = options.put_new and options.put_new or { }

  --
  -- handler
  --
  return function (req, res, nxt)

    -- split pathname into resource name and id
    -- TODO: support deeper resources
    local resource = nil
    local id = nil
    req.uri.pathname:gsub('[^/]+', function (part)
      if not resource then
        resource = urldecode(part)
      elseif not id then
        id = urldecode(part)
      end
    end)

    --
    -- determine handler method and its parameters
    --

    -- N.B. support X-HTTP-Method-Override: to ease ReST for dumb clients
    local verb = req.headers['X-HTTP-Method-Override'] or req.method
    local method = nil
    local params = nil

    -- query
    if verb == 'GET' then
      method = 'get'
      -- get by ID
      if id and id ~= brand_new_id then
        params = { id }
      -- query
      else
        method = 'query'
        -- bulk get via POST X-HTTP-Method-Override: GET
        if req.body[1] then
          params = { req.body }
        -- query by Resource Query Language (kriszyp/rql)
        else
          params = { req.uri.search }
        end
      end

    -- create new / update resource
    elseif verb == 'PUT' then
      method = 'update'
      if id then
        -- add new
        if id == brand_new_id then
          method = 'add'
          params = { req.body }
        -- update by ID
        else
          params = { id, req.body }
        end
      else
        -- bulk update via POST X-HTTP-Method-Override: PUT
        if req.body[1] and req.body[1][1] then
          params = { req.body[1], req.body[2] }
        -- update by RQL
        else
          params = { req.uri.search, req.body }
        end
      end

    -- remove resource
    elseif verb == 'DELETE' then
      method = 'remove'
      if id and id ~= brand_new_id then
        params = { id }
      else
        -- bulk remove via POST X-HTTP-Method-Override: DELETE
        if req.body[1] then
          params = { req.body }
        -- remove by RQL
        else
          params = { req.uri.search }
        end
      end

    -- arbitrary RPC to resource
    elseif verb == 'POST' then
      -- if creation is via PUT, POST is solely for RPC
      -- if `req.body` has truthy `jsonrpc` key -- try RPC
      if options.put_new or req.body.jsonrpc then
        -- RPC
        method = req.body.method
        params = req.body.params
      -- else POST is solely for creation
      else
        -- add
        method = 'add'
        params = { req.body }
      end

    -- unsupported verb
    --else
      -- NYI

    end

    --p('PARSED', resource, method, params)

    -- called after handler finishes
    local function respond(err, result)
      --p('RESP', err, result)
      local response = nil
      -- JSON-RPC response
      if options.jsonrpc or req.body.jsonrpc then
        response = { }
        if err then
          response.error = err
        elseif result == nil then
          response.result = true
        else
          response.result = result
        end
        res:writeHead(200, {
          ['Content-Type'] = 'application/json'
        })
      -- plain response
      else
        if err then
          res:writeHead(type(err) == 'number' and err or 406, { })
        elseif result == nil then
          if method == 'query' then
            res:serve_not_found()
          else
            res:set_code(204)
          end
        else
          response = result
          res:writeHead(200, {
            ['Content-Type'] = 'application/json'
          })
        end
      end
      -- FIXME: why JSON forall?
      if response then
        res:write(JSON.stringify(response))
      end
      res:finish()
    end

    --
    -- find the handler
    --

    -- bail out unless resource is found
    local context = req.context or options.context or { }
    resource = context[resource]
    if not resource then
      return respond(404)
    end
    -- bail out unless resource method is supported
    if not resource[method] then
      return respond(405)
    end

    --
    -- call the handler. signature is fn(params..., nxt), or fn(context, params..., nxt)
    --

    if options.pass_context then
      Table.insert(params, 1, context)
    end
    Table.insert(params, respond)
    --p('RPC?', params)
    resource[method](unpack(params))

  end

end

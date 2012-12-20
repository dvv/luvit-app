local Table = require('table')
local Path = require('path')

local Renderer = require('kernel')

--
-- render named template with `data`.
-- rendering options live in `options`
--

local function render(name, data, callback)
  -- get absolute path of partial
  local filename = name
  if name:sub(1, 1) ~= '/' then
    if Renderer.options.prefix then
      filename = Path.resolve(Renderer.options.prefix, filename)
    end
    if Renderer.options.suffix then
      filename = filename .. Renderer.options.suffix
    end
  end
  -- compile template
  Renderer.compile(filename, function (err, template)
    -- report error
    if err then
      callback(nil, '{{' .. (err.message or err) .. '}}')
    -- execute
    else
      template(data, callback)
    end
  end)
end

--
-- return fallback values for values with can't be stringified
--

Renderer.helpers.X = function (x, name, filename, offset)
  if type(x) == 'function' then
    return '{{' .. name .. ':FUNCTION}}'
  end
  if type(x) == 'table' then
    return '{{' .. name .. ':TABLE}}'
  end
  if x == nil then
    return '{{' .. name .. ':NIL}}'
  end
  return x
end

--
-- render named template using `data`
--

Renderer.helpers.PARTIAL = function (name, locals, callback)
  if not callback then
    callback = locals
    locals = { }
  end
  render(name, locals, callback)
end

--
-- apply `block` if `condition` is truthy
--

Renderer.helpers.IF = function (condition, block, callback)
  if condition then
    block({ }, callback)
  else
    callback(nil, '')
  end
end

--
-- apply `block` for each item in `list`
--

Renderer.helpers.LOOP = function (list, block, callback)
  local left = 1
  local parts = { }
  local done = false
  -- TODO: collect keys from pairs() and ipairs(),
  -- then run over all of them
  for i, value in ipairs(list or {}) do
    left = left + 1
    block(value, function (err, result)
      if done then
        return 
      end
      if err then
        done = true
        return callback(err)
      end
      parts[i] = result
      left = left - 1
      if left == 0 then
        done = true
        return callback(nil, Table.concat(parts))
      end
    end)
  end
  left = left - 1
  if left == 0 and not done then
    done = true
    callback(nil, Table.concat(parts))
  end
end

--
-- escape HTML entities
--

local function escape(str)
  return str:gsub('<', '&lt;'):gsub('>', '&gt;'):gsub('"', '&quot;')
end

Renderer.helpers.ESC = function (value, callback)
  if callback then
    callback(nil, escape(value))
  else
    escape(value)
  end
end

--
-- reusable inline patterns
--

local _defs = { }

Renderer.helpers.DEF = function (name, block, callback)
  _defs[name] = block
  callback(nil, '')
end

Renderer.helpers.USE = function (name, locals, callback)
  if not callback then
    callback = locals
    locals = { }
  end
  _defs[name](locals, callback)
end



--
-- give Response the render method
--
local Response = require('http').Response
function Response:render(filename, data)
  if not data then data = { } end
  -- TODO: this is way bad to use global stuff!
  --options = self.app.options.render or { }
  -- TODO: enclose in render('layout')
  render('layout', data, function (err, layout)
    if err then
      self:fail(err.message or err)
      return
    end
    render(filename, data, function (err, html)
      if err then
        html = err.message or err
      end
      html = layout:gsub('<%%body%%>', html)
      self:send(200, html, {
        ['Content-Type'] = 'text/html; charset=UTF-8',
        ['Content-Length'] = #html
      })
    end)
  end)
end

-- middleware
return function (options)  
  Renderer.options = options or {}
  return function(rq, rs, nxt) nxt() end
end
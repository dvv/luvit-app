local Response = require('http').Response
local Log = require('./log')

Response.auto_server = 'U-Gotta-Luvit'

function Response:send(code, data, headers, close)
  --debug('REQ', self.req.url, code)
  --if code == 500 then p('ERR', data) end
  self:writeHead(code, headers or { })
  if data then self:write(data) end
  if close or close == nil then self:finish() end
end

function Response:fail(reason)
  self:send(500, reason, {
    ['Content-Type'] = 'text/plain; charset=UTF-8',
    ['Content-Length'] = #reason
  })
end

function Response:serve_not_found()
  self:send(404)
end

function Response:serve_not_modified(headers)
  self:send(304, nil, headers)
end

function Response:serve_invalid_range(size)
  self:send(416, nil, {
    ['Content-Range'] = 'bytes=*/' .. size
  })
end

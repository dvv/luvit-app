--
-- keep sessions safely in encrypted and signed cookies.
-- inspired by caolan/cookie-sessions
--

--
-- Parse cookie-based session from Cookie: header
-- into `req.session`.
-- If session is authenticated, fill `req.context` with user capabilities
--

local OS = require('os')
local Crypto = require('_crypto')
local JSON = require('json')

local function sign(secret, data)
  return Crypto.digest.new('sha1'):update(secret):final(data)
end

local function encrypt(secret, data)
  local cipher = Crypto.encrypt.new('aes192', secret)
  local result = cipher:final(data)
  --result = tohex(result)
  return result
end

local function uncrypt(secret, data)
  local cipher = Crypto.decrypt.new('aes192', secret)
  --data = fromhex(data)
  return cipher:final(data)
end

local function expires_in(ttl)
  return OS.date('%c', OS.time() + ttl)
end

local function serialize(secret, obj)
  local str = JSON.stringify(obj)
  local str_enc = encrypt(secret, str)
  local timestamp = OS.time()
  local hmac_sig = sign(secret, timestamp .. str_enc)
  local result = hmac_sig .. timestamp .. str_enc
  return result
end

local function deserialize(secret, ttl, str)
  local hmac_signature = str:sub(1, 40)
  local timestamp = tonumber(str:sub(41, 50), 10)
  local data = str:sub(51)
  local hmac_sig = sign(secret, timestamp .. data)
  if hmac_signature ~= hmac_sig or timestamp + ttl <= OS.time() then
    return nil
  end
  data = uncrypt(secret, data)
  data = JSON.parse(data)
  if data == JSON.null then data = nil end
  return data
end

local function read_session(key, secret, ttl, req)
  local cookie = type(req) == 'string' and req or req.headers.cookie
  if cookie then
    cookie = cookie:match('%s*;*%s*' .. key .. '=(%w*)')
    if cookie and cookie ~= '' then
      return deserialize(secret, ttl, cookie)
    end
  end
end

return function (options)

  -- defaults
  if options == nil then options = { } end
  local key = options.key or 'sid'
  local ttl = options.ttl or 15 * 24 * 60 * 60 * 1000
  local secret = options.secret
  local context = options.context or { }

  --
  -- handler
  --
  return function (req, res, nxt)

    -- read session data from request and store it in req.session
    req.session = read_session(key, secret, ttl, req)

    -- patch response to support writing cookies
    -- TODO: is there a lighter method?
    local _writeHead = res.writeHead
    res.writeHead = function (self, code, headers, callback)
      local cookie = nil
      if not req.session then
        if req.headers.cookie then
          cookie = ('%s=;expires=%s;httponly;path=/'):format(key, expires_in(0))
        end
      else
        cookie = ('%s=%s;expires=%s;httponly;path=/'):format(key, serialize(secret, req.session), expires_in(ttl))
      end
      -- Set-Cookie
      if cookie then
        self:addHeader('Set-Cookie', cookie)
      end
      _writeHead(self, code, headers, callback)
    end

    -- always create a session if options.default_session specified
    if options.default_session and not req.session then
      req.session = options.default_session
    end

    -- use authorization callback if specified
    if options.authorize then
      -- given current session, setup request context
      options.authorize(req.session, function (context)
        req.context = context or { }
        nxt()
      end)
    -- assign static request context
    else
      -- default is guest request context
      req.context = context.guest or { }
      -- user authenticated?
      if req.session and req.session.uid and context.user then
        -- provide user request context
        req.context = context.user
      end
      nxt()
    end

  end

end

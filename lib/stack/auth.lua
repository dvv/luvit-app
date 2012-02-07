--
-- Handle signin/signout
--

local Curl = require('curl')
local Crypto = require('crypto')

--
-- openid brokers
--

local openid_brokers = {

  -- loginza -- a set of openid providers popular in Russian Federation
  ['http://loginza.ru/api/redirect?'] = {
    get_url = function (token)
      return 'http://loginza.ru/api/authinfo?token=' .. token
    end,
    collect_data = function (data)
      if not data or not data.identity then
        return nil
      end
      local uid = Crypto.sha1(data.identity)
      -- twitter
      if data.provider == 'http://twitter.com/' then
        data = {
          uid = uid,
          name = data.name and data.name.full_name or data.email,
          email = data.email,
          photo = data.photo
        }
      -- google
      elseif data.provider == 'https://www.google.com/accounts/o8/ud' then
        data = {
          uid = uid,
          name = data.name and data.name.full_name or data.email,
          email = data.email,
          photo = data.photo
        }
      -- vkontakte.ru
      elseif data.provider == 'http://vkontakte.ru/' then
        data = {
          uid = uid,
          name = data.name and (data.name.first_name .. ' ' .. data.name.last_name) or data.email,
          email = data.email,
          photo = data.photo
        }
      -- other providers. try to guess
      else
        data = {
          uid = uid,
          name = data.name and data.name.full_name or data.name,
          email = data.email,
          photo = data.photo
        }
      end
      return data
    end
  }
}

-- module
return function (options)

  -- defaults
  if options == nil then options = { } end
  local openid = options.openid
  if openid == true then
    openid = openid_brokers
  end

  --
  -- handler
  --
  return function (req, res, nxt)

    -- openid broker
    -- TODO: generalize and extract into own module?
    if openid and req.body.token and req.method == 'POST' then

      -- authenticate against an openid provider
      local referrer = req.headers.referer or req.headers.referrer
      for provider_url, provider in pairs(openid) do
        -- provider matched?
        if referrer:find(provider_url) == 1 then
          -- issue authentication request
          local params = {
            url = provider.get_url(req.body.token)
          }
          -- FIXME: doesn't work!
          Curl.get(params, function (err, data)
            p('GOT', data)
            -- collect profile data from openid provider response
            local profile = nil
            if data then
              profile = provider.collect_data(data)
            end
            p('PROFILE', profile)
            -- given profile authenticated by an openid provider, request new session
            options.authenticate(nil, profile, function (session)
              -- falsy session means to remove current session
              req.session = session
              -- go back to root
              res:send(302, nil, {
                ['Location'] = '/'
              })
            end)
          end)
          break
        end
      end
      return 
    end

    -- native signin/signout
    -- given current session and request body, request new session
    options.authenticate(req.session, req.body, function (session)
      -- falsy session means to remove current session
      req.session = session
      -- go back
      res:send(302, nil, {
        ['Location'] = req.headers.referer or req.headers.referrer or '/'
      })
    end)

  end

end

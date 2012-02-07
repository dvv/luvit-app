Server
=====

A collection of middleware and helpers to run Web servers under Luvit.

Usage
-----

```lua
-- create application
local app = require('app').new()

local function authorize(session, callback)
  -- user authenticated
  if session and session.uid then
    callback({
      uid = session.uid,
      foo = {
        -- GET /foo?a=b --> foo.query('a=b', ...) --> 200 { "you are": "an authorized user!" }
        query = function (query, cb)
          cb(nil, { ['you are'] = 'an authorized user!' })
        end,
        -- DELETE /foo/1 --> foo.remove('1', ...) --> 204
        remove = function (query, cb)
          cb(nil)
        end
      }
    })
  -- guest
  else
    callback({
      foo = {
        query = function (query, cb)
          cb(nil, { ['you are'] = 'a guest!' })
        end
      }
    })
  end
end

-- tune options
app:set({
-- ... options ...
})

-- handle cookie session and request context
app:use('session', {
  secret = 'topsecret',
  authorize = authorize,
})

-- serve chrome page
app:GET('/$', function (self, nxt)
  self:render('index', {foo = 'bar'})
end)

-- custom route
app:GET('/foo$', function (self, nxt)
  self:send(200, 'FOO')
end)

-- run server
app:run(8080, '0.0.0.0')
```

License
-------

[MIT](dvv/luvit-app/license.txt)

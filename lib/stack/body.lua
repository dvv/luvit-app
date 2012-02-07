--
-- parse request body into `req.body`
--

return function (options)

  if not options then options = { } end
  local parse_request = require('curl').parse_request

  return function (req, res, nxt)
    parse_request(req, function (err, data)
      req.body = data
      nxt()
    end)
  end

end

--
-- Listen to specified URL and respond with status 200
-- to signify this server is alive
--
-- Use to notify upstream haproxy load-balancer
--

return function ()

  return function (req, res, nxt)
    res:send(200, nil, { })
  end

end

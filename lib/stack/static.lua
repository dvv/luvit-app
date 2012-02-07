--
-- static file server
--

return function (options)
  return require('static')(options.mount, options)
end

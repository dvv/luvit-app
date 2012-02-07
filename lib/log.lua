--
-- logger
--

local Utils = require('utils')

local function log(level, fmt, ...)
  -- choose color
  -- FIXME: inhibit unless in TTY
  local color = 'white'
  if     level == 'info' then color = 'Bblack'
  elseif level == 'debug' then color = 'yellow'
  elseif level == 'error' then color = 'red'
  end
  -- check if we want `print` or `p`, or `debug`
  -- `fmt` contains '%'?
  if fmt:find('%%') then
    -- use string.format
    print(Utils.colorize(color, fmt:format(...)))
  elseif level == 'debug' then
    print(Utils.colorize(color, fmt))
    debug(...)
  else
    print(Utils.colorize(color, fmt))
    p(...)
  end
end

local function info(fmt, ...)
  log('info', fmt, ...)
end

local function debug(fmt, ...)
  if process.env.DEBUG == '1' then
    log('debug', fmt, ...)
  end
end

-- module
return {
  log = log,
  info = info,
  debug = debug,
}

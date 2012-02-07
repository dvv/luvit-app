local Request = require('http').Request

--
-- parse Cookie: header into table
--
function Request:parse_cookies()
  self.cookies = { }
  if self.headers.cookie then
    for cookie in self.headers.cookie:gmatch('[^;]+') do
      local name, value = cookie:match('%s*([^=%s]-)%s*=%s*([^%s]*)')
      if name and value then
        self.cookies[name] = value
      end
    end
  end
end

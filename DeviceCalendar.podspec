require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-device-calendar"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "11.0" }
  s.source       = { :git => "https://github.com/pslabs-creativedev/react-native-device-calendar.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"
  
  s.framework = "EventKit"
end

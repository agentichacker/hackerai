Pod::Spec.new do |s|
  s.name = 'HackerAIVoiceTranscription'
  s.version = '1.0.0'
  s.summary = 'Local recording conversion for HackerAI dictation.'
  s.author = 'HackerAI'
  s.homepage = 'https://hackerai.com'
  s.platform = :ios, '18.0'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
  s.frameworks = 'AudioToolbox'
end

require 'xcodeproj'
pth='ios/App/App.xcodeproj'
prj=Xcodeproj::Project.open(pth)
t=prj.targets.find{|target| target.name=='App'}
raise 'Missing App target' unless t
base=prj.main_group.find_subpath('App',true)
file=base.files.find{|f| f.path=='PrivacyInfo.xcprivacy'} || base.new_file('PrivacyInfo.xcprivacy')
t.build_configurations.each do |bc|
  bc.build_settings['CURRENT_PROJECT_VERSION'] = ENV.fetch('PROJECT_BUILD_NUMBER', '1')
  bc.build_settings['MARKETING_VERSION'] = '1.0.0'
end
phase=t.resources_build_phase
phase.add_file_reference(file,true) unless phase.files_references.include?(file)
prj.save
puts 'App Privacy Manifest included as an Xcode resource.'

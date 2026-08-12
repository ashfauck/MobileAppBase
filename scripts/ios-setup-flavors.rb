#!/usr/bin/env ruby
# frozen_string_literal: true

#
# Creates the per-environment Xcode build configurations and shared schemes.
#
#   Configurations : Debug-Dev, Release-Dev, Debug-Staging, Release-Staging,
#                    Debug-Prod, Release-Prod
#   Schemes        : MobileAppBase-Dev, MobileAppBase-Staging, MobileAppBase
#
# Each configuration's base xcconfig is ios/Config/<Configuration>.xcconfig,
# generated from app.identity.json by scripts/apply-app-identity.js. Those files
# `#include?` the matching CocoaPods xcconfig, so Pods settings still apply.
#
# Idempotent — safe to re-run after `pod install` or an RN upgrade.
#
# Usage: bundle exec ruby scripts/ios-setup-flavors.rb
#
require 'xcodeproj'
require 'json'

ROOT = File.expand_path('..', __dir__)
identity = JSON.parse(File.read(File.join(ROOT, 'app.identity.json')))
project_name = identity['projectName']
environments = identity['environments']

project_path = File.join(ROOT, 'ios', "#{project_name}.xcodeproj")
abort("✗ Not found: #{project_path}") unless Dir.exist?(project_path)

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |t| t.name == project_name }
abort("✗ No target named #{project_name}") unless app_target

BUILD_TYPES = %w[Debug Release].freeze
# 'dev' => 'Dev'
ENV_SUFFIXES = environments.keys.to_h { |k| [k, k.capitalize] }

# ---------------------------------------------------------------- xcconfig ---
# Reference ios/Config/*.xcconfig from the project so configurations can use them.
config_group = project.main_group['Config'] ||
               project.main_group.new_group('Config', 'Config', '<group>')

def xcconfig_ref(project, group, filename)
  existing = group.files.find { |f| f.path == filename }
  return existing if existing

  group.new_reference(filename).tap do |ref|
    ref.last_known_file_type = 'text.xcconfig'
  end
end

# ----------------------------------------------------------- configurations ---
def clone_configuration(list, source_name, new_name)
  existing = list.build_configurations.find { |c| c.name == new_name }
  return existing if existing

  source = list.build_configurations.find { |c| c.name == source_name }
  raise "Missing source configuration #{source_name}" unless source

  new_config = list.project.new(Xcodeproj::Project::Object::XCBuildConfiguration)
  new_config.name = new_name
  new_config.build_settings = Marshal.load(Marshal.dump(source.build_settings))
  list.build_configurations << new_config
  new_config
end

created = []

environments.each_key do |env_key|
  suffix = ENV_SUFFIXES[env_key]

  BUILD_TYPES.each do |build_type|
    config_name = "#{build_type}-#{suffix}"

    # Project level
    clone_configuration(project.build_configuration_list, build_type, config_name)

    # Every target (app, and any future test/extension targets)
    project.targets.each do |target|
      config = clone_configuration(target.build_configuration_list, build_type, config_name)

      next unless target == app_target

      ref = xcconfig_ref(project, config_group, "#{config_name}.xcconfig")
      config.base_configuration_reference = ref

      # Flavor-agnostic: the literal values live in the xcconfig.
      config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = '$(APP_BUNDLE_ID)'
      config.build_settings['PRODUCT_NAME'] = project_name
      config.build_settings['MARKETING_VERSION'] ||= '1.0.0'
      config.build_settings['CURRENT_PROJECT_VERSION'] ||= '1'

      # Signing: Automatic locally; CI overrides via xcodebuild flags / Fastlane match.
      config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
      if ENV['DEVELOPMENT_TEAM'] && !ENV['DEVELOPMENT_TEAM'].empty?
        config.build_settings['DEVELOPMENT_TEAM'] = ENV['DEVELOPMENT_TEAM']
      end
    end

    created << config_name
  end
end

# Drop the stock Debug/Release now that every flavor has its own pair.
# CocoaPods requires each project configuration to be mapped in the Podfile,
# and leaving unmapped strays around is a common source of pod install warnings.
[project.build_configuration_list, *project.targets.map(&:build_configuration_list)].each do |list|
  list.build_configurations.delete_if { |c| BUILD_TYPES.include?(c.name) }
end

# ----------------------------------------------------------------- schemes ---
schemes_dir = File.join(project_path, 'xcshareddata', 'xcschemes')
FileUtils.mkdir_p(schemes_dir)

# Remove the stock scheme; it points at the deleted Debug/Release configs.
stock_scheme = File.join(schemes_dir, "#{project_name}.xcscheme")
File.delete(stock_scheme) if File.exist?(stock_scheme)

environments.each do |env_key, env_config|
  suffix = ENV_SUFFIXES[env_key]
  scheme_name = env_config['iosScheme']

  scheme = Xcodeproj::XCScheme.new
  scheme.add_build_target(app_target)
  scheme.set_launch_target(app_target)

  scheme.build_action.parallelize_buildables = true
  scheme.build_action.build_implicit_dependencies = true

  scheme.launch_action.build_configuration   = "Debug-#{suffix}"
  scheme.test_action.build_configuration     = "Debug-#{suffix}"
  scheme.analyze_action.build_configuration  = "Debug-#{suffix}"
  scheme.profile_action.build_configuration  = "Release-#{suffix}"
  scheme.archive_action.build_configuration  = "Release-#{suffix}"
  scheme.archive_action.reveal_archive_in_organizer = false

  scheme.save_as(project_path, scheme_name, true) # true => shared (committed to git)
end

# ------------------------------------------------- Firebase config phase ---
# Copies the right GoogleService-Info.plist into the .app based on the
# APP_ENVIRONMENT defined by each xcconfig. Must run after Copy Bundle
# Resources, which is why it is appended last.
FIREBASE_PHASE_NAME = '[App] Copy Firebase config'

unless app_target.shell_script_build_phases.any? { |p| p.name == FIREBASE_PHASE_NAME }
  phase = app_target.new_shell_script_build_phase(FIREBASE_PHASE_NAME)
  phase.shell_script = '"${PROJECT_DIR}/../scripts/copy-firebase-config.sh"'
  phase.show_env_vars_in_log = '0'
end

project.save

puts "✓ Configurations: #{created.join(', ')}"
puts "✓ Schemes: #{environments.values.map { |e| e['iosScheme'] }.join(', ')}"
puts ''
puts 'Next: bundle exec pod install (from ios/)'

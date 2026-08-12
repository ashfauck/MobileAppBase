import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Firebase must be configured before any RNFirebase module is touched.
    //
    // The guard keeps the template runnable before you add a Firebase project:
    // FirebaseApp.configure() raises an uncaught exception when the plist is
    // missing, which would crash on launch. Once you drop the correct
    // GoogleService-Info.plist in (see scripts/copy-firebase-config.sh), this
    // branch starts running automatically.
    if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
      FirebaseApp.configure()
    } else {
      NSLog("[AppDelegate] GoogleService-Info.plist not found — Firebase disabled, push will not work.")
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "MobileAppBase",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // MARK: - Deep linking

  /// Custom scheme links: mobileappbase://notifications/42
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  /// Universal links: https://example.com/app/...
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    return RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }

  // NOTE: APNs registration callbacks (didRegisterForRemoteNotificationsWithDeviceToken,
  // didFailToRegisterForRemoteNotificationsWithError, didReceiveRemoteNotification)
  // are intentionally NOT implemented here.
  //
  // @react-native-firebase/messaging swizzles them at runtime and forwards the
  // APNs token to FCM. Implementing them manually without calling through to
  // Firebase is the single most common cause of "FCM token is never generated".
  // If you must implement them, disable swizzling by setting
  // FirebaseAppDelegateProxyEnabled = NO in Info.plist and forward every call
  // to Messaging.messaging() yourself.
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  /// Hand the native launch screen over to JS so it can stay visible until the
  /// first real screen has rendered (hidden in src/app/App.tsx).
  override func customize(_ rootView: UIView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }
}

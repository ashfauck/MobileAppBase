package com.mobileappbase

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  /**
   * The component name registered from JavaScript in index.js.
   * This is the React Native "app key" and is deliberately constant across
   * flavors — only the applicationId and the display name change per flavor.
   */
  override fun getMainComponentName(): String = "MobileAppBase"

  override fun onCreate(savedInstanceState: Bundle?) {
    // Swap BootTheme -> AppTheme and hand the splash over to JS, which hides it
    // once the first screen is ready (see src/app/App.tsx).
    RNBootSplash.init(this, R.style.BootTheme)

    // Passing null instead of savedInstanceState is required by
    // react-native-screens: it stops Android from restoring stale native
    // fragments on process death, which otherwise crashes on relaunch.
    super.onCreate(null)
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

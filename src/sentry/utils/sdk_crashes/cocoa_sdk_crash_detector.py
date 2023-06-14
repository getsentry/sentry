from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


class CocoaSDKCrashDetector(SDKCrashDetector):
    def is_sdk_crash(self) -> bool:
        return True

    def is_sdk_frame(self) -> bool:
        return True

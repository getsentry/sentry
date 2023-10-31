from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector, SDKCrashDetectorConfig


class CocoaSDKCrashDetector(SDKCrashDetector):
    def __init__(self):

        config = SDKCrashDetectorConfig(
            # Explicitly use an allow list to avoid detecting SDK crashes for SDK names we don't know.
            sdk_names=[
                "sentry.cocoa",
                "sentry.cocoa.capacitor",
                "sentry.cocoa.react-native",
                "sentry.cocoa.dotnet",
                "sentry.cocoa.flutter",
                "sentry.cocoa.kmp",
                "sentry.cocoa.unity",
                "sentry.cocoa.unreal",
            ],
            # Since changing the debug image type to macho (https://github.com/getsentry/sentry-cocoa/pull/2701)
            # released in sentry-cocoa 8.2.0 (https://github.com/getsentry/sentry-cocoa/blob/main/CHANGELOG.md#820),
            # the frames contain the full paths required for detecting system frames in is_system_library_frame.
            # Therefore, we require at least sentry-cocoa 8.2.0.
            min_sdk_version="8.2.0",
            system_library_paths={"/System/Library/", "/usr/lib/"},
            sdk_frame_function_matchers={
                r"*sentrycrash*",
                r"*\[Sentry*",
                r"*(Sentry*)*",  # Objective-C class extension categories
                r"SentryMX*",  # MetricKit Swift classes
            },
            sdk_frame_filename_matchers={"Sentry**"},
            # [SentrySDK crash] is a testing function causing a crash.
            # Therefore, we don't want to mark it a as a SDK crash.
            sdk_crash_ignore_functions_matchers={"**SentrySDK crash**"},
        )
        super().__init__(config)

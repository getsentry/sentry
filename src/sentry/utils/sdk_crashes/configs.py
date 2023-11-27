from sentry.utils.sdk_crashes.path_replacer import (
    FixedPathReplacer,
    KeepAfterPatternMatchPathReplacer,
)
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetectorConfig, SDKFrameConfig

cocoa_sdk_crash_detector_config = SDKCrashDetectorConfig(
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
    sdk_frame_config=SDKFrameConfig(
        function_patterns={
            r"*sentrycrash*",
            r"*\[Sentry*",
            r"*(Sentry*)*",  # Objective-C class extension categories
            r"SentryMX*",  # MetricKit Swift classes
        },
        filename_patterns={"Sentry**"},
        path_replacer=FixedPathReplacer(path="Sentry.framework"),
    ),
    # [SentrySDK crash] is a testing function causing a crash.
    # Therefore, we don't want to mark it a as a SDK crash.
    sdk_crash_ignore_functions_matchers={"**SentrySDK crash**"},
)

react_native_sdk_crash_detector_config = SDKCrashDetectorConfig(
    sdk_names=[
        "sentry.javascript.react-native",
    ],
    # 4.0.0 was released in June 2022, see https://github.com/getsentry/sentry-react-native/releases/tag/4.0.0.
    # We require at least sentry-react-native 4.0.0 to only detect SDK crashes for not too old versions.
    min_sdk_version="4.0.0",
    system_library_paths={
        "react-native/Libraries/",
        "react-native-community/",
    },
    sdk_frame_config=SDKFrameConfig(
        function_patterns=set(),
        filename_patterns={r"**/sentry-react-native/**"},
        path_replacer=KeepAfterPatternMatchPathReplacer(
            patterns={r"\/sentry-react-native\/.*", r"\/@sentry.*"},
            fallback_path="sentry-react-native",
        ),
    ),
    sdk_crash_ignore_functions_matchers=set(),
)

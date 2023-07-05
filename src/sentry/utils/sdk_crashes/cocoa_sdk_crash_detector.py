from typing import Any, Mapping, Sequence

from packaging.version import InvalidVersion, Version

from sentry.db.models import NodeData
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


class CocoaSDKCrashDetector(SDKCrashDetector):
    def should_detect_sdk_crash(self, event_data: NodeData) -> bool:
        sdk_name = get_path(event_data, "sdk", "name")
        if sdk_name and sdk_name != "sentry.cocoa":
            return False

        sdk_version = get_path(event_data, "sdk", "version")
        if not sdk_version:
            return False

        try:
            # Since changing the debug image type to macho (https://github.com/getsentry/sentry-cocoa/pull/2701)
            # released in sentry-cocoa 8.2.0 (https://github.com/getsentry/sentry-cocoa/blob/main/CHANGELOG.md#820),
            # the frames contain the full paths required for detecting system frames in is_system_library_frame.
            # Therefore, we require at least sentry-cocoa 8.2.0.
            minimum_cocoa_sdk_version = Version("8.2.0")
            cocoa_sdk_version = Version(sdk_version)

            if cocoa_sdk_version < minimum_cocoa_sdk_version:
                return False
        except InvalidVersion:
            return False

        is_unhandled = (
            get_path(event_data, "exception", "values", -1, "mechanism", "handled") is False
        )
        if is_unhandled is False:
            return False

        return True

    def is_sdk_crash(self, frames: Sequence[Mapping[str, Any]]) -> bool:
        if not frames:
            return False

        # The frames are ordered from caller to callee, or oldest to youngest.
        # The last frame is the one creating the exception.
        # Therefore, we must iterate in reverse order.
        # In a first iteration of this algorithm, we checked for in_app frames, but
        # customers can change the in_app configuration, so we can't rely on that.
        # Furthermore, if they use static linking for including Sentry Cocoa, Cocoa SDK
        # frames can be marked as in_app. Therefore, the algorithm only checks if frames
        # are SDK frames or from system libraries.
        for frame in reversed(frames):
            # [SentrySDK crash] is a testing function causing a crash.
            # Therefore, we don't want to mark it a as a SDK crash.
            function = frame.get("function")
            if function and "SentrySDK crash" in function:
                return False

            if self.is_sdk_frame(frame):
                return True

            if not self.is_system_library_frame(frame):
                return False

        return False

    def is_sdk_frame(self, frame: Mapping[str, Any]) -> bool:

        function = frame.get("function")
        if function:
            function_matchers = [
                r"*sentrycrash*",
                r"*\[Sentry*",
                r"*(Sentry*)*",  # Objective-C class extension categories
                r"SentryMX*",  # MetricKit Swift classes
            ]
            for matcher in function_matchers:
                if glob_match(function, matcher, ignorecase=True):
                    return True

        filename = frame.get("filename")
        if filename:
            filenameMatchers = ["Sentry**"]
            for matcher in filenameMatchers:
                if glob_match(filename, matcher, ignorecase=True):
                    return True

        return False

    def is_system_library_frame(self, frame: Mapping[str, Any]) -> bool:
        system_library_paths = {"/System/Library/", "/usr/lib/"}

        for field in self.fields_containing_paths:
            for system_library_path in system_library_paths:
                field_with_path = frame.get(field)
                if field_with_path and field_with_path.startswith(system_library_path):
                    return True

        return False

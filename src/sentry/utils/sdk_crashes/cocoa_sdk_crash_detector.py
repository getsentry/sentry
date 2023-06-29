from typing import Any, Mapping, Sequence

from sentry.utils.glob import glob_match
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


class CocoaSDKCrashDetector(SDKCrashDetector):
    def is_sdk_crash(self, frames: Sequence[Mapping[str, Any]]) -> bool:
        if not frames:
            return False

        # The frames are ordered from caller to callee, or oldest to youngest.
        # The last frame is the one creating the exception.
        # Therefore, we must iterate in reverse order.
        for frame in reversed(frames):
            if self.is_sdk_frame(frame):
                return True

            if frame.get("in_app") is True:
                return False

        return False

    def is_sdk_frame(self, frame: Mapping[str, Any]) -> bool:

        function = frame.get("function")
        if function:
            # [SentrySDK crash] is a testing function causing a crash.
            # Therefore, we don't want to mark it a as a SDK crash.
            if "SentrySDK crash" in function:
                return False

            function_matchers = ["*sentrycrash*", "**[[]Sentry*"]
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

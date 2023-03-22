from __future__ import annotations

from typing import Any, Mapping, Sequence

from sentry.eventstore.models import Event
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.event_stripper import EventStripper


class SDKCrashReporter:
    def __init__(self):
        self

    def report(self, event: Event) -> None:
        pass


class SDKCrashDetector:
    def __init__(self, sdk_crash_reporter: SDKCrashReporter, event_stripper: EventStripper):
        self
        self.sdk_crash_reporter = sdk_crash_reporter
        self.event_stripper = event_stripper

    def detect_sdk_crash(self, event: Event) -> None:
        if event.get("type", None) != "error" or event.get("platform") != "cocoa":
            return

        is_unhandled = get_path(event, "exception", "values", -1, "mechanism", "handled") is False
        if is_unhandled is False:
            return

        frames = get_path(event, "exception", "values", -1, "stacktrace", "frames")
        if not frames:
            return

        if self._is_cocoa_sdk_crash(frames):
            sdk_crash_event = self.event_stripper.strip_event_data(event)
            stripped_frames = self._strip_frames(frames)
            sdk_crash_event["exception"]["values"][0]["stacktrace"]["frames"] = stripped_frames
            self.sdk_crash_reporter.report(sdk_crash_event)

    def _strip_frames(self, frames: Sequence[Mapping[str, Any]]) -> Sequence[Mapping[str, Any]]:
        return [
            frame
            for frame in frames
            if self._is_cocoa_sdk_frame(frame) or frame.get("in_app", True) is False
        ]

    def _is_cocoa_sdk_crash(self, frames: Sequence[Mapping[str, Any]]) -> bool:
        """
        Returns true if the stacktrace is a Cocoa SDK crash.

        :param frames: The stacktrace frames ordered from newest to oldest.
        """
        if not frames:
            return False

        for frame in frames:
            if self._is_cocoa_sdk_frame(frame):
                return True

            if frame.get("in_app") is True:
                return False

        return False

    def _is_cocoa_sdk_frame(self, frame: Mapping[str, Any]) -> bool:
        function = frame.get("function")

        if function is not None:
            # [SentrySDK crash] is a testing function causing a crash.
            # Therefore, we don't want to mark it a as a SDK crash.
            if "SentrySDK crash" in function:
                return False

            functionsMatchers = ["*sentrycrash*", "**[[]Sentry*"]
            for matcher in functionsMatchers:
                if glob_match(frame.get("function"), matcher, ignorecase=True):
                    return True

        filename = frame.get("filename")
        if filename is not None:
            filenameMatchers = ["Sentry**"]
            for matcher in filenameMatchers:
                if glob_match(filename, matcher, ignorecase=True):
                    return True

        return False

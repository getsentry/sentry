from __future__ import annotations

from sentry.eventstore.models import Event
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.event_stripper import EventStripper
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


class SDKCrashReporter:
    def __init__(self):
        self

    def report(self, event: Event) -> None:
        return


class SDKCrashDetection:
    def __init__(
        self,
        sdk_crash_reporter: SDKCrashReporter,
        sdk_crash_detector: SDKCrashDetector,
        event_stripper: EventStripper,
    ):
        self
        self.sdk_crash_reporter = sdk_crash_reporter
        self.cocoa_sdk_crash_detector = sdk_crash_detector
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

        if self.cocoa_sdk_crash_detector.is_sdk_crash(frames):
            sdk_crash_event = self.event_stripper.strip_event_data(event)
            self.sdk_crash_reporter.report(sdk_crash_event)

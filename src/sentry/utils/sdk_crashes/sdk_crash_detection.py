from __future__ import annotations

from typing import Any, Mapping, Optional

from sentry.eventstore.models import Event
from sentry.issues.grouptype import GroupCategory
from sentry.utils.safe import get_path, set_path
from sentry.utils.sdk_crashes.cocoa_sdk_crash_detector import CocoaSDKCrashDetector
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


class SDKCrashReporter:
    def report(self, event_data: Mapping[str, Any], event_project_id: int) -> Event:
        from sentry.event_manager import EventManager

        manager = EventManager(dict(event_data))
        manager.normalize()
        return manager.save(project_id=event_project_id)


class SDKCrashDetection:
    def __init__(
        self,
        sdk_crash_reporter: SDKCrashReporter,
        sdk_crash_detector: SDKCrashDetector,
    ):
        self.sdk_crash_reporter = sdk_crash_reporter
        self.cocoa_sdk_crash_detector = sdk_crash_detector

    def detect_sdk_crash(self, event: Event, event_project_id: int) -> Optional[Event]:
        should_detect_sdk_crash = (
            event.group
            and event.group.issue_category == GroupCategory.ERROR
            and event.group.platform == "cocoa"
        )
        if not should_detect_sdk_crash:
            return None

        context = get_path(event.data, "contexts", "sdk_crash_detection")
        if context is not None and context.get("detected", False):
            return None

        # Getting the frames and checking if the event is unhandled might different per platform.
        # We will change this once we implement this for more platforms.
        is_unhandled = (
            get_path(event.data, "exception", "values", -1, "mechanism", "data", "handled") is False
        )
        if is_unhandled is False:
            return None

        frames = get_path(event.data, "exception", "values", -1, "stacktrace", "frames")
        if not frames:
            return None

        # We still need to pass in the frames to validate it's an unhandled event coming from the Cocoa SDK.
        # We will do this in a separate PR.
        if self.cocoa_sdk_crash_detector.is_sdk_crash():
            # We still need to strip event data for to avoid collecting PII. We will do this in a separate PR.
            sdk_crash_event_data = event.data

            set_path(
                sdk_crash_event_data, "contexts", "sdk_crash_detection", value={"detected": True}
            )

            return self.sdk_crash_reporter.report(sdk_crash_event_data, event_project_id)

        return None


_crash_reporter = SDKCrashReporter()
_cocoa_sdk_crash_detector = CocoaSDKCrashDetector()

sdk_crash_detection = SDKCrashDetection(_crash_reporter, _cocoa_sdk_crash_detector)

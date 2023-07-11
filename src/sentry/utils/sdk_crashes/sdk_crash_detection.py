from __future__ import annotations

import random
from typing import Any, Mapping, Optional

from sentry.eventstore.models import Event
from sentry.issues.grouptype import GroupCategory
from sentry.utils.safe import get_path, set_path
from sentry.utils.sdk_crashes.cocoa_sdk_crash_detector import CocoaSDKCrashDetector
from sentry.utils.sdk_crashes.event_stripper import strip_event_data
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


class SDKCrashReporter:
    def report(self, event_data: Mapping[str, Any], event_project_id: int) -> Event:
        from sentry.event_manager import EventManager

        manager = EventManager(dict(event_data))
        manager.normalize()
        return manager.save(project_id=event_project_id)


class SDKCrashDetection:
    """
    This class checks events for SDK crashes, a crash caused by a bug in one of our SDKs.
    When it detects such an event, it only keeps essential data and stores the event in a
    dedicated Sentry project only Sentry employees can access.

    This class doesn't seek to detect severe bugs, such as the transport layer breaking or
    the SDK continuously crashing. CI or other quality mechanisms should find such severe
    bugs. Furthermore, the solution only targets SDKs maintained by us, Sentry.
    """

    def __init__(
        self,
        sdk_crash_reporter: SDKCrashReporter,
        sdk_crash_detector: SDKCrashDetector,
    ):
        self.sdk_crash_reporter = sdk_crash_reporter
        self.cocoa_sdk_crash_detector = sdk_crash_detector

    def detect_sdk_crash(
        self, event: Event, event_project_id: int, sample_rate: float
    ) -> Optional[Event]:
        """
        Checks if the passed-in event is an SDK crash and stores the stripped event to a Sentry
        project specified with event_project_id.

        :param event: The event to check for an SDK crash.
        :param event_project_id: The project ID to store the SDK crash event to if one is detected.
        :param sample_rate: Sampling gets applied after an event is considered an SDK crash.
        """

        should_detect_sdk_crash = (
            event.group
            and event.group.issue_category == GroupCategory.ERROR
            and self.cocoa_sdk_crash_detector.should_detect_sdk_crash(event.data)
        )
        if not should_detect_sdk_crash:
            return None

        context = get_path(event.data, "contexts", "sdk_crash_detection")
        if context is not None:
            return None

        frames = get_path(event.data, "exception", "values", -1, "stacktrace", "frames")
        if not frames:
            return None

        if self.cocoa_sdk_crash_detector.is_sdk_crash(frames):
            if random.random() >= sample_rate:
                return None

            sdk_crash_event_data = strip_event_data(event.data, self.cocoa_sdk_crash_detector)

            set_path(
                sdk_crash_event_data,
                "contexts",
                "sdk_crash_detection",
                value={
                    "original_project_id": event.project.id,
                    "original_event_id": event.event_id,
                },
            )

            sdk_version = get_path(sdk_crash_event_data, "sdk", "version")
            set_path(sdk_crash_event_data, "release", value=sdk_version)

            # So Sentry can tell how many projects are impacted by this SDK crash
            set_path(sdk_crash_event_data, "user", "id", value=event.project.id)

            return self.sdk_crash_reporter.report(sdk_crash_event_data, event_project_id)

        return None


_crash_reporter = SDKCrashReporter()
_cocoa_sdk_crash_detector = CocoaSDKCrashDetector()

sdk_crash_detection = SDKCrashDetection(_crash_reporter, _cocoa_sdk_crash_detector)

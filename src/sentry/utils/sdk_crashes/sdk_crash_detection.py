from __future__ import annotations

import random
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.eventstore.models import Event, GroupEvent
from sentry.issues.grouptype import GroupCategory
from sentry.utils import metrics
from sentry.utils.safe import get_path, set_path
from sentry.utils.sdk_crashes.event_stripper import strip_event_data
from sentry.utils.sdk_crashes.sdk_crash_detection_config import SDKCrashDetectionConfig
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
    ):
        """
        Initializes the SDK crash detection.

        :param sdk_crash_reporter: Stores the stripped crash event to a Sentry project.
        """
        self.sdk_crash_reporter = sdk_crash_reporter

    def detect_sdk_crash(
        self, event: Event | GroupEvent, configs: Sequence[SDKCrashDetectionConfig]
    ) -> Event | None:
        """
        Checks if the passed-in event is an SDK crash and stores the stripped event to a Sentry
        project specified with project_id in the configs.

        :param event: The event to check for an SDK crash.
        :param configs: The list of configs, one for each SDK.
        """

        context = get_path(event.data, "contexts", "sdk_crash_detection")
        if context is not None:
            return None

        sdk_name = get_path(event.data, "sdk", "name")
        sdk_version = get_path(event.data, "sdk", "version")

        if not sdk_name or not sdk_version:
            return None

        metric_tags = {"sdk_name": sdk_name, "sdk_version": sdk_version}
        sdk_detectors = list(map(lambda config: SDKCrashDetector(config=config), configs))

        num_supported_detectors = sum(
            1 for detector in sdk_detectors if detector.is_sdk_supported(sdk_name, sdk_version)
        )
        if num_supported_detectors > 0:
            metrics.incr("post_process.sdk_crash_monitoring.sdk_event", tags=metric_tags)

        is_error = event.group and event.group.issue_category == GroupCategory.ERROR
        if not is_error:
            return None

        sdk_crash_detectors = [
            detector
            for detector in sdk_detectors
            if detector.should_detect_sdk_crash(sdk_name, sdk_version, event.data)
        ]

        if not sdk_crash_detectors:
            return None

        # Only report the first matching SDK crash detector. We don't want to report the same
        # event multiple times.
        sdk_crash_detector = sdk_crash_detectors[0]

        sample_rate = sdk_crash_detector.config.sample_rate
        project_id = sdk_crash_detector.config.project_id
        organization_allowlist = sdk_crash_detector.config.organization_allowlist

        if (
            len(organization_allowlist) > 0
            and event.project.organization_id not in organization_allowlist
        ):
            return None

        frames = get_path(event.data, "exception", "values", -1, "stacktrace", "frames")
        if not frames:
            return None

        metrics.incr("post_process.sdk_crash_monitoring.detecting_sdk_crash", tags=metric_tags)

        if sdk_crash_detector.is_sdk_crash(frames):
            # TODO this rollout rate is backwards
            if random.random() >= sample_rate:
                return None

            sdk_crash_event_data = strip_event_data(event.data, sdk_crash_detector)

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

            metrics.incr("post_process.sdk_crash_monitoring.sdk_crash_detected", tags=metric_tags)

            return self.sdk_crash_reporter.report(sdk_crash_event_data, project_id)

        return None


_crash_reporter = SDKCrashReporter()
sdk_crash_detection = SDKCrashDetection(_crash_reporter)

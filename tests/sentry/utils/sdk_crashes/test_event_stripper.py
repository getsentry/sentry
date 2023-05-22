import abc
from unittest.mock import Mock

from sentry.testutils import TestCase
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.cocoa_sdk_crash_detector import CocoaSDKCrashDetector
from sentry.utils.sdk_crashes.event_stripper import EventStripper
from tests.sentry.utils.sdk_crashes.test_fixture import (
    IN_APP_FRAME,
    get_crash_event,
    get_crash_event_with_frames,
    get_frames,
)


class BaseEventStripperMixin(BaseTestCase, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def create_event(self, data, project_id, assert_no_errors=True):
        pass

    def execute_test(self, event_data, should_be_reported, mock_sdk_crash_reporter):
        pass


class EventStripperTestMixin(BaseEventStripperMixin):
    def test_strip_event_data_keeps_allowed_keys(self):
        event_stripper = EventStripper(CocoaSDKCrashDetector())

        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = event_stripper.strip_event_data(event)

        keys_removed = {"tags", "user", "threads", "breadcrumbs", "environment"}
        for key in keys_removed:
            assert stripped_event_data.get(key) is None, f"key {key} should be removed"

        keys_kept = {
            "type",
            "timestamp",
            "platform",
            "sdk",
            "level",
            "logger",
            "exception",
            "debug_meta",
            "contexts",
        }

        for key in keys_kept:
            assert stripped_event_data.get(key) is not None, f"key {key} should be kept"

    def test_strip_event_data_without_debug_meta(self):
        event_stripper = EventStripper(CocoaSDKCrashDetector())

        event_data = get_crash_event()
        event_data["debug_meta"]["images"] = None

        event = self.create_event(
            data=event_data,
            project_id=self.project.id,
        )

        stripped_event_data = event_stripper.strip_event_data(event)

        debug_meta_images = get_path(stripped_event_data, "debug_meta", "images")
        assert debug_meta_images is None

    def test_strip_event_data_strips_context(self):
        event_stripper = EventStripper(CocoaSDKCrashDetector())

        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = event_stripper.strip_event_data(event)

        contexts = stripped_event_data.get("contexts")
        assert contexts is not None
        assert contexts.get("app") is None
        assert contexts.get("os") is not None
        assert contexts.get("device") is not None

    def test_strip_event_data_strips_non_referenced_dsyms(self):
        event_stripper = EventStripper(Mock())

        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = event_stripper.strip_event_data(event)

        debug_meta_images = get_path(stripped_event_data, "debug_meta", "images")

        image_addresses = set(map(lambda image: image["image_addr"], debug_meta_images))
        expected_image_addresses = {"0x1a4e8f000", "0x100304000", "0x100260000"}
        assert image_addresses == expected_image_addresses

    def test_strip_frames_sentry_in_app_frame_kept(self):
        frames = get_frames("SentryCrashMonitor_CPPException.cpp", sentry_frame_in_app=True)
        self._execute_strip_frames_test(frames)

    def test_strip_frames_sentry_non_in_app_frame_kept(self):
        frames = get_frames("SentryCrashMonitor_CPPException.cpp", sentry_frame_in_app=False)
        self._execute_strip_frames_test(frames)

    def _execute_strip_frames_test(self, frames):
        event_stripper = EventStripper(CocoaSDKCrashDetector())

        event_data = get_crash_event_with_frames(frames)

        event = self.create_event(
            data=event_data,
            project_id=self.project.id,
        )

        stripped_event_data = event_stripper.strip_event_data(event)

        stripped_frames = get_path(
            stripped_event_data, "exception", "values", -1, "stacktrace", "frames"
        )

        assert len(stripped_frames) == 6
        assert (
            len(
                [
                    frame
                    for frame in stripped_frames
                    if frame["function"] == IN_APP_FRAME["function"]
                ]
            )
            == 0
        ), "in_app frame should be removed"


@region_silo_test
class EventStripperTest(
    TestCase,
    EventStripperTestMixin,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        return self.store_event(data=data, project_id=project_id, assert_no_errors=assert_no_errors)

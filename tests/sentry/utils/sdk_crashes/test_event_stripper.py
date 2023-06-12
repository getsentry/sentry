import abc
from unittest.mock import Mock

from sentry.testutils import TestCase
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.cocoa_sdk_crash_detector import CocoaSDKCrashDetector
from sentry.utils.sdk_crashes.event_stripper import strip_event_data
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

    def execute_test(self):
        pass


class EventStripperTestMixin(BaseEventStripperMixin):
    def test_strip_event_data_keeps_allowed_keys(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event, CocoaSDKCrashDetector())

        keys_removed = {"tags", "user", "threads", "breadcrumbs", "environment"}
        for key in keys_removed:
            assert stripped_event_data.get(key) is None, f"key {key} should be removed"

        keys_kept = {
            "type",
            "timestamp",
            "platform",
            "sdk",
            "exception",
            "debug_meta",
            "contexts",
        }

        for key in keys_kept:
            assert stripped_event_data.get(key) is not None, f"key {key} should be kept"

    def test_strip_event_data_without_debug_meta(self):
        event_data = get_crash_event()
        event_data["debug_meta"]["images"] = None

        event = self.create_event(
            data=event_data,
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event, CocoaSDKCrashDetector())

        debug_meta_images = get_path(stripped_event_data, "debug_meta", "images")
        assert debug_meta_images is None

    def test_strip_event_data_strips_context(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event, CocoaSDKCrashDetector())

        contexts = stripped_event_data.get("contexts")
        assert len(contexts) == 2

        assert contexts.get("os") == {
          "name": "iOS",
          "version": "16.3",
          "build": "20D47",
        }

        device_context = contexts.get("device")
        assert len(device_context) == 3
        assert device_context.get("family") == "iOS"
        assert device_context.get("model") == "iPhone14,8"
        assert device_context.get("arch") == "arm64e"

    def test_strip_event_data_strips_sdk(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event, CocoaSDKCrashDetector())

        sdk = stripped_event_data.get("sdk")

        assert len(sdk) == 2
        assert sdk.get("name") == "sentry.cocoa"
        assert sdk.get("version") == "8.1.0"

    def test_strip_event_data_strips_value_if_not_simple_type(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )
        event.data["type"] = {"foo": "bar"}

        stripped_event_data = strip_event_data(event, CocoaSDKCrashDetector())

        assert stripped_event_data.get("type") is None

    def test_strip_event_data_keeps_simple_types(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )
        event.data["type"] = True
        event.data["datetime"] = 0.1
        event.data["timestamp"] = 1
        event.data["platform"] = "cocoa"

        stripped_event_data = strip_event_data(event, CocoaSDKCrashDetector())

        assert stripped_event_data.get("type") is True
        assert stripped_event_data.get("datetime") == 0.1
        assert stripped_event_data.get("timestamp") == 1
        assert stripped_event_data.get("platform") == "cocoa"

    def test_strip_event_data_strips_non_referenced_dsyms(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event, Mock())

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
        event_data = get_crash_event_with_frames(frames)

        event = self.create_event(
            data=event_data,
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event, CocoaSDKCrashDetector())

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

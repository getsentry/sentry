import abc

from fixtures.sdk_crash_detection.crash_event import (
    IN_APP_FRAME,
    get_crash_event,
    get_crash_event_with_frames,
    get_frames,
)
from sentry.testutils import TestCase
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.safe import get_path, set_path
from sentry.utils.sdk_crashes.cocoa_sdk_crash_detector import CocoaSDKCrashDetector
from sentry.utils.sdk_crashes.event_stripper import strip_event_data


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

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

        keys_removed = {"tags", "user", "threads", "breadcrumbs", "environment"}
        for key in keys_removed:
            assert stripped_event_data.get(key) is None, f"key {key} should be removed"

        keys_kept = {
            "type",
            "timestamp",
            "platform",
            "sdk",
            "exception",
            "contexts",
        }

        for key in keys_kept:
            assert stripped_event_data.get(key) is not None, f"key {key} should be kept"

    def test_strip_event_data_strips_context(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

        assert stripped_event_data.get("contexts") == {
            "os": {
                "name": "iOS",
                "version": "16.3",
                "build": "20D47",
            },
            "device": {
                "family": "iOS",
                "model": "iPhone14,8",
                "arch": "arm64e",
            },
        }

    def test_strip_event_data_strips_sdk(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

        assert stripped_event_data.get("sdk") == {
            "name": "sentry.cocoa",
            "version": "8.1.0",
        }

    def test_strip_event_data_strips_value_if_not_simple_type(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )
        event.data["type"] = {"foo": "bar"}

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

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

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

        assert stripped_event_data.get("type") is True
        assert stripped_event_data.get("datetime") == 0.1
        assert stripped_event_data.get("timestamp") == 1
        assert stripped_event_data.get("platform") == "cocoa"

    def test_strip_event_data_keeps_simple_exception_properties(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

        assert get_path(stripped_event_data, "exception", "values", 0, "type") == "EXC_BAD_ACCESS"
        assert get_path(stripped_event_data, "exception", "values", 0, "value") is None

    def test_strip_event_data_keeps_exception_mechanism(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        # set extra data that should be stripped
        set_path(event.data, "exception", "values", 0, "mechanism", "foo", value="bar")
        set_path(
            event.data, "exception", "values", 0, "mechanism", "meta", "signal", "foo", value="bar"
        )
        set_path(
            event.data,
            "exception",
            "values",
            0,
            "mechanism",
            "meta",
            "mach_exception",
            "foo",
            value="bar",
        )

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

        mechanism = get_path(stripped_event_data, "exception", "values", 0, "mechanism")

        assert mechanism == {
            "handled": False,
            "type": "mach",
            "meta": {
                "signal": {"number": 11, "code": 0, "name": "SIGSEGV", "code_name": "SEGV_NOOP"},
                "mach_exception": {
                    "exception": 1,
                    "code": 1,
                    "subcode": 0,
                    "name": "EXC_BAD_ACCESS",
                },
            },
        }

    def test_strip_event_data_keeps_exception_stacktrace(self):
        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

        first_frame = get_path(
            stripped_event_data, "exception", "values", 0, "stacktrace", "frames", 0
        )

        assert first_frame == {
            "filename": "EventStripperTestFrame.swift",
            "function": "function",
            "raw_function": "raw_function",
            "module": "module",
            "abs_path": "abs_path",
            "in_app": False,
            "instruction_addr": "0x1a4e8f000",
            "addr_mode": "0x1a4e8f000",
            "symbol": "symbol",
            "symbol_addr": "0x1a4e8f000",
            "image_addr": "0x1a4e8f000",
            "package": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
            "platform": "platform",
        }

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

        stripped_event_data = strip_event_data(event.data, CocoaSDKCrashDetector())

        stripped_frames = get_path(
            stripped_event_data, "exception", "values", -1, "stacktrace", "frames"
        )

        assert len(stripped_frames) == 7
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

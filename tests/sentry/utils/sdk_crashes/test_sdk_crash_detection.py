from typing import Any, Mapping, Sequence, Tuple
from unittest.mock import MagicMock, Mock

import pytest

from sentry.utils.sdk_crashes.cocoa_sdk_crash_detector import CocoaSDKCrashDetector
from sentry.utils.sdk_crashes.sdk_crash_detection import SDKCrashDetection, SDKCrashReporter
from tests.sentry.utils.sdk_crashes.test_fixture import (
    IN_APP_FRAME,
    get_crash_event,
    get_crash_event_with_frames,
    get_sentry_frame,
)


@pytest.mark.parametrize(
    "event,should_be_reported",
    [
        (
            get_crash_event(),
            True,
        ),
        (
            get_crash_event(handled=True),
            False,
        ),
        (get_crash_event(function="Senry"), False),
        (get_crash_event(platform="coco"), False),
        (get_crash_event(type="erro"), False),
        (get_crash_event(exception=[]), False),
    ],
    ids=[
        "unhandled_is_detected",
        "handled_not_detected",
        "wrong_function_not_detected",
        "wrong_platform_not_detected",
        "wrong_type_not_detected",
        "no_exception_not_detected",
    ],
)
def test_detect_sdk_crash(event, should_be_reported):
    _run_report_test_with_event(event, should_be_reported)


@pytest.mark.parametrize(
    "function,should_be_reported",
    [
        ("-[SentryHub getScope]", True),
        ("sentrycrashdl_getBinaryImage", True),
        ("-[sentryisgreat]", True),
        ("__47-[SentryBreadcrumbTracker swizzleViewDidAppear]_block_invoke_2", True),
        ("-[SentryCrash crash]", True),
        ("-[SenryHub getScope]", False),
        ("-SentryHub getScope]", False),
        ("-[SomeSentryHub getScope]", False),
        ("+[SentrySDK crash]", False),
    ],
)
def test_cocoa_sdk_crash_detection(function, should_be_reported):
    event = get_crash_event(function=function)

    _run_report_test_with_event(event, should_be_reported)


@pytest.mark.parametrize(
    "filename,should_be_reported",
    [
        ("SentryCrashMonitor_CPPException.cpp", True),
        ("SentryMonitor_CPPException.cpp", True),
        ("SentrMonitor_CPPException.cpp", False),
    ],
)
def test_report_cocoa_sdk_crash_filename(filename, should_be_reported):
    event = get_crash_event_with_frames(
        frames=[
            {
                "function": "__handleUncaughtException",
                "symbol": "__handleUncaughtException",
                "package": "CoreFoundation",
                "in_app": False,
            },
            {
                "function": "_objc_terminate",
                "symbol": "_ZL15_objc_terminatev",
                "package": "libobjc.A.dylib",
                "in_app": False,
            },
            {
                "function": "CPPExceptionTerminate",
                "raw_function": "CPPExceptionTerminate()",
                "filename": filename,
                "symbol": "_ZL21CPPExceptionTerminatev",
                "package": "MainApp",
                "in_app": False,
            },
            {
                "function": "std::__terminate",
                "symbol": "_ZSt11__terminatePFvvE",
                "package": "libc++abi.dylib",
                "in_app": False,
            },
        ]
    )

    _run_report_test_with_event(event, should_be_reported)


@pytest.mark.parametrize(
    "frames,should_be_reported",
    [
        ([], False),
        ([{"empty": "frame"}], False),
        ([get_sentry_frame("-[Sentry]")], True),
        ([get_sentry_frame("-[Sentry]", in_app=True)], True),
        (
            [
                {
                    "function": "__handleUncaughtException",
                    "symbol": "__handleUncaughtException",
                    "package": "CoreFoundation",
                    "in_app": False,
                },
                {
                    "function": "_objc_terminate",
                    "symbol": "_ZL15_objc_terminatev",
                    "package": "libobjc.A.dylib",
                    "in_app": False,
                },
                get_sentry_frame("sentrycrashdl_getBinaryImage"),
                {
                    "function": "std::__terminate",
                    "symbol": "_ZSt11__terminatePFvvE",
                    "package": "libc++abi.dylib",
                    "in_app": False,
                },
            ],
            True,
        ),
        (
            [
                IN_APP_FRAME,
                {
                    "function": "__handleUncaughtException",
                    "symbol": "__handleUncaughtException",
                    "package": "CoreFoundation",
                    "in_app": False,
                },
                {
                    "function": "_objc_terminate",
                    "symbol": "_ZL15_objc_terminatev",
                    "package": "libobjc.A.dylib",
                    "in_app": False,
                },
                get_sentry_frame("sentrycrashdl_getBinaryImage"),
                {
                    "function": "std::__terminate",
                    "symbol": "_ZSt11__terminatePFvvE",
                    "package": "libc++abi.dylib",
                    "in_app": False,
                },
            ],
            False,
        ),
    ],
    ids=[
        "no_frames_not_detected",
        "empty_frame_not_detected",
        "single_frame_is_detected",
        "single_in_app_frame_is_detected",
        "only_non_inapp_after_sentry_frame_is_detected",
        "only_inapp_after_sentry_frame_not_detected",
    ],
)
def test_report_cocoa_sdk_crash_frames(frames, should_be_reported):
    event = get_crash_event_with_frames(frames)

    _run_report_test_with_event(event, should_be_reported)


def test_sdk_crash_detected_event_is_not_reported():
    event = get_crash_event()
    event["contexts"]["sdk_crash_detection"] = {"detected": True}

    _run_report_test_with_event(event, should_be_reported=False)


def test_cocoa_sdk_crash_detection_without_context():
    event = get_crash_event(function="-[SentryHub getScope]")
    event["contexts"] = {}

    _run_report_test_with_event(event, True)


def given_crash_detector() -> Tuple[SDKCrashDetection, SDKCrashReporter]:
    crash_reporter = Mock(spec=SDKCrashReporter)
    cocoa_sdk_crash_detector = CocoaSDKCrashDetector()

    event_stripper = Mock()
    event_stripper.strip_event_data = MagicMock(side_effect=lambda x: x)

    crash_detection = SDKCrashDetection(crash_reporter, cocoa_sdk_crash_detector, event_stripper)

    return crash_detection, crash_reporter


def _run_report_test_with_event(event, should_be_reported):
    crash_detector, crash_reporter = given_crash_detector()

    crash_detector.detect_sdk_crash(event)

    if should_be_reported:
        assert_sdk_crash_reported(crash_reporter, event)
    else:
        assert_no_sdk_crash_reported(crash_reporter)


def assert_sdk_crash_reported(
    crash_reporter: SDKCrashReporter, expected_event: Sequence[Mapping[str, Any]]
):
    crash_reporter.report.assert_called_once_with(expected_event)

    reported_event = crash_reporter.report.call_args.args[0]
    assert reported_event["contexts"]["sdk_crash_detection"]["detected"] is True


def assert_no_sdk_crash_reported(crash_reporter: SDKCrashReporter):
    crash_reporter.report.assert_not_called()

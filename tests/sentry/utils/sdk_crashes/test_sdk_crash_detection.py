import abc
from typing import Any, Mapping, Sequence
from unittest.mock import patch

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.testutils import TestCase
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import region_silo_test
from sentry.utils.sdk_crashes.sdk_crash_detection import sdk_crash_detection
from tests.sentry.utils.sdk_crashes.test_fixture import (
    IN_APP_FRAME,
    get_crash_event,
    get_crash_event_with_frames,
    get_sentry_frame,
)


class BaseSDKCrashDetectionMixin(BaseTestCase, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def create_event(self, data, project_id, assert_no_errors=True):
        pass

    def execute_test(self, event_data, should_be_reported, mock_sdk_crash_reporter):

        event = self.create_event(
            data=event_data,
            project_id=self.project.id,
        )

        sdk_crash_detection.detect_sdk_crash(event=event)

        if should_be_reported:
            mock_sdk_crash_reporter.report.assert_called_once()

            reported_event = mock_sdk_crash_reporter.report.call_args.args[0]
            assert reported_event.data["contexts"]["sdk_crash_detection"]["detected"] is True
        else:
            mock_sdk_crash_reporter.report.assert_not_called()


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class PerformanceEventTestMixin(BaseSDKCrashDetectionMixin, PerfIssueTransactionTestMixin):
    def test_performance_event_not_detected(self, mock_sdk_crash_reporter):
        fingerprint = "some_group"
        fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-{fingerprint}"
        event = self.store_transaction(
            project_id=self.project.id,
            user_id="hi",
            fingerprint=[fingerprint],
        )

        sdk_crash_detection.detect_sdk_crash(event=event)

        mock_sdk_crash_reporter.report.assert_not_called()


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class CococaSDKTestMixin(BaseSDKCrashDetectionMixin):
    def test_unhandled_is_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(), True, mock_sdk_crash_reporter)

    def test_handled_is_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(handled=True), False, mock_sdk_crash_reporter)

    def test_wrong_function_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(function="Senry"), False, mock_sdk_crash_reporter)

    def test_wrong_platform_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(platform="coco"), False, mock_sdk_crash_reporter)

    def test_no_exception_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(exception=[]), False, mock_sdk_crash_reporter)

    def test_sdk_crash_detected_event_is_not_reported(self, mock_sdk_crash_reporter):
        event = get_crash_event()
        event["contexts"]["sdk_crash_detection"] = {"detected": True}

        self.execute_test(event, False, mock_sdk_crash_reporter)

    def test_cocoa_sdk_crash_detection_without_context(self, mock_sdk_crash_reporter):
        event = get_crash_event(function="-[SentryHub getScope]")
        event["contexts"] = {}

        self.execute_test(event, True, mock_sdk_crash_reporter)


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class CococaSDKFunctionTestMixin(BaseSDKCrashDetectionMixin):
    def test_hub_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[SentryHub getScope]"), True, mock_sdk_crash_reporter
        )

    def test_sentrycrash_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="sentrycrashdl_getBinaryImage"), True, mock_sdk_crash_reporter
        )

    def test_sentryisgreat_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[sentryisgreat]"), True, mock_sdk_crash_reporter
        )

    def test_sentryswizzle_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(
                function="__47-[SentryBreadcrumbTracker swizzleViewDidAppear]_block_invoke_2"
            ),
            True,
            mock_sdk_crash_reporter,
        )

    def test_sentrycrash_crash_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[SentryCrash crash]"),
            True,
            mock_sdk_crash_reporter,
        )

    def test_senryhub_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[SenryHub getScope]"),
            False,
            mock_sdk_crash_reporter,
        )

    def test_senryhub_no_brackets_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-SentryHub getScope]"),
            False,
            mock_sdk_crash_reporter,
        )

    def test_somesentryhub_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[SomeSentryHub getScope]"),
            False,
            mock_sdk_crash_reporter,
        )

    # "+[SentrySDK crash]" is used for testing, so we must ignore it.
    def test_sentrycrash_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="+[SentrySDK crash]"),
            False,
            mock_sdk_crash_reporter,
        )


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class CococaSDKFilenameTestMixin(BaseSDKCrashDetectionMixin):
    def test_filename_includes_sentrycrash_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            self._get_crash_event("SentryCrashMonitor_CPPException.cpp"),
            True,
            mock_sdk_crash_reporter,
        )

    def test_filename_includes_sentrymonitor_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            self._get_crash_event("SentryMonitor_CPPException.cpp"),
            True,
            mock_sdk_crash_reporter,
        )

    def test_filename_includes_senry_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            self._get_crash_event("SentrMonitor_CPPException.cpp"),
            False,
            mock_sdk_crash_reporter,
        )

    def _get_crash_event(self, filename) -> Sequence[Mapping[str, Any]]:
        return get_crash_event_with_frames(
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


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class CococaSDKFramesTestMixin(BaseSDKCrashDetectionMixin):
    def test_frames_empty_frame_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event_with_frames([{"empty": "frame"}]),
            False,
            mock_sdk_crash_reporter,
        )

    def test_frames_single_frame_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event_with_frames([get_sentry_frame("-[Sentry]")]),
            True,
            mock_sdk_crash_reporter,
        )

    def test_frames_in_app_frame_frame_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event_with_frames([get_sentry_frame("-[Sentry]", in_app=True)]),
            True,
            mock_sdk_crash_reporter,
        )

    def test_frames_only_non_in_app_after_sentry_frame_is_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event_with_frames(
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
                ]
            ),
            True,
            mock_sdk_crash_reporter,
        )

    def test_frames_only_in_app_after_sentry_frame_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event_with_frames(
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
                ]
            ),
            False,
            mock_sdk_crash_reporter,
        )


@region_silo_test
class SDKCrashDetectionTest(
    TestCase,
    CococaSDKTestMixin,
    CococaSDKFunctionTestMixin,
    CococaSDKFilenameTestMixin,
    CococaSDKFramesTestMixin,
    PerformanceEventTestMixin,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        return self.store_event(data=data, project_id=project_id, assert_no_errors=assert_no_errors)

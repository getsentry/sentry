import abc
import copy
from typing import Collection, Dict
from unittest.mock import patch

import pytest

from fixtures.sdk_crash_detection.crash_event import (
    IN_APP_FRAME,
    get_crash_event,
    get_crash_event_with_frames,
    get_sentry_frame,
)
from sentry.eventstore.snuba.backend import SnubaEventStorage
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.testutils.cases import BaseTestCase, SnubaTestCase, TestCase
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test
from sentry.utils.safe import get_path, set_path
from sentry.utils.sdk_crashes.sdk_crash_detection import sdk_crash_detection
from sentry.utils.sdk_crashes.sdk_crash_detection_config import SDKCrashDetectionConfig, SdkName

sdk_configs = [SDKCrashDetectionConfig(sdk_name=SdkName.Cocoa, project_id=1234, sample_rate=1.0)]


@pytest.fixture
def store_event(default_project, factories):
    def inner(data):
        return factories.store_event(data=data, project_id=default_project.id)

    return inner


class BaseSDKCrashDetectionMixin(BaseTestCase, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def create_event(self, data, project_id, assert_no_errors=True):
        pass

    def execute_test(self, event_data, should_be_reported, mock_sdk_crash_reporter):
        event = self.create_event(
            data=event_data,
            project_id=self.project.id,
        )

        sdk_crash_detection.detect_sdk_crash(event=event, configs=sdk_configs)

        if should_be_reported:
            assert mock_sdk_crash_reporter.report.call_count == 1

            reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]
            assert reported_event_data["contexts"]["sdk_crash_detection"] == {
                "original_project_id": event.project_id,
                "original_event_id": event.event_id,
            }
            assert reported_event_data["user"] == {
                "id": event.project_id,
            }

            assert reported_event_data["release"] == get_path(event_data, "sdk", "version")
        else:
            assert mock_sdk_crash_reporter.report.call_count == 0


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class PerformanceEventTestMixin(
    BaseSDKCrashDetectionMixin, SnubaTestCase, PerfIssueTransactionTestMixin
):
    def test_performance_event_not_detected(self, mock_sdk_crash_reporter):
        fingerprint = "some_group"
        fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-{fingerprint}"
        event = self.store_transaction(
            project_id=self.project.id,
            user_id="hi",
            fingerprint=[fingerprint],
        )

        sdk_crash_detection.detect_sdk_crash(event=event, configs=sdk_configs)

        assert mock_sdk_crash_reporter.report.call_count == 0


@django_db_all
@pytest.mark.snuba
@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
@pytest.mark.parametrize(
    ["sdk_name", "detected"],
    [
        ("sentry.cocoa", True),
        ("sentry.coco", False),
        ("sentry.cocoa.react-native", True),
        ("sentry.cocoa.capacitor", True),
        ("sentry.cocoa.react-native", True),
        ("sentry.cocoa.dotnet", True),
        ("sentry.cocoa.flutter", True),
        ("sentry.cocoa.kmp", True),
        ("sentry.cocoa.unity", True),
        ("sentry.cocoa.unreal", True),
    ],
)
def test_sdks_detected(mock_sdk_crash_reporter, store_event, sdk_name, detected):
    event_data = get_crash_event()
    set_path(event_data, "sdk", "name", value=sdk_name)
    event = store_event(data=event_data)

    sdk_crash_detection.detect_sdk_crash(event=event, configs=sdk_configs)

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
    else:
        assert mock_sdk_crash_reporter.report.call_count == 0


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class CococaSDKTestMixin(BaseSDKCrashDetectionMixin):
    def test_unhandled_is_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(), True, mock_sdk_crash_reporter)

    def test_handled_is_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(handled=True), False, mock_sdk_crash_reporter)

    def test_wrong_function_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(function="Senry"), False, mock_sdk_crash_reporter)

    def test_beta_sdk_version_detected(self, mock_sdk_crash_reporter):
        event = get_crash_event()
        set_path(event, "sdk", "version", value="8.2.1-beta.1")

        self.execute_test(event, True, mock_sdk_crash_reporter)

    def test_too_low_min_sdk_version_not_detected(self, mock_sdk_crash_reporter):
        event = get_crash_event()
        set_path(event, "sdk", "version", value="8.1.1")

        self.execute_test(event, False, mock_sdk_crash_reporter)

    def test_invalid_sdk_version_not_detected(self, mock_sdk_crash_reporter):
        event = get_crash_event()
        set_path(event, "sdk", "version", value="foo")

        self.execute_test(event, False, mock_sdk_crash_reporter)

    def test_no_exception_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(exception=[]), False, mock_sdk_crash_reporter)

    def test_sdk_crash_detected_event_is_not_reported(self, mock_sdk_crash_reporter):
        event = get_crash_event()

        set_path(
            event,
            "contexts",
            "sdk_crash_detection",
            value={
                "original_project_id": 1234,
                "original_event_id": 1234,
            },
        )

        self.execute_test(event, False, mock_sdk_crash_reporter)

    def test_cocoa_sdk_crash_detection_without_context(self, mock_sdk_crash_reporter):
        event = get_crash_event(function="-[SentryHub getScope]")
        event["contexts"] = {}

        self.execute_test(event, True, mock_sdk_crash_reporter)

    def test_metric_kit_crash_is_detected(self, mock_sdk_crash_reporter):
        """
        The frames stem from a real world crash caused by our MetricKit integration.
        All data was anonymized.
        """
        frames = [
            {
                "function": "_dispatch_workloop_worker_thread",
                "package": "/usr/lib/system/libdispatch.dylib",
                "in_app": False,
            },
            {
                "function": "_dispatch_lane_serial_drain$VARIANT$armv81",
                "package": "/usr/lib/system/libdispatch.dylib",
                "in_app": False,
            },
            {
                "function": "__44-[MXMetricManager deliverDiagnosticPayload:]_block_invoke",
                "package": "/System/Library/Frameworks/MetricKit.framework/MetricKit",
                "in_app": False,
            },
            {
                "function": "Sequence.forEach",
                "raw_function": "specialized Sequence.forEach((A.Element))",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "<compiler-generated>",
                "abs_path": "<compiler-generated>",
                "in_app": True,
            },
            {
                "function": "SentryMXManager.didReceive",
                "raw_function": "closure #1 (MXDiagnosticPayload) in SentryMXManager.didReceive([MXDiagnosticPayload])",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryMXManager.swift",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/Consumer/SourcePackages/checkouts/sentry-cocoa/Sources/Swift/MetricKit/SentryMXManager.swift",
                "in_app": True,
            },
            {
                "function": "Sequence.forEach",
                "raw_function": "specialized Sequence.forEach((A.Element))",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "<compiler-generated>",
                "abs_path": "<compiler-generated>",
                "in_app": True,
            },
            {
                "function": "SentryMXManager.didReceive",
                "raw_function": "closure #1 (SentryMXCallStackTree) in closure #3 (MXCPUExceptionDiagnostic) in closure #1 (MXDiagnosticPayload) in SentryMXManager.didReceive([MXDiagnosticPayload])",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryMXManager.swift",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/Consumer/SourcePackages/checkouts/sentry-cocoa/Sources/Swift/MetricKit/SentryMXManager.swift",
                "in_app": True,
            },
            {
                "function": "-[SentryMetricKitIntegration captureEventNotPerThread:params:]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryMetricKitIntegration.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/Consumer/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentryMetricKitIntegration.m",
                "in_app": False,
            },
            {
                "function": "+[SentrySDK captureEvent:]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentrySDK.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/Consumer/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentrySDK.m",
                "in_app": False,
            },
            {
                "function": "-[SentryFileManager readAppStateFrom:]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryFileManager.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/Consumer/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentryFileManager.m",
                "in_app": False,
            },
            {
                "function": "+[SentrySerialization appStateWithData:]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentrySerialization.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/Consumer/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentrySerialization.m",
                "in_app": False,
            },
            {
                "function": "-[SentryAppState initWithJSONObject:]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryAppState.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/Consumer/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentryAppState.m",
                "in_app": False,
            },
            {
                "function": "+[NSDate(SentryExtras) sentry_fromIso8601String:]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "NSDate+SentryExtras.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/Consumer/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/NSDate+SentryExtras.m",
                "in_app": True,
            },
            {
                "function": "-[NSDateFormatter getObjectValue:forString:errorDescription:]",
                "package": "/System/Library/Frameworks/Foundation.framework/Foundation",
                "in_app": False,
            },
            {
                "function": "CFDateFormatterGetAbsoluteTimeFromString",
                "package": "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
                "in_app": False,
            },
            {
                "function": "__cficu_ucal_clear",
                "package": "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
                "in_app": False,
            },
            {
                "function": "icu::Calendar::clear",
                "raw_function": "icu::Calendar::clear()",
                "package": "/usr/lib/libicucore.A.dylib",
                "in_app": False,
            },
        ]

        event = get_crash_event_with_frames(frames)

        self.execute_test(event, True, mock_sdk_crash_reporter)

        reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]
        actual_frames = get_path(
            reported_event_data, "exception", "values", -1, "stacktrace", "frames"
        )
        assert actual_frames == [
            {
                "function": "_dispatch_workloop_worker_thread",
                "package": "/usr/lib/system/libdispatch.dylib",
                "in_app": False,
            },
            {
                "function": "_dispatch_lane_serial_drain$VARIANT$armv81",
                "package": "/usr/lib/system/libdispatch.dylib",
                "in_app": False,
            },
            {
                "function": "__44-[MXMetricManager deliverDiagnosticPayload:]_block_invoke",
                "package": "/System/Library/Frameworks/MetricKit.framework/MetricKit",
                "in_app": False,
            },
            {
                "function": "SentryMXManager.didReceive",
                "raw_function": "closure #1 (MXDiagnosticPayload) in SentryMXManager.didReceive([MXDiagnosticPayload])",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "SentryMXManager.didReceive",
                "raw_function": "closure #1 (SentryMXCallStackTree) in closure #3 (MXCPUExceptionDiagnostic) in closure #1 (MXDiagnosticPayload) in SentryMXManager.didReceive([MXDiagnosticPayload])",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "-[SentryMetricKitIntegration captureEventNotPerThread:params:]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "+[SentrySDK captureEvent:]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "-[SentryFileManager readAppStateFrom:]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "+[SentrySerialization appStateWithData:]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "-[SentryAppState initWithJSONObject:]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "+[NSDate(SentryExtras) sentry_fromIso8601String:]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "-[NSDateFormatter getObjectValue:forString:errorDescription:]",
                "package": "/System/Library/Frameworks/Foundation.framework/Foundation",
                "in_app": False,
            },
            {
                "function": "CFDateFormatterGetAbsoluteTimeFromString",
                "package": "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
                "in_app": False,
            },
            {
                "function": "__cficu_ucal_clear",
                "package": "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
                "in_app": False,
            },
            {
                "function": "icu::Calendar::clear",
                "raw_function": "icu::Calendar::clear()",
                "package": "/usr/lib/libicucore.A.dylib",
                "in_app": False,
            },
        ]

    def test_thread_inspector_crash_is_detected(self, mock_sdk_crash_reporter):
        """
        The frames stem from a real world crash caused by our MetricKit integration.
        All data was anonymized.
        """
        frames = [
            {
                "function": "_pthread_start",
                "package": "/usr/lib/system/libdispatch.dylib",
                "in_app": False,
            },
            {
                "function": "__NSThread__start__",
                "package": "/System/Library/Frameworks/Foundation.framework/Foundation",
                "in_app": False,
            },
            {
                "function": "-[SentryANRTracker detectANRs]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryANRTracker.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/SentryApp/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentryANRTracker.m",
                "in_app": False,
            },
            {
                "function": "-[SentryANRTracker ANRDetected]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryANRTracker.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/SentryApp/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentryANRTracker.m",
                "in_app": False,
            },
            {
                "function": "-[SentryANRTrackingIntegration anrDetected]",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryANRTrackingIntegration.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/SentryApp/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentryANRTrackingIntegration.m",
                "in_app": False,
            },
            {
                "function": "getStackEntriesFromThread",
                "package": "/private/var/containers/Bundle/Application/CA061D22-C965-4C50-B383-59D8F14A6DDF/Sentry.app/Sentry",
                "filename": "SentryThreadInspector.m",
                "abs_path": "/Users/sentry/Library/Developer/Xcode/DerivedData/SentryApp/SourcePackages/checkouts/sentry-cocoa/Sources/Sentry/SentryThreadInspector.m",
                "in_app": True,
            },
        ]

        event = get_crash_event_with_frames(frames)

        self.execute_test(event, True, mock_sdk_crash_reporter)

        reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]
        actual_frames = get_path(
            reported_event_data, "exception", "values", -1, "stacktrace", "frames"
        )
        assert actual_frames == [
            {
                "function": "_pthread_start",
                "package": "/usr/lib/system/libdispatch.dylib",
                "in_app": False,
            },
            {
                "function": "__NSThread__start__",
                "package": "/System/Library/Frameworks/Foundation.framework/Foundation",
                "in_app": False,
            },
            {
                "function": "-[SentryANRTracker detectANRs]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "-[SentryANRTracker ANRDetected]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "-[SentryANRTrackingIntegration anrDetected]",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
            {
                "function": "getStackEntriesFromThread",
                "package": "Sentry.framework",
                "abs_path": "Sentry.framework",
                "filename": "Sentry.framework",
                "in_app": True,
            },
        ]


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

    def test_sentry_date_category_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="+[NSDate(SentryExtras) sentry_fromIso8601String:]"),
            True,
            mock_sdk_crash_reporter,
        )

    def test_sentry_ns_data_category_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[NSData(Sentry) sentry_nullTerminated:]"),
            True,
            mock_sdk_crash_reporter,
        )

    def test_sentry_swift_metric_kit_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="SentryMXManager.didReceive"),
            True,
            mock_sdk_crash_reporter,
        )

    def test_sentry_swift_wrong_metric_kit_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="SentryManager.didReceive"),
            False,
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

    def _get_crash_event(self, filename) -> Dict[str, Collection[str]]:
        return get_crash_event_with_frames(
            frames=[
                {
                    "function": "__handleUncaughtException",
                    "symbol": "__handleUncaughtException",
                    "package": "CoreFoundation",
                    "in_app": False,
                    "image_addr": "0x1a4e8f000",
                },
                {
                    "function": "_objc_terminate",
                    "symbol": "_ZL15_objc_terminatev",
                    "package": "/usr/lib/system/libobjc.A.dylib",
                    "in_app": False,
                    "image_addr": "0x1a4e8f000",
                },
                {
                    "function": "CPPExceptionTerminate",
                    "raw_function": "CPPExceptionTerminate()",
                    "filename": filename,
                    "symbol": "_ZL21CPPExceptionTerminatev",
                    "package": "MainApp",
                    "in_app": False,
                    "image_addr": "0x1a4e8f000",
                },
                {
                    "function": "std::__terminate",
                    "symbol": "_ZSt11__terminatePFvvE",
                    "package": "/usr/lib/system/libc++abi.dylib",
                    "in_app": False,
                    "image_addr": "0x1a4e8f000",
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
                        "image_addr": "0x1a4e8f000",
                    },
                    {
                        "function": "_objc_terminate",
                        "symbol": "_ZL15_objc_terminatev",
                        "package": "libobjc.A.dylib",
                        "in_app": False,
                        "image_addr": "0x1a4e8f000",
                    },
                    get_sentry_frame("sentrycrashdl_getBinaryImage"),
                    {
                        "function": "std::__terminate",
                        "symbol": "_ZSt11__terminatePFvvE",
                        "package": "/usr/lib/system/libc++abi.dylib",
                        "in_app": False,
                        "image_addr": "0x1a4e8f000",
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
                    {
                        "function": "std::__terminate",
                        "symbol": "_ZSt11__terminatePFvvE",
                        "package": "/usr/lib/system/libc++abi.dylib",
                        "in_app": False,
                    },
                    get_sentry_frame("sentrycrashdl_getBinaryImage"),
                    {
                        "function": "_objc_terminate",
                        "symbol": "_ZL15_objc_terminatev",
                        "package": "libobjc.A.dylib",
                        "in_app": False,
                    },
                    {
                        "function": "__handleUncaughtException",
                        "symbol": "__handleUncaughtException",
                        "package": "CoreFoundation",
                        "in_app": False,
                    },
                    IN_APP_FRAME,
                ]
            ),
            False,
            mock_sdk_crash_reporter,
        )


class SDKCrashReportTestMixin(BaseSDKCrashDetectionMixin, SnubaTestCase):
    @django_db_all
    def test_sdk_crash_event_stored_to_sdk_crash_project(self):
        cocoa_sdk_crashes_project = self.create_project(
            name="Cocoa SDK Crashes",
            slug="cocoa-sdk-crashes",
            teams=[self.team],
            fire_project_created=True,
        )

        event = self.create_event(
            data=get_crash_event(),
            project_id=self.project.id,
        )

        configs = [
            SDKCrashDetectionConfig(
                sdk_name=SdkName.Cocoa, project_id=cocoa_sdk_crashes_project.id, sample_rate=1.0
            )
        ]
        sdk_crash_event = sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

        assert sdk_crash_event is not None

        event_store = SnubaEventStorage()
        fetched_sdk_crash_event = event_store.get_event_by_id(
            cocoa_sdk_crashes_project.id, sdk_crash_event.event_id
        )

        assert cocoa_sdk_crashes_project.id == fetched_sdk_crash_event.project_id
        assert sdk_crash_event.event_id == fetched_sdk_crash_event.event_id


@region_silo_test
class SDKCrashDetectionTest(
    TestCase,
    CococaSDKTestMixin,
    CococaSDKFunctionTestMixin,
    CococaSDKFilenameTestMixin,
    CococaSDKFramesTestMixin,
    PerformanceEventTestMixin,
    SDKCrashReportTestMixin,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        return self.store_event(data=data, project_id=project_id, assert_no_errors=assert_no_errors)


@django_db_all
@pytest.mark.snuba
@patch("random.random", return_value=0.0)
@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
def test_sample_is_rate_zero(mock_sdk_crash_reporter, mock_random, store_event):
    event = store_event(data=get_crash_event())

    configs = copy.deepcopy(sdk_configs)
    configs[0]["sample_rate"] = 0.0

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    assert mock_sdk_crash_reporter.report.call_count == 0


@django_db_all
@pytest.mark.snuba
@patch("random.random", return_value=0.1)
@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
def test_sampling_rate(mock_sdk_crash_reporter, mock_random, store_event):
    event = store_event(data=get_crash_event())

    configs = copy.deepcopy(sdk_configs)

    # not sampled
    configs[0]["sample_rate"] = 0.09
    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    configs[0]["sample_rate"] = 0.1
    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    # sampled
    configs[0]["sample_rate"] = 0.11
    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    assert mock_sdk_crash_reporter.report.call_count == 1


@django_db_all
@pytest.mark.snuba
@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
def test_multiple_configs_first_one_picked(mock_sdk_crash_reporter, store_event):
    event = store_event(data=get_crash_event())

    configs = [
        SDKCrashDetectionConfig(sdk_name=SdkName.Cocoa, project_id=1234, sample_rate=1.0),
        SDKCrashDetectionConfig(sdk_name=SdkName.Cocoa, project_id=12345, sample_rate=1.0),
    ]

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    assert mock_sdk_crash_reporter.report.call_count == 1
    project_id = mock_sdk_crash_reporter.report.call_args.args[1]
    assert project_id == 1234

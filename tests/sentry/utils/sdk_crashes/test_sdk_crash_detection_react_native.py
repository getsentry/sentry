from functools import wraps
from typing import Optional
from unittest.mock import patch

import pytest

from fixtures.sdk_crash_detection.crash_event_react_native import get_crash_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.safe import get_path, set_path
from sentry.utils.sdk_crashes.sdk_crash_detection import sdk_crash_detection
from sentry.utils.sdk_crashes.sdk_crash_detection_config import SDKCrashDetectionConfig, SdkName


def build_sdk_configs(
    organization_allowlist: Optional[list[int]] = None,
) -> list[SDKCrashDetectionConfig]:
    return [
        SDKCrashDetectionConfig(
            sdk_name=SdkName.ReactNative,
            project_id=1234,
            sample_rate=1.0,
            organization_allowlist=organization_allowlist,
        )
    ]


def decorators(func):
    @wraps(func)
    @django_db_all
    @pytest.mark.snuba
    @patch("random.random", return_value=0.1)
    @patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)

    return wrapper


@decorators
def test_sdk_crash_is_reported(mock_sdk_crash_reporter, mock_random, store_event):
    event = store_event(data=get_crash_event())

    sdk_configs = build_sdk_configs(organization_allowlist=[event.project.organization_id])

    sdk_crash_detection.detect_sdk_crash(event=event, configs=sdk_configs)

    assert mock_sdk_crash_reporter.report.call_count == 1
    reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]

    stripped_frames = get_path(
        reported_event_data, "exception", "values", -1, "stacktrace", "frames"
    )

    assert len(stripped_frames) == 4
    assert stripped_frames[0]["function"] == "dispatchEvent"
    assert stripped_frames[1]["function"] == "community.lib.dosomething"
    assert stripped_frames[2]["function"] == "nativeCrash"
    assert stripped_frames[3]["function"] == "ReactNativeClient#nativeCrash"


@decorators
def test_sdk_crash_sample_app_not_reported(mock_sdk_crash_reporter, mock_random, store_event):
    event = store_event(
        data=get_crash_event(
            filename="/Users/sentry.user/git-repos/sentry-react-native/samples/react-native/src/Screens/HomeScreen.tsx"
        )
    )

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=build_sdk_configs(organization_allowlist=[event.project.organization_id]),
    )

    assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_sdk_crash_react_natives_not_reported(mock_sdk_crash_reporter, mock_random, store_event):
    event = store_event(
        data=get_crash_event(
            filename="/Users/sentry.user/git-repos/sentry-react-natives/dist/js/client.js"
        )
    )

    sdk_crash_detection.detect_sdk_crash(event=event, configs=build_sdk_configs())

    assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_beta_sdk_version_detected(mock_sdk_crash_reporter, mock_random, store_event):
    event_data = get_crash_event()
    set_path(event_data, "sdk", "version", value="4.1.0-beta.0")
    event = store_event(data=event_data)

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=build_sdk_configs(organization_allowlist=[event.project.organization_id]),
    )

    assert mock_sdk_crash_reporter.report.call_count == 1


@decorators
def test_too_low_min_sdk_version_not_detected(mock_sdk_crash_reporter, mock_random, store_event):
    event_data = get_crash_event()
    set_path(event_data, "sdk", "version", value="3.9.9")
    event = store_event(data=event_data)

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=build_sdk_configs(organization_allowlist=[event.project.organization_id]),
    )

    assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_organization_not_in_allowlist_not_detected(
    mock_sdk_crash_reporter, mock_random, store_event
):
    event = store_event(data=get_crash_event())

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=build_sdk_configs(organization_allowlist=[event.project.organization_id + 1]),
    )

    assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_organization_empty_allowlist_not_detected(
    mock_sdk_crash_reporter, mock_random, store_event
):
    event = store_event(data=get_crash_event())

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=build_sdk_configs(organization_allowlist=[]),
    )

    assert mock_sdk_crash_reporter.report.call_count == 0

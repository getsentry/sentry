from collections.abc import Sequence
from functools import wraps
from unittest.mock import patch

import pytest

from fixtures.sdk_crash_detection.crash_event_native import get_crash_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.safe import get_path, set_path
from sentry.utils.sdk_crashes.sdk_crash_detection import sdk_crash_detection
from sentry.utils.sdk_crashes.sdk_crash_detection_config import (
    SDKCrashDetectionConfig,
    build_sdk_crash_detection_configs,
)


def decorators(func):
    @wraps(func)
    @django_db_all
    @pytest.mark.snuba
    @patch("random.random", return_value=0.1)
    @patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)

    return wrapper


@pytest.fixture
def configs() -> Sequence[SDKCrashDetectionConfig]:
    with override_options(
        {
            "issues.sdk_crash_detection.native.project_id": 4,
            "issues.sdk_crash_detection.native.sample_rate": 0.3,
            "issues.sdk_crash_detection.native.organization_allowlist": [3],
        }
    ):
        return build_sdk_crash_detection_configs()


@pytest.mark.parametrize(
    ["sdk_frame_function", "system_frame_package", "detected"],
    [
        (
            "sentry_value_to_msgpack",
            "java.lang.reflect.Method",
            True,
        ),
    ],
)
@decorators
def test_sdk_crash_is_reported_with_native_paths(
    mock_sdk_crash_reporter,
    mock_random,
    store_event,
    configs,
    sdk_frame_function,
    system_frame_package,
    detected,
):
    event = store_event(
        data=get_crash_event(
            sdk_frame_function=sdk_frame_function, system_frame_package=system_frame_package
        )
    )

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
        reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]

        stripped_frames = get_path(
            reported_event_data, "exception", "values", -1, "stacktrace", "frames"
        )

        assert len(stripped_frames) == 5

        system_frame1 = stripped_frames[0]
        assert system_frame1["function"] == "main"
        assert system_frame1["package"] == "android.app.ActivityThread"
        assert system_frame1["filename"] == "ActivityThread.java"
        assert system_frame1["in_app"] is False

        sdk_frame = stripped_frames[3]
        assert sdk_frame["function"] == "captureMessage"
        assert sdk_frame["package"] == system_frame_package
        assert sdk_frame["filename"] == "Hub.java"
        assert "abs_path" not in sdk_frame
        assert sdk_frame["in_app"] is True

        system_frame2 = stripped_frames[4]
        assert system_frame2["function"] == "invoke"
        assert system_frame2["package"] == system_frame_package
        assert system_frame2["filename"] == "Method.java"
        assert system_frame2["in_app"] is False

    else:
        assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_beta_sdk_version_detected(mock_sdk_crash_reporter, mock_random, store_event, configs):
    event_data = get_crash_event()
    set_path(event_data, "sdk", "version", value="0.4.1-beta.0")
    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    assert mock_sdk_crash_reporter.report.call_count == 1


@decorators
def test_too_low_min_sdk_version_not_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
):
    event_data = get_crash_event()
    set_path(event_data, "sdk", "version", value="0.3.9")
    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    assert mock_sdk_crash_reporter.report.call_count == 0

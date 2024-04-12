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
            "issues.sdk_crash_detection.native.sample_rate": 0.11,
            "issues.sdk_crash_detection.native.organization_allowlist": [3],
        }
    ):
        return build_sdk_crash_detection_configs()


@pytest.mark.parametrize(
    ["sdk_frame_function", "system_frame_package", "detected"],
    [
        (
            "sentry_value_to_msgpack",
            "/lib/x86_64-linux-gnu/libc.so.6",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/usr/lib/x86_64-linux-gnu/libc.so.6",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/usr/local/lib/x86_64-linux-gnu/libc.so.6",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/usr/local/Cellar/x86_64-linux-gnu/libc.so.6",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "linux-gate.so.1",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "C:\\WINDOWS\\SYSTEM32\\ntdll.dll",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/system/somepath/libc.so.6",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/vendor/somepath/yes",
            True,
        ),
        (
            "sentr_value_to_msgpack",
            "/lib/x86_64-linux-gnu/libc.so.6",
            False,
        ),
        (
            "sentry__module_level",
            "/usr/lib/something.so",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/something/on/android/libart.so",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/apex/com.android.placeholder/libA/yes/yes",
            True,
        ),
        (
            "sentry_value_to_msgpack",
            "/apex/com.android.placeholder/liA/yes/yes",
            False,
        ),
        (
            "Java_io_sentry_android_ndk_NativeScope_nativeAddBreadcrumb",
            "/apex/com.android.placeholder/libA/yes/yes",
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

        assert len(stripped_frames) == 4

        system_frame1 = stripped_frames[0]
        assert system_frame1["function"] == "RtlUserThreadStart"
        assert system_frame1["symbol"] == "RtlUserThreadStart"
        assert system_frame1["package"] == "C:\\WINDOWS\\SYSTEM32\\ntdll.dll"
        assert system_frame1["in_app"] is False

        sdk_frame = stripped_frames[2]
        assert sdk_frame["function"] == sdk_frame_function
        assert sdk_frame["symbol"] == sdk_frame_function
        assert sdk_frame["package"] == "sentry"
        assert sdk_frame["in_app"] is True

        system_frame2 = stripped_frames[3]
        assert system_frame2["function"] == "boost::serialization::singleton<T>::singleton<T>"
        assert (
            system_frame2["symbol"]
            == "??0?$singleton@V?$extended_type_info_typeid@T_E_SC_SI_OPT_IR_MODE_SELECTOR@@@serialization@boost@@@serialization@boost@@IEAA@XZ"
        )
        assert system_frame2["package"] == system_frame_package
        assert system_frame2["in_app"] is False

    else:
        assert mock_sdk_crash_reporter.report.call_count == 0


@pytest.mark.parametrize(
    ["sdk_frame_function", "sdk_frame_package", "expected_sdk_frame_package"],
    [
        (
            "sentry_sync",
            "C:\\GitLab-Runner\\builds\\WEFASW\\0\\3rdParty\\Sentry\\upstream\\src\\sentry_sync.h",
            "sentry_sync.h",
        ),
        (
            "sentry_value_to_msgpack",
            "sentry._sentry.h",
            "sentry",
        ),
        (
            "sentry_value_to_msgpack",
            "some_weird_path/sentry__.h",
            "sentry__.h",
        ),
    ],
)
@decorators
def test_sdk_crash_sentry_native_keeps_sentry_package_paths(
    mock_sdk_crash_reporter,
    mock_random,
    store_event,
    configs,
    sdk_frame_function,
    sdk_frame_package,
    expected_sdk_frame_package,
):
    event = store_event(
        data=get_crash_event(
            sdk_frame_function=sdk_frame_function, sdk_frame_package=sdk_frame_package
        )
    )

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    assert mock_sdk_crash_reporter.report.call_count == 1
    reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]

    stripped_frames = get_path(
        reported_event_data, "exception", "values", -1, "stacktrace", "frames"
    )

    assert len(stripped_frames) == 4

    sdk_frame = stripped_frames[2]
    assert sdk_frame["function"] == sdk_frame_function
    assert sdk_frame["symbol"] == sdk_frame_function
    assert sdk_frame["package"] == expected_sdk_frame_package
    assert sdk_frame["in_app"] is True


@decorators
def test_beta_sdk_version_detected(mock_sdk_crash_reporter, mock_random, store_event, configs):
    event_data = get_crash_event()
    set_path(event_data, "sdk", "version", value="0.6.1-beta.0")
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
    set_path(event_data, "sdk", "version", value="0.5.9")
    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    assert mock_sdk_crash_reporter.report.call_count == 0

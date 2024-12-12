from collections.abc import Sequence
from functools import wraps
from unittest.mock import patch

import pytest

from fixtures.sdk_crash_detection.crash_event_react_native import (
    get_crash_event,
    get_exception,
    get_frames,
)
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
            "issues.sdk_crash_detection.cocoa.project_id": 1234,
            "issues.sdk_crash_detection.cocoa.sample_rate": 1.0,
            "issues.sdk_crash_detection.react-native.project_id": 2,
            "issues.sdk_crash_detection.react-native.sample_rate": 0.2,
            "issues.sdk_crash_detection.react-native.organization_allowlist": [1],
        }
    ):
        return build_sdk_crash_detection_configs()


@pytest.mark.parametrize(
    ["filename", "expected_stripped_filename", "detected"],
    [
        (
            "/Users/sentry.user/git-repos/sentry-react-native/dist/js/client.js",
            "/sentry-react-native/dist/js/client.js",
            True,
        ),
        (
            "/Users/sentry.user/git-repos/sentry-react-native/samples/react-native/src/Screens/HomeScreen.tsx",
            "empty_on_purpose",
            False,
        ),
    ],
)
@decorators
def test_sdk_crash_is_reported_development_paths(
    mock_sdk_crash_reporter,
    mock_random,
    store_event,
    configs,
    filename,
    expected_stripped_filename,
    detected,
):
    event = store_event(data=get_crash_event(filename=filename))

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
        reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]

        stripped_frames = get_path(
            reported_event_data, "exception", "values", -1, "stacktrace", "frames"
        )

        assert len(stripped_frames) == 6
        assert stripped_frames[0]["function"] == "dispatchEvent"
        assert stripped_frames[1]["function"] == "community.lib.dosomething"
        assert stripped_frames[2]["function"] == "nativeCrash"

        sdk_frame = stripped_frames[3]
        assert sdk_frame["function"] == "ReactNativeClient#nativeCrash"
        assert sdk_frame["filename"] == expected_stripped_filename
        assert sdk_frame["abs_path"] == expected_stripped_filename
        assert sdk_frame["in_app"] is True

        system_lib_frame1 = stripped_frames[4]
        assert system_lib_frame1["function"] == "callFunctionReturnFlushedQueue"
        assert (
            system_lib_frame1["filename"]
            == "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js"
        )
        assert system_lib_frame1["in_app"] is False

        system_lib_frame2 = stripped_frames[5]
        assert system_lib_frame2["function"] == "processCallbacks"
        assert (
            system_lib_frame2["filename"]
            == "node_modules/react-native-community/BatchedBridge/MessageQueue.js"
        )
        assert system_lib_frame2["in_app"] is False
    else:
        assert mock_sdk_crash_reporter.report.call_count == 0


@pytest.mark.parametrize(
    ["package_name", "detected"],
    [
        (
            "/@sentry/react-native/",
            True,
        ),
        (
            "/@sentry/reactnative/",
            False,
        ),
        (
            "/@sentry/browser/",
            True,
        ),
        (
            "/@sentry/cli/",
            True,
        ),
        (
            "/@sentry/core/",
            True,
        ),
        (
            "/@sentry/hub/",
            True,
        ),
        (
            "/@sentry/integrations/",
            True,
        ),
        (
            "/@sentry/react/",
            True,
        ),
        (
            "/@sentry/types/",
            True,
        ),
        (
            "/@sentry/utils/",
            True,
        ),
    ],
)
@decorators
def test_sdk_crash_is_reported_production_paths(
    mock_sdk_crash_reporter, mock_random, store_event, configs, package_name, detected
):
    expected_stripped_filename = f"{package_name}dist/js/integrations/reactnativeerrorhandlers.js"
    # Remove the first / from the path because the module is not prefixed with /.
    expected_stripped_filename = expected_stripped_filename[1:]

    filename = f"node_modules/{expected_stripped_filename}"
    event = store_event(data=get_crash_event(filename=filename))

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
        reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]

        stripped_frames = get_path(
            reported_event_data, "exception", "values", -1, "stacktrace", "frames"
        )

        assert len(stripped_frames) == 6
        assert stripped_frames[0]["function"] == "dispatchEvent"
        assert stripped_frames[1]["function"] == "community.lib.dosomething"
        assert stripped_frames[2]["function"] == "nativeCrash"

        sdk_frame = stripped_frames[3]
        assert sdk_frame["function"] == "ReactNativeClient#nativeCrash"
        expected_module = expected_stripped_filename.replace(".js", "")
        assert sdk_frame["module"] == expected_module
        assert sdk_frame["filename"] == expected_stripped_filename
        assert sdk_frame["abs_path"] == expected_stripped_filename
    else:
        assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_beta_sdk_version_detected(mock_sdk_crash_reporter, mock_random, store_event, configs):
    event_data = get_crash_event()
    set_path(event_data, "sdk", "version", value="4.1.0-beta.0")
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
    set_path(event_data, "sdk", "version", value="3.9.9")
    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_organization_not_in_allowlist_not_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
):
    event = store_event(data=get_crash_event())

    configs[1].organization_allowlist = [event.project.organization_id + 1]

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_organization_empty_allowlist_not_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
):
    event = store_event(data=get_crash_event())

    configs[1].organization_allowlist = []

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=[],
    )

    assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_console_mechanism_not_detected(mock_sdk_crash_reporter, mock_random, store_event, configs):
    event_data = get_crash_event(
        exception={
            "values": [
                get_exception(
                    frames=get_frames(
                        filename="/Users/user/repos/node_modules/@sentry/core/captureconsole.ts"
                    ),
                    mechanism_type="onerror",
                ),
                get_exception(
                    frames=get_frames(
                        filename="/Users/user/repos/node_modules/@sentry/core/captureconsole.ts"
                    ),
                    mechanism_type="console",
                ),
            ]
        }
    )

    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_console_mechanism_detected(mock_sdk_crash_reporter, mock_random, store_event, configs):
    event_data = get_crash_event(
        exception={
            "values": [
                get_exception(
                    frames=get_frames(
                        filename="/Users/user/repos/node_modules/@sentry/core/captureconsole.ts"
                    ),
                    mechanism_type="console",
                ),
                get_exception(
                    frames=get_frames(
                        filename="/Users/user/repos/node_modules/@sentry/core/captureconsole.ts"
                    ),
                    mechanism_type="onerror",
                ),
            ]
        }
    )

    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    assert mock_sdk_crash_reporter.report.call_count == 1


@decorators
def test_missing_exception_not_detected(mock_sdk_crash_reporter, mock_random, store_event, configs):
    event_data = get_crash_event(exception={"values": []})

    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    assert mock_sdk_crash_reporter.report.call_count == 0

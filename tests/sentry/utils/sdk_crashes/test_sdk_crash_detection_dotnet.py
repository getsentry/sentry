from collections.abc import Sequence
from functools import wraps
from unittest.mock import patch

import pytest

from fixtures.sdk_crash_detection.crash_event_dotnet import get_crash_event, get_unity_crash_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.safe import get_path
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
            "issues.sdk_crash_detection.dotnet.project_id": 6,
            "issues.sdk_crash_detection.dotnet.sample_rate": 0.6,
            "issues.sdk_crash_detection.dotnet.organization_allowlist": [5],
        }
    ):
        return build_sdk_crash_detection_configs()


@pytest.mark.parametrize(
    ["sdk_frame_module", "system_frame_module", "detected"],
    [
        # Standard .NET SDK frames
        (
            "Sentry.SentryClient",
            "System.Threading.Tasks.Task",
            True,
        ),
        (
            "Sentry.AspNetCore.SentryMiddleware",
            "Microsoft.AspNetCore.Http.HttpContext",
            True,
        ),
        (
            "Sentry.Extensions.Logging.SentryLogger",
            "Microsoft.Extensions.Logging.ILogger",
            True,
        ),
        # Unity SDK frames
        (
            "Sentry.Unity.SentryUnity",
            "UnityEngine.MonoBehaviour",
            True,
        ),
        # System frames only - should not be detected
        (
            "System.Threading.Tasks.Task",
            "Microsoft.AspNetCore.Http.HttpContext",
            False,
        ),
        # Non-Sentry SDK frames - should not be detected
        (
            "MyApp.SomeClass",
            "System.Threading.Tasks.Task",
            False,
        ),
        # Misspelled Sentry - should not be detected
        (
            "Sentri.SentryClient",
            "System.Threading.Tasks.Task",
            False,
        ),
    ],
)
@decorators
def test_sdk_crash_is_reported_with_dotnet_paths(
    mock_sdk_crash_reporter,
    mock_random,
    store_event,
    configs,
    sdk_frame_module: str,
    system_frame_module: str,
    detected: bool,
):
    event = store_event(
        data=get_crash_event(
            sdk_frame_module=sdk_frame_module, system_frame_module=system_frame_module
        )
    )

    # Find the dotnet config (should be the last one added)
    dotnet_config = None
    for config in configs:
        if config.sdk_name.value == "dotnet":
            dotnet_config = config
            break

    assert dotnet_config is not None, "Dotnet config should be present"
    dotnet_config.organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
        reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]

        stripped_frames = get_path(
            reported_event_data, "exception", "values", -1, "stacktrace", "frames"
        )

        assert len(stripped_frames) == 5

        system_frame1 = stripped_frames[0]
        assert system_frame1["function"] == "Main"
        assert system_frame1["module"] == "System.Threading.ThreadPoolWorkQueue"
        assert system_frame1["filename"] == "ThreadPoolWorkQueue.cs"
        assert system_frame1["abs_path"] == "ThreadPoolWorkQueue.cs"
        assert system_frame1["in_app"] is False

        sdk_frame = stripped_frames[3]
        assert sdk_frame["function"] == "CaptureException"
        assert sdk_frame["module"] == sdk_frame_module
        assert sdk_frame["filename"] == "SentryClient.cs"
        assert "abs_path" not in sdk_frame
        assert sdk_frame["in_app"] is True

        system_frame2 = stripped_frames[4]
        assert system_frame2["function"] == "InvokeAsync"
        assert system_frame2["module"] == system_frame_module
        assert system_frame2["filename"] == "SentryMiddleware.cs"
        assert system_frame2["in_app"] is False

    else:
        assert mock_sdk_crash_reporter.report.call_count == 0


@pytest.mark.parametrize(
    ["sdk_frame_module", "unity_frame_module", "detected"],
    [
        # Unity SDK frames
        (
            "Sentry.Unity.SentryUnity",
            "UnityEngine.Events.InvokableCall",
            True,
        ),
        (
            "Sentry.SentryClient",
            "UnityEngine.MonoBehaviour",
            True,
        ),
        # Unity system frames only - should not be detected
        (
            "UnityEngine.MonoBehaviour",
            "UnityEngine.Events.InvokableCall",
            False,
        ),
        # Non-Unity, Non-Sentry - should not be detected
        (
            "MyGame.GameManager",
            "UnityEngine.Events.InvokableCall",
            False,
        ),
    ],
)
@decorators
def test_sdk_crash_is_reported_with_unity_paths(
    mock_sdk_crash_reporter,
    mock_random,
    store_event,
    configs,
    sdk_frame_module: str,
    unity_frame_module: str,
    detected: bool,
):
    event = store_event(
        data=get_unity_crash_event(
            sdk_frame_module=sdk_frame_module, unity_frame_module=unity_frame_module
        )
    )

    # Find the dotnet config
    dotnet_config = None
    for config in configs:
        if config.sdk_name.value == "dotnet":
            dotnet_config = config
            break

    assert dotnet_config is not None, "Dotnet config should be present"
    dotnet_config.organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
        reported_event_data = mock_sdk_crash_reporter.report.call_args.args[0]

        stripped_frames = get_path(
            reported_event_data, "exception", "values", -1, "stacktrace", "frames"
        )

        assert len(stripped_frames) == 5

        unity_frame = stripped_frames[0]
        assert unity_frame["function"] == "Update"
        assert unity_frame["module"] == "UnityEngine.EventSystems.EventSystem"
        assert unity_frame["in_app"] is False

        sdk_frame = stripped_frames[3]
        assert sdk_frame["function"] == "CaptureException"
        assert sdk_frame["module"] == sdk_frame_module
        assert sdk_frame["in_app"] is True

    else:
        assert mock_sdk_crash_reporter.report.call_count == 0

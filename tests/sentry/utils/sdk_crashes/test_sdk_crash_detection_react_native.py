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
    filename: str,
    expected_stripped_filename: str,
    detected: bool,
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
    mock_sdk_crash_reporter, mock_random, store_event, configs, package_name: str, detected: bool
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
def test_beta_sdk_version_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
) -> None:
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
def test_console_mechanism_not_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
) -> None:
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
def test_sentry_wrapped_not_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
) -> None:
    event_data = get_crash_event(
        exception={
            "values": [
                get_exception(
                    frames=[
                        *get_frames(),
                        {
                            "function": "sentryWrapped",
                            "module": "@sentry/browser/src/helpers",
                            "filename": "@sentry/browser/src/helpers.ts",
                            "abs_path": "app:///@sentry/browser/src/helpers.ts",
                        },
                    ],
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


@pytest.mark.parametrize(
    ["function", "module", "filename", "detected"],
    [
        # fetch instrumentation pass-through (ESM build) — should be ignored
        (
            "fetch",
            "@sentry/core/build/esm/instrument/fetch",
            "node_modules/@sentry/core/build/esm/instrument/fetch.js",
            False,
        ),
        # fetch instrumentation pass-through (CJS build) — should be ignored
        (
            "fetch",
            "@sentry/core/build/cjs/instrument/fetch",
            "node_modules/@sentry/core/build/cjs/instrument/fetch.js",
            False,
        ),
        # fetch instrumentation promise rejection handler (ESM build) — should be ignored.
        # A user's failed fetch rejects, the SDK's anonymous rejection handler rethrows, and
        # the error surfaces via onunhandledrejection with this frame on top. See SDK-CRASHES-REACT-NATIVE-F7.
        (
            "<anonymous>",
            "@sentry/core/build/esm/instrument/fetch",
            "node_modules/@sentry/core/build/esm/instrument/fetch.js",
            False,
        ),
        # fetch instrumentation promise rejection handler (CJS build) — should be ignored
        (
            "<anonymous>",
            "@sentry/core/build/cjs/instrument/fetch",
            "node_modules/@sentry/core/build/cjs/instrument/fetch.js",
            False,
        ),
        # Different function in the same module — should be detected
        (
            "instrumentFetch",
            "@sentry/core/build/esm/instrument/fetch",
            "node_modules/@sentry/core/build/esm/instrument/fetch.js",
            True,
        ),
        # XHR instrumentation — should be detected (not covered by the ignore pattern)
        (
            "fetch",
            "@sentry/core/build/esm/instrument/xhr",
            "node_modules/@sentry/core/build/esm/instrument/xhr.js",
            True,
        ),
    ],
)
@decorators
def test_fetch_instrumentation_not_detected(
    mock_sdk_crash_reporter,
    mock_random,
    store_event,
    configs,
    function: str,
    module: str,
    filename: str,
    detected: bool,
) -> None:
    event_data = get_crash_event(
        exception={
            "values": [
                get_exception(
                    frames=[
                        *get_frames(),
                        {
                            "function": function,
                            "module": module,
                            "filename": filename,
                            "abs_path": f"app:///{filename}",
                        },
                    ],
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

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
    else:
        assert mock_sdk_crash_reporter.report.call_count == 0


@pytest.mark.parametrize(
    ["function", "module", "filename", "detected"],
    [
        # Supabase PostgREST .then handler (ESM build) — should be ignored
        (
            "Reflect.apply.then$argument_0",
            "@sentry/core/build/esm/integrations/supabase",
            "node_modules/@sentry/core/build/esm/integrations/supabase.js",
            False,
        ),
        # Supabase PostgREST .then handler (CJS build) — should be ignored
        (
            "Reflect.apply.then$argument_0",
            "@sentry/core/build/cjs/integrations/supabase",
            "node_modules/@sentry/core/build/cjs/integrations/supabase.js",
            False,
        ),
        # Different function in the same module — should be detected
        (
            "instrumentPostgRESTFilterBuilder",
            "@sentry/core/build/esm/integrations/supabase",
            "node_modules/@sentry/core/build/esm/integrations/supabase.js",
            True,
        ),
        # Same function in a different module — should be detected
        (
            "Reflect.apply.then$argument_0",
            "@sentry/core/build/esm/integrations/graphql",
            "node_modules/@sentry/core/build/esm/integrations/graphql.js",
            True,
        ),
    ],
)
@decorators
def test_supabase_instrumentation_not_detected(
    mock_sdk_crash_reporter,
    mock_random,
    store_event,
    configs,
    function: str,
    module: str,
    filename: str,
    detected: bool,
) -> None:
    event_data = get_crash_event(
        exception={
            "values": [
                get_exception(
                    frames=[
                        *get_frames(),
                        {
                            "function": function,
                            "module": module,
                            "filename": filename,
                            "abs_path": f"app:///{filename}",
                        },
                    ],
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

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
    else:
        assert mock_sdk_crash_reporter.report.call_count == 0


@decorators
def test_sentry_wrapped_end_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
) -> None:
    event_data = get_crash_event(
        exception={
            "values": [
                get_exception(
                    frames=[
                        *get_frames(),
                        {
                            # sentryWrappedPostfix is not related to sentryWrapped and should be detected
                            # if this causes a crash, it could be a bug in the SDK
                            "function": "sentryWrappedPostfix",
                            "module": "@sentry/browser/src/helpers",
                            "filename": "@sentry/browser/src/helpers.ts",
                            "abs_path": "app:///@sentry/browser/src/helpers.ts",
                        },
                    ],
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
def test_console_mechanism_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
) -> None:
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
def test_missing_exception_not_detected(
    mock_sdk_crash_reporter, mock_random, store_event, configs
) -> None:
    event_data = get_crash_event(exception={"values": []})

    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    assert mock_sdk_crash_reporter.report.call_count == 0


# React Native's dev server (Metro) re-runs the app's entry code — including Sentry.init and SDK
# integration setup — on hot reload / Fast Refresh by pushing a message over its websocket. React
# Native delivers that message as a device event (RCTDeviceEventEmitter#emit) to the WebSocket
# module's listener. These frames reproduce that dev-server call chain. Like real events, they
# carry the module path in filename/abs_path and have no `module` field.
_DEV_SERVER_WEBSOCKET_FRAMES = [
    {
        "function": "RCTDeviceEventEmitterImpl#emit",
        "filename": "/Users/dev/project/node_modules/react-native/Libraries/EventEmitter/RCTDeviceEventEmitter.js",
        "abs_path": "/Users/dev/project/node_modules/react-native/Libraries/EventEmitter/RCTDeviceEventEmitter.js",
    },
    {
        "function": "emit",
        "filename": "/Users/dev/project/node_modules/react-native/Libraries/vendor/emitter/EventEmitter.js",
        "abs_path": "/Users/dev/project/node_modules/react-native/Libraries/vendor/emitter/EventEmitter.js",
    },
    {
        "function": "_eventEmitter.addListener$argument_1",
        "filename": "/Users/dev/project/node_modules/react-native/Libraries/WebSocket/WebSocket.js",
        "abs_path": "/Users/dev/project/node_modules/react-native/Libraries/WebSocket/WebSocket.js",
    },
]

# A normal app-startup caller (crashes reached from here are genuine SDK crashes).
_APP_STARTUP_FRAME = {
    "function": "<global>",
    "filename": "index.js",
    "abs_path": "app:///index.js",
}

# An app's own WebSocket onmessage handler. In production the RN WebSocket listener dispatches
# every incoming message through app code like this before any SDK frame is reached.
_APP_WEBSOCKET_HANDLER_FRAME = {
    "function": "onmessage",
    "filename": "src/realtime/socket.js",
    "abs_path": "app:///src/realtime/socket.js",
}


def _sdk_frame(function: str, filename: str) -> dict[str, str]:
    # Real React Native JS frames carry the SDK module path in filename/abs_path, no `module`.
    return {"function": function, "filename": filename, "abs_path": filename}


# The distinct SDK crash origins observed across the real dev-server hot-reload events.
_INIT_CRASH_FRAMES = [
    _sdk_frame("init", "@sentry/react-native/dist/js/sdk.js"),
    _sdk_frame("ReactNativeClient#_initNativeSdk", "@sentry/react-native/dist/js/client.js"),
]
_GET_DEFAULT_INTEGRATIONS_CRASH_FRAMES = [
    _sdk_frame("__awaiter$argument_3", "@sentry/react-native/dist/js/wrapper.js"),
    _sdk_frame("getDefaultIntegrations", "@sentry/react-native/dist/js/integrations/default.js"),
]
_ENCODED_AUTH_CRASH_FRAMES = [
    _sdk_frame("init", "@sentry/react-native/dist/js/sdk.js"),
    _sdk_frame("_encodedAuth", "@sentry/core/build/esm/api.js"),
]


@pytest.mark.parametrize(
    ["frames", "detected"],
    [
        # Crash inside init, re-run by the Metro dev-server websocket — should be ignored.
        ([*_DEV_SERVER_WEBSOCKET_FRAMES, *_INIT_CRASH_FRAMES], False),
        # Crash inside getDefaultIntegrations (no init frame at all) via the dev-server websocket
        # — should be ignored. The match must not depend on which SDK frame throws.
        ([*_DEV_SERVER_WEBSOCKET_FRAMES, *_GET_DEFAULT_INTEGRATIONS_CRASH_FRAMES], False),
        # Crash inside @sentry/core _encodedAuth via the dev-server websocket — should be ignored.
        ([*_DEV_SERVER_WEBSOCKET_FRAMES, *_ENCODED_AUTH_CRASH_FRAMES], False),
        # Genuine crash inside Sentry.init reached from app startup (no dev-server websocket
        # frames) — should be detected.
        ([_APP_STARTUP_FRAME, *_INIT_CRASH_FRAMES], True),
        # Only the device event emitter frame, without the WebSocket listener — should be
        # detected (both dev-server frames are required to ignore).
        ([_DEV_SERVER_WEBSOCKET_FRAMES[0], *_GET_DEFAULT_INTEGRATIONS_CRASH_FRAMES], True),
        # Only the WebSocket listener frame, without the device event emitter — should be
        # detected (both dev-server frames are required to ignore).
        ([_DEV_SERVER_WEBSOCKET_FRAMES[2], *_GET_DEFAULT_INTEGRATIONS_CRASH_FRAMES], True),
        # Production websocket path: both dev-server frames are present, but the WebSocket listener
        # dispatches through the app's own onmessage handler before the SDK crashes. The listener
        # is not directly followed by an SDK frame, so a genuine SDK crash must still be detected.
        (
            [
                *_DEV_SERVER_WEBSOCKET_FRAMES,
                _APP_WEBSOCKET_HANDLER_FRAME,
                *_INIT_CRASH_FRAMES,
            ],
            True,
        ),
    ],
)
@decorators
def test_dev_server_hot_reload_not_detected(
    mock_sdk_crash_reporter,
    mock_random,
    store_event,
    configs,
    frames,
    detected: bool,
) -> None:
    event_data = get_crash_event(exception={"values": [get_exception(frames=frames)]})

    event = store_event(data=event_data)

    configs[1].organization_allowlist = [event.project.organization_id]

    sdk_crash_detection.detect_sdk_crash(
        event=event,
        configs=configs,
    )

    if detected:
        assert mock_sdk_crash_reporter.report.call_count == 1
    else:
        assert mock_sdk_crash_reporter.report.call_count == 0

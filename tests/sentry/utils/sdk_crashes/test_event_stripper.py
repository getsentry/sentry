import copy

import pytest

from fixtures.sdk_crash_detection.crash_event import (
    get_crash_event,
    get_crash_event_with_frames,
    get_frames,
)
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.safe import get_path, set_path
from sentry.utils.sdk_crashes.configs import (
    cocoa_sdk_crash_detector_config,
    react_native_sdk_crash_detector_config,
)
from sentry.utils.sdk_crashes.event_stripper import strip_event_data
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


@pytest.fixture
def store_event(default_project, factories):
    def inner(data):
        return factories.store_event(data=data, project_id=default_project.id)

    return inner


@pytest.fixture
def store_and_strip_event(store_event):
    def inner(data, config=cocoa_sdk_crash_detector_config):
        event = store_event(data=data)
        return strip_event_data(event.data, SDKCrashDetector(config=config))

    return inner


@django_db_all
@pytest.mark.snuba
def test_strip_event_data_keeps_allowed_keys(store_and_strip_event):
    stripped_event_data = store_and_strip_event(data=get_crash_event())

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


@django_db_all
@pytest.mark.snuba
def test_strip_event_data_strips_context(store_and_strip_event):
    stripped_event_data = store_and_strip_event(data=get_crash_event())

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
            "simulator": True,
        },
    }


@django_db_all
@pytest.mark.snuba
def test_strip_event_data_strips_sdk(store_and_strip_event):
    stripped_event_data = store_and_strip_event(data=get_crash_event())

    assert stripped_event_data.get("sdk") == {
        "name": "sentry.cocoa",
        "version": "8.2.0",
    }


@django_db_all
@pytest.mark.snuba
def test_strip_event_data_strips_value_if_not_simple_type(store_event):
    event = store_event(data=get_crash_event())
    event.data["type"] = {"foo": "bar"}

    stripped_event_data = strip_event_data(
        event.data, SDKCrashDetector(config=cocoa_sdk_crash_detector_config)
    )

    assert stripped_event_data.get("type") is None


@django_db_all
@pytest.mark.snuba
def test_strip_event_data_keeps_simple_types(store_event):
    event = store_event(data=get_crash_event())
    event.data["type"] = True
    event.data["datetime"] = 0.1
    event.data["timestamp"] = 1
    event.data["platform"] = "cocoa"

    stripped_event_data = strip_event_data(
        event.data, SDKCrashDetector(config=cocoa_sdk_crash_detector_config)
    )

    assert stripped_event_data.get("type") is True
    assert stripped_event_data.get("datetime") == 0.1
    assert stripped_event_data.get("timestamp") == 1
    assert stripped_event_data.get("platform") == "cocoa"


@django_db_all
@pytest.mark.snuba
def test_strip_event_data_keeps_simple_exception_properties(store_and_strip_event):
    stripped_event_data = store_and_strip_event(data=get_crash_event())

    assert get_path(stripped_event_data, "exception", "values", 0, "type") == "EXC_BAD_ACCESS"
    assert get_path(stripped_event_data, "exception", "values", 0, "value") is None


@django_db_all
@pytest.mark.snuba
def test_strip_event_data_keeps_exception_mechanism(store_event):
    event = store_event(data=get_crash_event())

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

    stripped_event_data = strip_event_data(
        event.data, SDKCrashDetector(config=cocoa_sdk_crash_detector_config)
    )

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


@django_db_all
@pytest.mark.snuba
def test_set_in_app_only_for_sdk_frames(store_and_strip_event):
    frames = get_frames("SentryCrashMonitor_CPPException.cpp", sentry_frame_in_app=False)

    system_frame_in_app = [
        {
            "abs_path": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
            "in_app": True,
        }
    ]

    event_data = get_crash_event_with_frames(system_frame_in_app + list(frames))

    stripped_event_data = store_and_strip_event(data=event_data)

    stripped_frames = get_path(
        stripped_event_data, "exception", "values", -1, "stacktrace", "frames"
    )

    for stripped_frame in stripped_frames[0::-1]:
        assert stripped_frame["in_app"] is False

    cocoa_sdk_frame = stripped_frames[-1]
    assert cocoa_sdk_frame == {
        "function": "SentryCrashMonitor_CPPException.cpp",
        "package": "Sentry.framework",
        "in_app": True,
        "image_addr": "0x100304000",
    }


@django_db_all
@pytest.mark.snuba
def test_strip_event_data_keeps_exception_stacktrace(store_and_strip_event):
    stripped_event_data = store_and_strip_event(data=get_crash_event())

    first_frame = get_path(stripped_event_data, "exception", "values", 0, "stacktrace", "frames", 0)

    assert first_frame == {
        "function": "function",
        "raw_function": "raw_function",
        "module": "module",
        "abs_path": "abs_path",
        "filename": "EventStripperTestFrame.swift",
        "in_app": False,
        "instruction_addr": "0x1a4e8f000",
        "addr_mode": "0x1a4e8f000",
        "symbol": "symbol",
        "symbol_addr": "0x1a4e8f000",
        "image_addr": "0x1a4e8f000",
        "package": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
        "platform": "platform",
    }


@django_db_all
@pytest.mark.snuba
def test_strip_frames(store_and_strip_event):
    frames = get_frames("SentryCrashMonitor_CPPException.cpp", sentry_frame_in_app=False)

    frames_kept = [
        {
            "abs_path": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
        },
        {
            "module": "/usr/lib/system/libsystem_c.dylib",
        },
    ]

    frames_stripped = [
        {
            "abs_path": "/System/Librry/PrivateFrameworks/UIKitCore.framework/UIKitCore",
        },
        {
            "module": "a/usr/lib/system/libsystem_c.dylib",
        },
    ]

    event_data = get_crash_event_with_frames(frames_kept + frames_stripped + list(frames))

    stripped_event_data = store_and_strip_event(data=event_data)

    stripped_frames = get_path(
        stripped_event_data, "exception", "values", -1, "stacktrace", "frames"
    )

    assert len(stripped_frames) == 10

    cocoa_sdk_frames = stripped_frames[-2:]
    assert cocoa_sdk_frames == [
        {
            "function": "__49-[SentrySwizzleWrapper swizzleSendAction:forKey:]_block_invoke_2",
            "package": "Sentry.framework",
            "in_app": True,
            "image_addr": "0x100304000",
        },
        {
            "function": "SentryCrashMonitor_CPPException.cpp",
            "package": "Sentry.framework",
            "in_app": True,
            "image_addr": "0x100304000",
        },
    ]


@django_db_all
@pytest.mark.snuba
def test_strip_frames_sdk_frames(store_and_strip_event):
    frames = get_frames("SentryCrashMonitor_CPPException.cpp", sentry_frame_in_app=False)
    # When statically linked the package or module is usually set to the app name
    sentry_sdk_frame = frames[-1]
    sentry_sdk_frame["package"] = "SomeApp"
    sentry_sdk_frame["module"] = "SomeModule"
    sentry_sdk_frame["abs_path"] = "SomeApp/SentryDispatchQueueWrapper.m"

    event_data = get_crash_event_with_frames(frames)

    stripped_event_data = store_and_strip_event(data=event_data)

    stripped_frames = get_path(
        stripped_event_data, "exception", "values", -1, "stacktrace", "frames"
    )

    cocoa_sdk_frame = stripped_frames[-1]
    assert cocoa_sdk_frame == {
        "function": "SentryCrashMonitor_CPPException.cpp",
        "package": "Sentry.framework",
        "abs_path": "Sentry.framework",
        "module": "Sentry.framework",
        "filename": "Sentry.framework",
        "in_app": True,
        "image_addr": "0x100304000",
    }


@django_db_all
@pytest.mark.snuba
def test_strip_frames_sdk_frames_keep_after_matcher(store_and_strip_event):
    frames = get_frames("SentryCrashMonitor_CPPException.cpp", sentry_frame_in_app=False)

    sentry_sdk_frame = frames[-1]

    sentry_sdk_frame[
        "module"
    ] = "Users/sentry/git-repos/sentry-react-native/dist/js/integrations/reactnative"
    sentry_sdk_frame[
        "filename"
    ] = "/Users/sentry/git-repos/sentry-react-native/dist/js/integrations/reactnative.js"
    sentry_sdk_frame[
        "abs_path"
    ] = "app:///Users/sentry/git-repos/sentry-react-native/dist/js/integrations/reactnative.js"

    event_data = get_crash_event_with_frames(frames)

    config = copy.deepcopy(react_native_sdk_crash_detector_config)
    stripped_event_data = store_and_strip_event(data=event_data, config=config)

    stripped_frames = get_path(
        stripped_event_data, "exception", "values", -1, "stacktrace", "frames"
    )

    cocoa_sdk_frame = stripped_frames[-1]
    assert cocoa_sdk_frame == {
        "function": "SentryCrashMonitor_CPPException.cpp",
        "module": "/sentry-react-native/dist/js/integrations/reactnative",
        "filename": "/sentry-react-native/dist/js/integrations/reactnative.js",
        "abs_path": "/sentry-react-native/dist/js/integrations/reactnative.js",
        "package": "sentry-react-native",
        "in_app": True,
        "image_addr": "0x100304000",
    }


@django_db_all
@pytest.mark.snuba
def test_strip_event_without_data_returns_empty_dict(store_and_strip_event):
    stripped_event_data = store_and_strip_event(data={})

    assert stripped_event_data == {}


@django_db_all
@pytest.mark.snuba
def test_strip_event_without_frames_returns_empty_dict(store_and_strip_event):
    event_data = get_crash_event_with_frames([])
    set_path(event_data, "exception", value=None)

    stripped_event_data = store_and_strip_event(data=event_data)

    assert stripped_event_data == {}

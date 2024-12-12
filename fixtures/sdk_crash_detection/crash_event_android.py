import time
from collections.abc import Mapping, MutableMapping, Sequence


def get_frames(
    sdk_frame_module: str, system_frame_module: str
) -> Sequence[MutableMapping[str, str]]:
    frames = [
        {
            "function": "main",
            "module": "android.app.ActivityThread",
            "filename": "ActivityThread.java",
            "abs_path": "ActivityThread.java",
        },
        {
            "function": "handleCallback",
            "module": "android.os.Handler",
            "filename": "Handler.java",
            "abs_path": "Handler.java",
        },
        {
            "function": "performClickInternal",
            "module": "android.view.View",
            "filename": "View.java",
            "abs_path": "View.java",
        },
        {
            "function": "onClick",
            "module": "com.some.samples.android.MainActivity$$ExternalSyntheticLambda8",
        },
        {
            "function": "captureMessage",
            "module": sdk_frame_module,
            "filename": "Hub.java",
            "abs_path": "Hub.java",
        },
        {
            "function": "invoke",
            "module": system_frame_module,
            "filename": "Method.java",
        },
    ]
    return frames


def get_crash_event(
    sdk_frame_module="io.sentry.Hub",
    system_frame_module="java.lang.reflect.Method",
    **kwargs,
) -> dict[str, object]:
    return get_crash_event_with_frames(
        get_frames(sdk_frame_module, system_frame_module),
        **kwargs,
    )


def get_apex_frames(
    apex_frame_function: str,
    apex_frame_package: str,
    system_frame_package: str,
) -> Sequence[MutableMapping[str, str]]:
    frames = [
        {
            "function": "__pthread_start",
            "raw_function": "__pthread_start(void*)",
            "symbol": "_ZL15__pthread_startPv",
            "package": "/apex/com.android.runtime/lib/bionic/libc.so",
        },
        {
            "function": "__start_thread",
            "symbol": "__start_thread",
            "package": "/apex/com.android.art/lib64/bionic/libc.so",
        },
        {
            "function": apex_frame_function,
            "symbol": apex_frame_function,
            "package": apex_frame_package,
        },
        {
            "function": "invoke",
            "package": system_frame_package,
        },
    ]
    return frames


def get_apex_crash_event(
    apex_frame_function="__start_thread",
    apex_frame_package="/apex/com.android.art/lib64/bionic/libc.so",
    system_frame_package="/apex/com.android.art/lib64/libart.so",
    **kwargs,
) -> dict[str, object]:
    return get_crash_event_with_frames(
        get_apex_frames(apex_frame_function, apex_frame_package, system_frame_package),
        **kwargs,
    )


def get_exception(
    frames: Sequence[Mapping[str, str]],
    mechanism=None,
) -> dict[str, object]:
    if mechanism is None:
        # linter complains about mutable arguments otherwise
        mechanism = {"type": "onerror", "handled": False}
    return {
        "type": "IllegalArgumentException",
        "value": "SDK Crash",
        "module": "java.lang",
        "stacktrace": {"frames": frames},
        "mechanism": mechanism,
    }


def get_crash_event_with_frames(frames: Sequence[Mapping[str, str]], **kwargs) -> dict[str, object]:
    result = {
        "event_id": "0a52a8331d3b45089ebd74f8118d4fa1",
        "release": "io.sentry.samples.android@7.4.0+2",
        "dist": "2",
        "platform": "java",
        "environment": "debug",
        "exception": {"values": [get_exception(frames)]},
        "key_id": "1336851",
        "level": "fatal",
        "contexts": {
            "device": {
                "name": "sdk_gphone64_arm64",
                "family": "sdk_gphone64_arm64",
                "model": "sdk_gphone64_arm64",
                "simulator": True,
            },
            "os": {
                "name": "Android",
                "version": "13",
                "build": "sdk_gphone64_arm64-userdebug UpsideDownCake UPB2.230407.019 10170211 dev-keys",
                "kernel_version": "6.1.21-android14-3-01811-g9e35a21ec03f-ab9850788",
                "rooted": False,
                "type": "os",
            },
        },
        "sdk": {"name": "sentry.java.android", "version": "7.4.0"},
        "timestamp": time.time(),
        "type": "error",
    }

    result.update(kwargs)
    return result

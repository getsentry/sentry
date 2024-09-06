import time
from collections.abc import Mapping, MutableMapping, Sequence


def get_frames(
    sdk_frame_abs_path: str, system_frame_abs_path: str, sdk_function: str
) -> Sequence[MutableMapping[str, str]]:
    frames = [
        {
            "function": "GestureRecognizer.invokeCallback",
            "package": "flutter",
            "filename": "recognizer.dart",
            "abs_path": "package:flutter/src/gestures/recognizer.dart",
        },
        {
            "function": "_InkResponseState.handleTap",
            "package": "flutter",
            "filename": "ink_well.dart",
            "abs_path": "package:flutter/src/material/ink_well.dart",
        },
        {
            "function": "MainScaffold.build.<fn>",
            "package": "sentry_flutter_example",
            "filename": "main.dart",
            "abs_path": "package:sentry_flutter_example/main.dart",
        },
        {
            "function": sdk_function,
            "filename": "sentry_tracer.dart",
            "abs_path": sdk_frame_abs_path,
        },
        {
            "function": "List.[]",
            "filename": "growable_array.dart",
            "abs_path": system_frame_abs_path,
        },
    ]
    return frames


def get_crash_event(
    sdk_frame_abs_path="package:sentry/src/sentry_tracer.dart",
    system_frame_abs_path="dart:core-patch/growable_array.dart",
    sdk_function="SentryTracer.setTag",
    **kwargs,
) -> dict[str, object]:
    return get_crash_event_with_frames(
        get_frames(sdk_frame_abs_path, system_frame_abs_path, sdk_function=sdk_function),
        **kwargs,
    )


def get_crash_event_with_frames(frames: Sequence[Mapping[str, str]], **kwargs) -> dict[str, object]:
    result = {
        "event_id": "0a52a8331d3b45089ebd74f8118d4fa1",
        "release": "io.sentry.flutter.sentryFlutterExample@8.2.0+8.2.0",
        "platform": "other",
        "exception": {
            "values": [
                {
                    "type": "RangeError",
                    "value": "RangeError (index): Invalid value: Not in inclusive range 0..1: 2",
                    "stacktrace": {"frames": frames},
                    "mechanism": {"type": "PlatformDispatcher.onError", "handled": True},
                }
            ]
        },
        "level": "fatal",
        "contexts": {
            "device": {
                "family": "macOS",
                "model": "Mac14,5",
                "arch": "arm64",
                "simulator": False,
                "memory_size": 68719476736,
                "free_memory": 839892992,
                "usable_memory": 65829797888,
                "processor_count": 12,
                "type": "device",
            },
            "os": {
                "name": "macOS",
                "version": "14.4.1",
                "build": "23E224",
                "kernel_version": "Darwin Kernel Version 23.4.0: Fri Mar 15 00:12:49 PDT 2024; root:xnu-10063.101.17~1/RELEASE_ARM64_T6020",
                "rooted": False,
                "theme": "light",
                "type": "os",
            },
        },
        "sdk": {"name": "sentry.dart.flutter", "version": "8.2.1"},
        "timestamp": time.time(),
        "type": "error",
    }

    result.update(kwargs)
    return result

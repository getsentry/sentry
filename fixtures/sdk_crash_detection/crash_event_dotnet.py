from typing import int
import time
from collections.abc import Mapping, MutableMapping, Sequence


def get_frames(
    sdk_frame_module: str, system_frame_module: str
) -> Sequence[MutableMapping[str, str]]:
    frames = [
        {
            "function": "Main",
            "module": "System.Threading.ThreadPoolWorkQueue",
            "filename": "ThreadPoolWorkQueue.cs",
            "abs_path": "ThreadPoolWorkQueue.cs",
        },
        {
            "function": "RunInternal",
            "module": "System.Threading.ExecutionContext",
            "filename": "ExecutionContext.cs",
            "abs_path": "ExecutionContext.cs",
        },
        {
            "function": "MoveNext",
            "module": "Microsoft.AspNetCore.Mvc.Internal.ControllerActionInvoker",
            "filename": "ControllerActionInvoker.cs",
            "abs_path": "ControllerActionInvoker.cs",
        },
        {
            "function": "PostIndex",
            "module": "Samples.AspNetCore.Mvc.Controllers.HomeController",
            "filename": "HomeController.cs",
            "abs_path": "HomeController.cs",
        },
        {
            "function": "CaptureException",
            "module": sdk_frame_module,
            "filename": "SentryClient.cs",
            "abs_path": "SentryClient.cs",
        },
        {
            "function": "InvokeAsync",
            "module": system_frame_module,
            "filename": "SentryMiddleware.cs",
        },
    ]
    return frames


def get_crash_event(
    sdk_frame_module="Sentry.SentryClient",
    system_frame_module="System.Runtime.CompilerServices.AsyncTaskMethodBuilder",
    **kwargs,
) -> dict[str, object]:
    return get_crash_event_with_frames(
        get_frames(sdk_frame_module, system_frame_module),
        **kwargs,
    )


def get_unity_frames(
    sdk_frame_module: str, unity_frame_module: str
) -> Sequence[MutableMapping[str, str]]:
    frames = [
        {
            "function": "Update",
            "module": "UnityEngine.EventSystems.EventSystem",
            "filename": "",
        },
        {
            "function": "OnPointerClick",
            "module": "UnityEngine.UI.Button",
            "filename": "",
        },
        {
            "function": "Invoke",
            "module": "UnityEngine.Events.UnityEvent",
            "filename": "",
        },
        {
            "function": "SendMessage",
            "module": "SentryTest",
            "filename": "",
        },
        {
            "function": "CaptureException",
            "module": sdk_frame_module,
            "filename": "",
        },
        {
            "function": "Invoke",
            "module": unity_frame_module,
            "filename": "",
        },
    ]
    return frames


def get_unity_crash_event(
    sdk_frame_module="Sentry.SentryClient",
    unity_frame_module="UnityEngine.Events.InvokableCall",
    **kwargs,
) -> dict[str, object]:
    return get_crash_event_with_frames(
        get_unity_frames(sdk_frame_module, unity_frame_module),
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
        "type": "System.DivideByZeroException",
        "value": "Attempted to divide by zero.",
        "module": "System",
        "stacktrace": {"frames": frames},
        "mechanism": mechanism,
    }


def get_crash_event_with_frames(frames: Sequence[Mapping[str, str]], **kwargs) -> dict[str, object]:
    result = {
        "event_id": "0a52a8331d3b45089ebd74f8118d4fa1",
        "release": "sentry.dotnet@3.22.0",
        "dist": "1",
        "platform": "csharp",
        "environment": "production",
        "exception": {"values": [get_exception(frames)]},
        "key_id": "1336851",
        "level": "error",
        "contexts": {
            "device": {
                "name": "DESKTOP-ABC123",
                "family": "Desktop",
                "model": "PC",
                "simulator": False,
            },
            "os": {
                "name": "Windows",
                "version": "10.0.19041",
                "build": "19041.1348",
                "kernel_version": "10.0.19041.1348",
                "type": "os",
            },
            "runtime": {
                "name": ".NET Core",
                "version": "6.0.5",
                "type": "runtime",
            },
        },
        "sdk": {"name": "sentry.dotnet", "version": "3.22.0"},
        "timestamp": time.time(),
        "type": "error",
    }

    result.update(kwargs)
    return result

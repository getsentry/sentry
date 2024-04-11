import time
from collections.abc import Mapping, MutableMapping, Sequence


def get_frames(
    sdk_frame_function: str,
    sdk_frame_package: str,
    system_frame_package: str,
) -> Sequence[MutableMapping[str, str]]:
    frames = [
        {
            "function": "RtlUserThreadStart",
            "symbol": "RtlUserThreadStart",
            "package": "C:\\WINDOWS\\SYSTEM32\\ntdll.dll",
        },
        {
            "function": "BaseThreadInitThunk",
            "symbol": "BaseThreadInitThunk",
            "package": "C:\\WINDOWS\\System32\\KERNEL32.DLL",
        },
        {
            "function": "snprintf",
            "symbol": "snprintf",
            "package": "D:\\Sentry\\Sentaurs\\Game\\Sentaurs.exe",
        },
        {
            "function": sdk_frame_function,
            "symbol": sdk_frame_function,
            "package": sdk_frame_package,
        },
        {
            "function": "boost::serialization::singleton<T>::singleton<T>",
            "symbol": "??0?$singleton@V?$extended_type_info_typeid@T_E_SC_SI_OPT_IR_MODE_SELECTOR@@@serialization@boost@@@serialization@boost@@IEAA@XZ",
            "package": system_frame_package,
        },
    ]
    return frames


def get_crash_event(
    sdk_frame_function="sentry_value_to_msgpack",
    sdk_frame_package="E:\\Sentry\\Sentaurs\\Game\\Sentaurs.exe",
    system_frame_package="C:\\Windows\\System32\\DriverStore\\FileRepository\\u0398226.inf_amd64_c5d9587384e4b5ff\\B398182\\amdxx64.dll",
    **kwargs,
) -> dict[str, object]:
    return get_crash_event_with_frames(
        get_frames(sdk_frame_function, sdk_frame_package, system_frame_package),
        **kwargs,
    )


def get_crash_event_with_frames(frames: Sequence[Mapping[str, str]], **kwargs) -> dict[str, object]:
    result = {
        "event_id": "0a52a8331d3b45089ebd74f8118d4fa1",
        "release": "14.7",
        "platform": "native",
        "exception": {
            "values": [
                {
                    "type": "EXCEPTION_ACCESS_VIOLATION_READ / 0x65707980",
                    "value": "Fatal Error: EXCEPTION_ACCESS_VIOLATION_READ / 0x65707980",
                    "stacktrace": {"frames": frames},
                    "mechanism": {"type": "minidump", "synthetic": True, "handled": False},
                }
            ]
        },
        "level": "fatal",
        "contexts": {
            "device": {"arch": "x86_64", "type": "device"},
            "os": {
                "name": "Windows",
                "version": "10.0.22631",
                "build": "3296",
                "kernel_version": "10.0.22621.3296",
                "type": "os",
            },
        },
        "sdk": {"name": "sentry.native", "version": "0.6.0"},
        "timestamp": time.time(),
        "type": "error",
    }

    result.update(kwargs)
    return result

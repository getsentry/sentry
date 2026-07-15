from typing import Any

from sentry.profiles.utils import (
    apply_stack_trace_rules_to_profile,
    is_android_trace_format,
    is_jvm_frame,
)


def test_apply_stack_trace_rules_to_profile_sample_format() -> None:
    profile: dict[str, Any] = {
        "version": "1",
        "platform": "python",
        "profile": {
            "frames": [
                {
                    "function": "functionA",
                    "abs_path": "/env/lib/python3.11/site-packages/urllib3/connection.py",
                    "module": "urllib3.connection",
                    "in_app": True,
                },
                {
                    "function": "<module>",
                    "abs_path": "/Documents/dev/python_concurrency/multiple_requests.py",
                    "module": "__main__",
                    "in_app": False,
                },
                {
                    "function": "system_function",
                    "abs_path": "/Python.framework/Versions/3.11/lib/python3.11/socket.py",
                    "module": "socket",
                    "in_app": True,
                },
            ],
        },
    }

    expected_frames = [
        {
            "function": "functionA",
            "abs_path": "/env/lib/python3.11/site-packages/urllib3/connection.py",
            "module": "urllib3.connection",
            "in_app": False,
            "data": {"orig_in_app": 1},
        },
        {
            "function": "<module>",
            "abs_path": "/Documents/dev/python_concurrency/multiple_requests.py",
            "module": "__main__",
            "in_app": True,
            "data": {"orig_in_app": 0},
        },
        {
            "function": "system_function",
            "abs_path": "/Python.framework/Versions/3.11/lib/python3.11/socket.py",
            "module": "socket",
            "in_app": False,
            "data": {"orig_in_app": 1},
        },
    ]

    profiling_rules = """
        stack.module:urllib3.connection -app
        stack.abs_path:/Documents/dev/python_concurrency/multiple_requests.py +app
        stack.function:system_function -app
        """
    apply_stack_trace_rules_to_profile(profile, profiling_rules)
    assert profile["profile"]["frames"] == expected_frames


def test_apply_stack_trace_rules_to_profile_android() -> None:
    profile: dict[str, Any] = {
        "platform": "android",
        "profile": {
            "methods": [
                {
                    "class_name": "com.example.android.myorg.MainFragment",
                    "name": "deleteAll",
                    "signature": "(com.example.android.myorg.MainFragment)",
                    "source_file": "MainFragment.java",
                    "in_app": False,
                },
                {
                    "class_name": "java.io.BufferedInputStream",
                    "name": "read1",
                    "signature": "(byte[], int, int): int",
                    "source_file": "BufferedInputStream.java",
                    "in_app": True,
                },
            ]
        },
    }

    expected_methods = [
        {
            "class_name": "com.example.android.myorg.MainFragment",
            "name": "deleteAll",
            "signature": "(com.example.android.myorg.MainFragment)",
            "source_file": "MainFragment.java",
            "in_app": True,
            "function": "deleteAll",
            "abs_path": "MainFragment.java",
            "module": "com.example.android.myorg.MainFragment",
            "data": {"orig_in_app": 0},
        },
        {
            "class_name": "java.io.BufferedInputStream",
            "name": "read1",
            "signature": "(byte[], int, int): int",
            "source_file": "BufferedInputStream.java",
            "in_app": False,
            "function": "read1",
            "abs_path": "BufferedInputStream.java",
            "module": "java.io.BufferedInputStream",
            "data": {"orig_in_app": 1},
        },
    ]

    profiling_rules = """
    stack.module:java.io.BufferedInputStream -app
    stack.function:deleteAll +app
    """

    apply_stack_trace_rules_to_profile(profile, profiling_rules)

    assert profile["profile"]["methods"] == expected_methods


def test_is_android_trace_format_explicit_marker() -> None:
    # The explicit marker wins regardless of platform.
    assert is_android_trace_format({"version": "2.android-trace", "platform": "android"})
    assert is_android_trace_format({"version": "2.android-trace", "platform": "node"})


def test_is_android_trace_format_fallback_no_version() -> None:
    # Legacy android payloads carry no version.
    assert is_android_trace_format({"platform": "android"})
    assert is_android_trace_format({"version": "", "platform": "android"})
    assert not is_android_trace_format({"platform": "cocoa"})


def test_is_android_trace_format_probes_structure() -> None:
    # a faulty version can't be trusted: a profile storing its frames in
    # "methods" is in trace format, no matter which version is set
    assert is_android_trace_format(
        {"version": "2", "platform": "android", "profile": {"methods": []}}
    )
    assert not is_android_trace_format({"platform": "cocoa", "profile": {"methods": []}})


def test_is_android_trace_format_sample_formats_are_not_trace() -> None:
    # Sample v1/v2 profiles store their frames in "frames", not "methods".
    assert not is_android_trace_format(
        {"version": "1", "platform": "android", "profile": {"frames": []}}
    )
    assert not is_android_trace_format(
        {"version": "2", "platform": "android", "profile": {"frames": []}}
    )


def test_is_jvm_frame_by_frame_platform() -> None:
    # A frame's own platform decides, regardless of the profile platform.
    profile: dict[str, Any] = {"platform": "android"}
    assert is_jvm_frame({"platform": "java"}, profile)
    assert is_jvm_frame({"platform": "android"}, profile)
    # a native frame in an android profile is not a JVM frame
    assert not is_jvm_frame({"platform": "native"}, profile)


def test_is_jvm_frame_inherits_profile_platform() -> None:
    # A frame without its own platform inherits the profile platform.
    assert is_jvm_frame({"function": "a"}, {"platform": "android"})
    assert not is_jvm_frame({"function": "a"}, {"platform": "python"})

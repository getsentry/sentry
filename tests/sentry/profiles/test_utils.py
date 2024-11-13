from typing import Any

from sentry.profiles.utils import apply_stack_trace_rules_to_profile


def test_apply_stack_trace_rules_to_profile_sample_format():
    profile: dict[str, Any] = {
        "version": 1,
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


def test_apply_stack_trace_rules_to_profile_android():
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

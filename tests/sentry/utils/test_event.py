from __future__ import annotations

from typing import Any
from unittest import TestCase

from sentry.utils.event import has_stacktrace, is_handled


class HasStacktraceTest(TestCase):
    def test_top_level_stacktrace_detected(self) -> None:
        event_data = {
            "stacktrace": {
                "frames": [
                    {
                        "function": "fetchBall",
                        "abs_path": "webpack:///./app/dogpark/fetch.ts",
                        "lineno": 1231,
                        "colno": 1121,
                    }
                ]
            },
        }
        assert has_stacktrace(event_data) is True

    def test_exception_or_threads_stacktrace_detected(self) -> None:
        for container in ["exception", "threads"]:
            event_data = {
                container: {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "fetchBall",
                                        "abs_path": "webpack:///./app/dogpark/fetch.ts",
                                        "lineno": 1231,
                                        "colno": 1121,
                                    }
                                ]
                            },
                        },
                    ],
                },
            }
            assert has_stacktrace(event_data) is True, f"Couldn't find stacktrace in `{container}`"

    def test_top_level_empty_stacktrace_ignored(self) -> None:
        event_data: dict[str, Any] = {
            "stacktrace": {},
        }
        assert has_stacktrace(event_data) is False

    def test_top_level_empty_frames_ignored(self) -> None:
        event_data: dict[str, Any] = {
            "stacktrace": {
                "frames": [],
            },
        }
        assert has_stacktrace(event_data) is False

    def test_exception_or_threads_empty_stacktrace_ignored(self) -> None:
        for container in ["exception", "threads"]:
            event_data = {
                container: {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "stacktrace": {},
                        },
                    ],
                },
            }
            assert (
                has_stacktrace(event_data) is False
            ), f"Mistakenly detected stacktrace in `{container}`"

    def test_exception_or_threads_empty_frames_ignored(self) -> None:
        for container in ["exception", "threads"]:
            event_data = {
                container: {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "stacktrace": {
                                "frames": [],
                            },
                        },
                    ],
                },
            }
            assert (
                has_stacktrace(event_data) is False
            ), f"Mistakenly detected stacktrace in `{container}`"

    def test_exception_or_threads_no_stacktrace(self) -> None:
        for container in ["exception", "threads"]:
            event_data = {
                container: {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                        },
                    ],
                },
            }
            assert (
                has_stacktrace(event_data) is False
            ), f"Mistakenly detected stacktrace in `{container}`"

    def test_no_stacktrace_anywhere(self) -> None:
        event_data = {"event_id": 11212012123120120415201309082013}
        assert has_stacktrace(event_data) is False

    def test_native_crash_with_stacktrace_in_threads(self) -> None:
        """
        Test for native crashes where exception exists but has no stacktrace,
        and the actual stacktrace is in threads.

        This is common for C, C++, Cocoa, and minidump crashes.
        """
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "SIGABRT",
                        "value": "Abort signal was raised",
                        "mechanism": {"type": "minidump"},
                    }
                ]
            },
            "threads": {
                "values": [
                    {
                        "id": 0,
                        "crashed": True,
                        "stacktrace": {
                            "frames": [
                                {"function": "raise", "package": "libsystem_kernel.dylib"},
                                {"function": "abort", "package": "libsystem_c.dylib"},
                            ]
                        },
                    }
                ]
            },
        }
        assert has_stacktrace(event_data) is True

    def test_native_crash_with_multiple_threads(self) -> None:
        """
        Test that stacktraces are found in any thread, not just the first one.
        """
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "SIGSEGV",
                        "value": "Segmentation fault",
                        "mechanism": {"type": "minidump"},
                    }
                ]
            },
            "threads": {
                "values": [
                    {
                        "id": 0,
                        "crashed": False,
                    },
                    {
                        "id": 1,
                        "crashed": True,
                        "stacktrace": {
                            "frames": [
                                {"function": "crash_here", "package": "myapp"},
                            ]
                        },
                    },
                ]
            },
        }
        assert has_stacktrace(event_data) is True


class IsHandledTest(TestCase):
    def test_simple(self) -> None:
        for handled in [True, False]:
            event_data = {
                "exception": {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "mechanism": {"handled": handled},
                        }
                    ]
                },
            }

        assert is_handled(event_data) is handled

    def test_no_handled_value(self) -> None:
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "MissingBallError",
                        "value": "Ball went over a fence",
                    }
                ]
            },
        }

        assert is_handled(event_data) is None

    def test_multiple_values_matching(self) -> None:
        for handled in [True, False]:
            event_data = {
                "exception": {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "mechanism": {"handled": handled},
                        },
                        {
                            "type": "ChewedUpShoeError",
                            "value": "Man, and I *liked* those flip-flops, too. :(",
                            "mechanism": {"handled": handled},
                        },
                    ]
                },
            }

            assert is_handled(event_data) is handled

    def test_multiple_values_mixed(self) -> None:
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "MissingBallError",
                        "value": "Ball went over a fence",
                        "mechanism": {"handled": True},
                    },
                    {
                        "type": "ChewedUpShoeError",
                        "value": "Man, and I *liked* those flip-flops, too. :(",
                        "mechanism": {"handled": False},
                    },
                ]
            },
        }

        assert is_handled(event_data) is False

    def test_not_all_values_have_handled(self) -> None:
        for handled in [True, False]:
            event_data = {
                "exception": {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "mechanism": {"handled": handled},
                        },
                        {
                            "type": "ChewedUpShoeError",
                            "value": "Man, and I *liked* those flip-flops, too. :(",
                        },
                        {
                            "type": "RolledInMudError",
                            "value": "Time for a bath",
                            "mechanism": {"source": "swamp"},
                        },
                    ]
                },
            }

            assert is_handled(event_data) is handled

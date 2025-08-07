"""Tests for thread leak Sentry integration."""

from traceback import FrameSummary
from typing import Any

from sentry.testutils.thread_leaks.sentry import event_from_stack


def dict_from_stack(value: str, stack, strict: bool) -> dict[str, Any]:
    """Create Sentry event dict from stack (type-checker friendly wrapper)."""
    return dict(event_from_stack(value, stack, strict))


class TestEventFromStack:
    def test_simple(self):
        event = dict_from_stack("test", [FrameSummary("/app/test.py", 1, "func")], strict=True)

        assert event == {
            "level": "error",
            "message": "Thread leak detected",
            "exception": {
                "values": [
                    {
                        "mechanism": {
                            "type": "sentry.testutils.thread_leaks.sentry",
                            "handled": False,
                            "help_link": "https://www.notion.so/sentry/How-To-Thread-Leaks-2488b10e4b5d8049965cc057b5fb5f6b",
                        },
                        "type": "ThreadLeakAssertionError",
                        "value": "test",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "/app/test.py",
                                    "function": "func",
                                    "module": None,
                                    "lineno": 1,
                                    "context_line": None,
                                    "in_app": True,
                                }
                            ]
                        },
                    }
                ]
            },
        }

    def test_empty_stack(self):
        event = dict_from_stack("test_value", [], strict=True)

        # Only assert what differs from full structure
        assert event["exception"]["values"][0]["stacktrace"]["frames"] == []

    def test_non_strict(self):
        # Non-strict mode - only level and handled differ
        event = dict_from_stack("test", [FrameSummary("/app/test.py", 1, "func")], strict=False)
        assert event["level"] == "warning"
        assert event["exception"]["values"][0]["mechanism"]["handled"] is True

    def test_more_frames(self):
        # Multiple frames - only frames differ
        stack = [
            FrameSummary("/app/caller.py", 10, "caller_func"),
            FrameSummary("/app/creator.py", 20, "create_thread"),
        ]
        event = dict_from_stack("test", stack, strict=True)
        frames = event["exception"]["values"][0]["stacktrace"]["frames"]
        assert len(frames) == 2
        assert frames[0]["filename"] == "/app/caller.py"
        assert frames[1]["filename"] == "/app/creator.py"

    def test_missing_frame_data(self):
        # Frame without locals or line - only these fields differ
        frame_minimal = FrameSummary("/app/test.py", 42, "func")
        event = dict_from_stack("test", [frame_minimal], strict=True)
        stack_frame = event["exception"]["values"][0]["stacktrace"]["frames"][0]
        assert stack_frame["module"] is None
        assert stack_frame["context_line"] is None

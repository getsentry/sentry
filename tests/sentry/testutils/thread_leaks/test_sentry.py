"""Tests for thread leak Sentry integration."""

from collections.abc import Iterable
from threading import Thread
from traceback import FrameSummary
from typing import int, Any
from unittest.mock import Mock

from sentry.testutils.thread_leaks.sentry import event_from_stack


def dict_from_stack(
    value: str, stack: Iterable[FrameSummary], strict: bool, allowlisted: bool = False
) -> dict[str, Any]:
    """Create Sentry event dict from stack (type-checker friendly wrapper)."""
    # Create mock thread with the desired repr and no target
    mock_thread = Mock(spec=Thread)
    mock_thread.configure_mock(__repr__=Mock(return_value=value))
    mock_thread.configure_mock(_target=None)

    # Create mock pytest.Mark if allowlisted is True (for backwards compat)
    if allowlisted is True:
        _allowlisted = Mock()
        _allowlisted.kwargs = {"issue": 12345, "reason": "Test reason"}
    elif allowlisted is False:
        _allowlisted = None

    return dict(
        event_from_stack(
            mock_thread, stack, strict, _allowlisted, pytest_nodeid="path/to/mytest.py::mytest[123]"
        )
    )


class TestEventFromStack:
    def test_simple(self) -> None:
        stack = [
            FrameSummary("/app/test_xyz.py", 1, "func"),  # app code - in_app
            FrameSummary("/usr/lib/python3.13/threading.py", 100, "start"),  # stdlib - not in_app
        ]
        event = dict_from_stack("test", stack, strict=True, allowlisted=True)

        assert event == {
            "level": "info",  # allowlisted=True
            "message": "Thread leak detected",
            "exception": {
                "values": [
                    {
                        "mechanism": {
                            "type": "sentry.testutils.thread_leaks.sentry",
                            "handled": False,
                            "help_link": "https://www.notion.so/sentry/How-To-Thread-Leaks-2488b10e4b5d8049965cc057b5fb5f6b",
                            "data": {
                                "version": "3",
                                "strict": True,
                                "allowlisted": True,
                            },
                        },
                        "type": "ThreadLeakAssertionError",
                        "value": "test",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "/app/test_xyz.py",
                                    "function": "func",
                                    "module": None,
                                    "lineno": 1,
                                    "context_line": "",
                                    "in_app": True,
                                },
                                {
                                    "filename": "/usr/lib/python3.13/threading.py",
                                    "function": "start",
                                    "module": None,
                                    "lineno": 100,
                                    "context_line": "",
                                    "in_app": False,
                                },
                            ]
                        },
                    }
                ]
            },
            "tags": {
                "thread.target": "None",
                "pytest.file": "path/to/mytest.py",
                "thread_leak_allowlist.issue": "12345",
                "mechanism.version": '"3"',
                "mechanism.strict": "true",
                "mechanism.allowlisted": "true",
            },
            "contexts": {
                "pytest": {"nodeid": "path/to/mytest.py::mytest[123]", "file": "path/to/mytest.py"},
                "thread_leak_allowlist": {
                    "reason": "Test reason",
                    "issue": 12345,
                },
            },
        }

    def test_empty_stack(self) -> None:
        event = dict_from_stack("test_value", [], strict=True)

        # Only assert what differs from full structure
        assert event["exception"]["values"][0]["stacktrace"]["frames"] == []

    def test_non_strict(self) -> None:
        # Non-strict mode - only level and handled differ
        event = dict_from_stack("test", [FrameSummary("/app/test.py", 1, "func")], strict=False)
        assert event["level"] == "warning"
        assert event["exception"]["values"][0]["mechanism"]["handled"] is True

    def test_more_frames(self) -> None:
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

    def test_missing_frame_data(self) -> None:
        # Frame without locals or line - only these fields differ
        frame_minimal = FrameSummary("/app/test.py", 42, "func")
        event = dict_from_stack("test", [frame_minimal], strict=True)
        stack_frame = event["exception"]["values"][0]["stacktrace"]["frames"][0]
        assert stack_frame["module"] is None
        assert stack_frame["context_line"] == ""

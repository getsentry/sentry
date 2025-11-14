from typing import int
"""Tests for pytest plugin thread leak detection and Sentry integration."""

import builtins
from threading import Event, Thread
from unittest.mock import Mock

import pytest

from sentry.testutils.thread_leaks import sentry
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist

log_test_info = builtins.print


@pytest.mark.usefixtures("thread_leak_test_environment")
class TestSentryCapture:
    """Test the Sentry event capture functionality for thread leaks."""

    @thread_leak_allowlist(reason="Testing thread leak detection itself", issue=99999)
    def test_capture_event_strict_no_allowlist(self) -> None:
        """Test capturing events in strict mode without allowlist."""
        stop = Event()
        thread = Thread(target=stop.wait, daemon=True)

        # Set _where to simulate thread leak tracking
        from traceback import FrameSummary

        thread._where = [FrameSummary(__file__, 28, "test_capture_event_strict_no_allowlist")]  # type: ignore[attr-defined]

        # Create mock pytest item
        mock_item = Mock(spec=pytest.Item)
        mock_item.nodeid = "tests/sentry/testutils/thread_leaks/test_pytest.py::TestSentryCapture::test_capture_event_strict_no_allowlist"

        try:
            thread.start()
            thread_leaks = {thread}

            # Capture the event
            events = sentry.capture_event(
                thread_leaks=thread_leaks, strict=True, allowlisted=None, item=mock_item
            )
        finally:
            stop.set()
            thread.join()

        # Verify event was captured
        assert len(events) == 1

        # Print event ID for manual verification via Sentry MCP
        event_id, event = next(iter(events.items()))
        log_test_info(f"Thread leak strict event ID: {event_id}")

        # Verify event payload
        assert event["level"] == "error"  # strict=True, no allowlist
        assert event["exception"]["values"][0]["mechanism"]["handled"] is False
        assert event["exception"]["values"][0]["mechanism"]["data"]["strict"] is True
        assert event["exception"]["values"][0]["mechanism"]["data"]["allowlisted"] is False

    @thread_leak_allowlist(reason="Testing thread leak detection itself", issue=99999)
    def test_capture_event_non_strict(self) -> None:
        """Test capturing events in non-strict mode."""
        stop = Event()
        thread = Thread(target=stop.wait, daemon=True)

        # Set _where to simulate thread leak tracking
        from traceback import FrameSummary

        thread._where = [FrameSummary(__file__, 65, "test_capture_event_non_strict")]  # type: ignore[attr-defined]

        # Create mock pytest item
        mock_item = Mock(spec=pytest.Item)
        mock_item.nodeid = "tests/sentry/testutils/thread_leaks/test_pytest.py::TestSentryCapture::test_capture_event_non_strict"

        try:
            thread.start()
            thread_leaks = {thread}

            # Capture the event
            events = sentry.capture_event(
                thread_leaks=thread_leaks, strict=False, allowlisted=None, item=mock_item
            )
        finally:
            stop.set()
            thread.join()

        # Verify event was captured
        assert len(events) == 1

        # Print event ID for manual verification via Sentry MCP
        event_id, event = next(iter(events.items()))
        log_test_info(f"Thread leak non-strict event ID: {event_id}")

        # Verify event payload
        assert event["level"] == "warning"  # strict=False
        assert event["exception"]["values"][0]["mechanism"]["handled"] is True

        # Verify tags for filtering/grouping
        assert "tags" in event
        assert "thread.target" in event["tags"]
        assert event["tags"]["thread.target"] == "threading.Event.wait"
        assert event["tags"]["pytest.file"] == "tests/sentry/testutils/thread_leaks/test_pytest.py"

        # Verify contexts (replacing extras)
        assert "contexts" in event
        assert "pytest" in event["contexts"]
        assert event["contexts"]["pytest"]["nodeid"] == mock_item.nodeid
        assert (
            event["contexts"]["pytest"]["file"]
            == "tests/sentry/testutils/thread_leaks/test_pytest.py"
        )

    @thread_leak_allowlist(reason="Testing thread leak detection itself", issue=99999)
    def test_capture_event_allowlisted(self) -> None:
        """Test capturing events with allowlist."""
        stop = Event()
        thread = Thread(target=stop.wait, daemon=True)

        # Set _where to simulate thread leak tracking
        from traceback import FrameSummary

        thread._where = [FrameSummary(__file__, 113, "test_capture_event_allowlisted")]  # type: ignore[attr-defined]

        # Create mock pytest item
        mock_item = Mock(spec=pytest.Item)
        mock_item.nodeid = "tests/sentry/testutils/thread_leaks/test_pytest.py::TestSentryCapture::test_capture_event_allowlisted"

        # Create mock allowlist marker
        mock_marker = Mock(spec=pytest.Mark)
        mock_marker.kwargs = {"issue": 12345, "reason": "Known thread leak"}

        try:
            thread.start()
            thread_leaks = {thread}

            # Capture the event with allowlist
            events = sentry.capture_event(
                thread_leaks=thread_leaks,
                strict=True,  # Even with strict, allowlisted shouldn't be error
                allowlisted=mock_marker,
                item=mock_item,
            )
        finally:
            stop.set()
            thread.join()

        # Verify event was captured
        assert len(events) == 1

        # Print event ID for manual verification via Sentry MCP
        event_id, event = next(iter(events.items()))
        log_test_info(f"Thread leak allowlisted event ID: {event_id}")

        # Verify event payload reflects allowlisted status
        assert event["level"] == "info"  # allowlisted
        # Note: mechanism.handled is still False when strict=True even with allowlist
        # This seems like a potential bug but matching current implementation
        assert event["exception"]["values"][0]["mechanism"]["handled"] is False

        # Verify allowlist information in tags
        assert event["tags"]["thread_leak_allowlist.issue"] == "12345"

        # Verify allowlist context
        assert "thread_leak_allowlist" in event["contexts"]
        assert event["contexts"]["thread_leak_allowlist"]["issue"] == 12345
        assert event["contexts"]["thread_leak_allowlist"]["reason"] == "Known thread leak"

    def test_filters_out_django_dev_server_threads(self) -> None:
        """Test that filter_django_dev_server_threads removes Django dev server threads."""
        stop = Event()

        from sentry.testutils.thread_leaks import pytest as thread_leaks_pytest

        # a mock function that has the qualname of our django dev server thread
        def fake_django_process_request_thread() -> None:
            pass

        fake_django_process_request_thread.__module__ = "django.core.servers.basehttp"
        fake_django_process_request_thread.__qualname__ = (
            "ThreadedWSGIServer.process_request_thread"
        )

        # Thread that should be filtered out (Django dev server)
        django_thread = Thread(target=fake_django_process_request_thread, daemon=True)
        # Thread that should NOT be filtered out
        normal_thread = Thread(target=stop.wait, daemon=True)

        threads = {django_thread, normal_thread}
        filtered = thread_leaks_pytest.filter_django_dev_server_threads(threads)

        # Only the normal thread should remain
        assert normal_thread in filtered
        assert django_thread not in filtered
        assert len(filtered) == 1

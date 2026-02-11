import msgspec
import pytest

from sentry.scm.private.event_stream import SourceCodeManagerEventStream
from sentry.scm.private.ipc import (
    CheckRunEventDataParser,
    CheckRunEventParser,
    SubscriptionEventParser,
    exec_listener,
    run_listener,
)
from sentry.scm.types import CheckRunEvent


def test_exec_listener():
    """
    Test successful execution of a listener.
    """
    count = 0

    def record_count(a, b, c):
        nonlocal count
        count += 1

    exec_listener("name", {"name": lambda a: None}, 1, record_count)
    assert count == 0, "Listener could not be executed or failed"


def test_exec_listener_missing_listener():
    """
    Assert the developers listener was removed prior to channel drain.
    """
    key = None
    tags = None

    def record_count(k, a, t):
        nonlocal key, tags
        key = k
        tags = t

    exec_listener("name", {}, 1, record_count)
    assert key == "sentry.scm.run_listener.failed"
    assert tags == {"reason": "not-found", "fn": "name"}


def test_exec_listener_failed():
    """
    Assert the developers listener failed.
    """
    key = None
    tags = None

    def listener(e):
        raise Exception("whatever")

    def record_count(k, a, t):
        nonlocal key, tags
        key = k
        tags = t

    with pytest.raises(Exception):
        exec_listener("name", {"name": listener}, 1, record_count)
        assert key == "sentry.scm.run_listener.failed"
        assert tags == {"reason": "internal", "fn": "name"}


def test_run_listener():
    event = None

    scm = SourceCodeManagerEventStream()

    @scm.listen_for("check_run")
    def call_me_maybe(e):
        nonlocal event
        event = e

    check_run_event = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "2"),
        subscription_event=SubscriptionEventParser(None, b"", {}, 0, [], "github"),
    )
    message = msgspec.msgpack.encode(check_run_event)

    run_listener(
        "call_me_maybe",
        message,
        "check_run",
        stream=scm,
        get_current_time=lambda: 0.0,
        report_error=lambda e: None,
        record_count=lambda a, b, c: None,
        record_timer=lambda a, b, c: None,
    )

    assert isinstance(event, CheckRunEvent), "Parsing from type hint failed."


def test_run_listener_malformed():
    error = None
    metrics = []

    def report_error(e):
        nonlocal error
        error = e

    def record_count(a, b, c):
        metrics.append((a, b, c))

    # Implicitly tests no exception was raised.
    run_listener(
        "t",
        b"",
        "check_run",
        stream=SourceCodeManagerEventStream(),
        get_current_time=lambda: 0.0,
        report_error=report_error,
        record_count=record_count,
        record_timer=lambda a, b, c: None,
    )

    assert isinstance(error, msgspec.MsgspecError)
    assert metrics == [("sentry.scm.run_listener.failed", 1, {"reason": "parse", "fn": "t"})]

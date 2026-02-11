import msgspec
import pytest

from sentry.scm.private.event_stream import SourceCodeManagerEventStream
from sentry.scm.private.ipc import (
    AuthorParser,
    CheckRunEventDataParser,
    CheckRunEventParser,
    CommentEventDataParser,
    CommentEventParser,
    PullRequestBranchParser,
    PullRequestEventDataParser,
    PullRequestEventParser,
    SubscriptionEventParser,
    exec_listener,
    run_listener,
)
from sentry.scm.types import CheckRunEvent, CommentEvent, PullRequestEvent


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


def test_run_check_run_listener():
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


def test_run_comment_listener():
    """
    Test that comment events are properly deserialized and routed to comment listeners.
    """
    event = None

    scm = SourceCodeManagerEventStream()

    @scm.listen_for("comment")
    def comment_handler(e):
        nonlocal event
        event = e

    comment_event = CommentEventParser(
        action="created",
        comment_type="issue",
        comment=CommentEventDataParser(
            id="123",
            body="Test comment",
            author=AuthorParser(id="456", username="testuser"),
        ),
        subscription_event=SubscriptionEventParser(None, b"", {}, 0, [], "github"),
    )
    message = msgspec.msgpack.encode(comment_event)

    run_listener(
        "comment_handler",
        message,
        "comment",
        stream=scm,
        get_current_time=lambda: 0.0,
        report_error=lambda e: None,
        record_count=lambda a, b, c: None,
        record_timer=lambda a, b, c: None,
    )

    assert isinstance(event, CommentEvent)
    assert event.action == "created"
    assert event.comment["id"] == "123"
    assert event.comment["body"] == "Test comment"
    assert event.comment["author"]["username"] == "testuser"


def test_run_pull_request_listener():
    """
    Test that pull request events are properly deserialized and routed to PR listeners.
    """
    event = None

    scm = SourceCodeManagerEventStream()

    @scm.listen_for("pull_request")
    def pr_handler(e):
        nonlocal event
        event = e

    pr_event = PullRequestEventParser(
        action="opened",
        pull_request=PullRequestEventDataParser(
            id="789",
            title="Test PR",
            description="Test description",
            head=PullRequestBranchParser(ref="feature-branch", sha="abc123"),
            base=PullRequestBranchParser(ref="main", sha="def456"),
            is_private_repo=False,
            author=AuthorParser(id="456", username="testuser"),
        ),
        subscription_event=SubscriptionEventParser(None, b"", {}, 0, [], "github"),
    )
    message = msgspec.msgpack.encode(pr_event)

    run_listener(
        "pr_handler",
        message,
        "pull_request",
        stream=scm,
        get_current_time=lambda: 0.0,
        report_error=lambda e: None,
        record_count=lambda a, b, c: None,
        record_timer=lambda a, b, c: None,
    )

    assert isinstance(event, PullRequestEvent)
    assert event.action == "opened"
    assert event.pull_request["id"] == "789"
    assert event.pull_request["title"] == "Test PR"
    assert event.pull_request["head"]["ref"] == "feature-branch"
    assert event.pull_request["base"]["ref"] == "main"


def test_run_listener_metrics_recorded():
    """
    Test that success metrics and timing metrics are properly recorded.
    """
    metrics = []
    timers = []

    scm = SourceCodeManagerEventStream()

    @scm.listen_for("check_run")
    def handler(e):
        pass

    check_run_event = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "2"),
        subscription_event=SubscriptionEventParser(None, b"", {}, 100, [], "github"),
    )
    message = msgspec.msgpack.encode(check_run_event)

    def record_count(key, amount, tags):
        metrics.append((key, amount, tags))

    def record_timer(key, amount, tags):
        timers.append((key, amount, tags))

    run_listener(
        "handler",
        message,
        "check_run",
        stream=scm,
        get_current_time=lambda: 200.0,
        report_error=lambda e: None,
        record_count=record_count,
        record_timer=record_timer,
    )

    assert ("sentry.scm.run_listener.success", 1, {"fn": "handler"}) in metrics
    assert any(key == "sentry.scm.run_listener.start_time" for key, _, _ in timers)
    assert any(key == "sentry.scm.run_listener.task_time" for key, _, _ in timers)
    assert any(key == "sentry.scm.run_listener.real_time" for key, _, _ in timers)


def test_run_listener_not_found_no_exception():
    """
    Test that calling a non-existent listener doesn't raise an exception.
    """
    metrics = []

    def record_count(key, amount, tags):
        metrics.append((key, amount, tags))

    check_run_event = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "2"),
        subscription_event=SubscriptionEventParser(None, b"", {}, 0, [], "github"),
    )
    message = msgspec.msgpack.encode(check_run_event)

    # Should not raise exception even though listener doesn't exist
    run_listener(
        "nonexistent_handler",
        message,
        "check_run",
        stream=SourceCodeManagerEventStream(),
        get_current_time=lambda: 0.0,
        report_error=lambda e: None,
        record_count=record_count,
        record_timer=lambda a, b, c: None,
    )

    assert (
        "sentry.scm.run_listener.failed",
        1,
        {"reason": "not-found", "fn": "nonexistent_handler"},
    ) in metrics


def test_run_listener_exception_propagates():
    """
    Test that exceptions from listeners are properly propagated and metrics recorded.
    """
    metrics = []

    scm = SourceCodeManagerEventStream()

    @scm.listen_for("check_run")
    def failing_handler(e):
        raise ValueError("Something went wrong")

    def record_count(key, amount, tags):
        metrics.append((key, amount, tags))

    check_run_event = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "2"),
        subscription_event=SubscriptionEventParser(None, b"", {}, 0, [], "github"),
    )
    message = msgspec.msgpack.encode(check_run_event)

    with pytest.raises(ValueError, match="Something went wrong"):
        run_listener(
            "failing_handler",
            message,
            "check_run",
            stream=scm,
            get_current_time=lambda: 0.0,
            report_error=lambda e: None,
            record_count=record_count,
            record_timer=lambda a, b, c: None,
        )

    assert (
        "sentry.scm.run_listener.failed",
        1,
        {"reason": "internal", "fn": "failing_handler"},
    ) in metrics


def test_run_listener_malformed_input():
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

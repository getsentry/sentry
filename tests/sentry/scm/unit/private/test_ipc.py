from unittest import mock

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
    deserialize_check_run_event,
    deserialize_comment_event,
    deserialize_event,
    deserialize_pull_request_event,
    exec_listener,
    produce_to_listeners,
    run_listener,
    serialize_check_run_event,
    serialize_comment_event,
    serialize_event,
    serialize_pull_request_event,
)
from sentry.scm.types import (
    CheckRunEvent,
    CommentEvent,
    EventType,
    PullRequestEvent,
    SubscriptionEvent,
)


def test_exec_listener() -> None:
    """
    Test successful execution of a listener.
    """
    count = 0

    def record_count(a, b, c):
        nonlocal count
        count += 1

    exec_listener("name", {"name": lambda a: None}, 1, record_count)
    assert count == 0, "Listener could not be executed or failed"


def test_exec_listener_missing_listener() -> None:
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


def test_exec_listener_failed() -> None:
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


def test_run_check_run_listener() -> None:
    event = None

    scm = SourceCodeManagerEventStream()

    @scm.listen_for("check_run")
    def call_me_maybe(e):
        nonlocal event
        event = e

    check_run_event = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "2"),
        subscription_event=SubscriptionEventParser(None, "", {}, 0, [], "github"),
    )
    message = msgspec.json.encode(check_run_event).decode("utf-8")

    run_listener(
        "call_me_maybe",
        message,
        "check_run",
        stream=scm,
        get_current_time=lambda: 0.0,
        record_count=lambda a, b, c: None,
        record_timer=lambda a, b, c: None,
    )

    assert isinstance(event, CheckRunEvent), "Parsing from type hint failed."


def test_run_comment_listener() -> None:
    """
    Test that comment events are properly deserialized and routed to comment listeners.
    """
    event: EventType | None = None

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
        subscription_event=SubscriptionEventParser(None, "", {}, 0, [], "github"),
    )
    message = msgspec.json.encode(comment_event).decode("utf-8")

    run_listener(
        "comment_handler",
        message,
        "comment",
        stream=scm,
        get_current_time=lambda: 0.0,
        record_count=lambda a, b, c: None,
        record_timer=lambda a, b, c: None,
    )

    assert isinstance(event, CommentEvent)
    assert event.action == "created"
    assert event.comment["id"] == "123"
    assert event.comment["body"] == "Test comment"
    assert event.comment["author"] is not None
    assert event.comment["author"]["username"] == "testuser"


def test_run_pull_request_listener() -> None:
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
        subscription_event=SubscriptionEventParser(None, "", {}, 0, [], "github"),
    )
    message = msgspec.json.encode(pr_event).decode("utf-8")

    run_listener(
        "pr_handler",
        message,
        "pull_request",
        stream=scm,
        get_current_time=lambda: 0.0,
        record_count=lambda a, b, c: None,
        record_timer=lambda a, b, c: None,
    )

    assert isinstance(event, PullRequestEvent)
    assert event.action == "opened"
    assert event.pull_request["id"] == "789"
    assert event.pull_request["title"] == "Test PR"
    assert event.pull_request["head"]["ref"] == "feature-branch"
    assert event.pull_request["base"]["ref"] == "main"


def test_run_listener_metrics_recorded() -> None:
    """
    Test that success metrics and timing metrics are properly recorded.
    """
    distributions = None
    metrics = []
    timers = []

    scm = SourceCodeManagerEventStream()

    @scm.listen_for("check_run")
    def handler(e):
        pass

    check_run_event = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "2"),
        subscription_event=SubscriptionEventParser(None, "", {}, 100, [], "github"),
    )
    message = msgspec.json.encode(check_run_event).decode("utf-8")

    def record_count(key, amount, tags):
        metrics.append((key, amount, tags))

    def record_distribution(key, amount, tags, unit):
        nonlocal distributions
        distributions = (key, amount, tags, unit)

    def record_timer(key, amount, tags):
        timers.append((key, amount, tags))

    run_listener(
        "handler",
        message,
        "check_run",
        stream=scm,
        get_current_time=lambda: 200.0,
        record_count=record_count,
        record_distribution=record_distribution,
        record_timer=record_timer,
    )

    assert ("sentry.scm.run_listener.success", 1, {"fn": "handler"}) in metrics
    assert distributions == (
        "sentry.scm.run_listener.message.size",
        len(message),
        {"provider": "github", "event_type_hint": "check_run"},
        "byte",
    )
    assert any(key == "sentry.scm.run_listener.queue_time" for key, _, _ in timers)
    assert any(key == "sentry.scm.run_listener.task_time" for key, _, _ in timers)
    assert any(key == "sentry.scm.run_listener.real_time" for key, _, _ in timers)


def test_run_listener_not_found() -> None:
    """
    Test that calling a non-existent listener doesn't raise an exception.
    """
    metrics = []

    def record_count(key, amount, tags):
        metrics.append((key, amount, tags))

    check_run_event = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "2"),
        subscription_event=SubscriptionEventParser(None, "", {}, 0, [], "github"),
    )
    message = msgspec.json.encode(check_run_event).decode("utf-8")

    # Should not raise exception even though listener doesn't exist
    run_listener(
        "nonexistent_handler",
        message,
        "check_run",
        stream=SourceCodeManagerEventStream(),
        get_current_time=lambda: 0.0,
        record_count=record_count,
        record_timer=lambda a, b, c: None,
    )

    assert (
        "sentry.scm.run_listener.failed",
        1,
        {"reason": "not-found", "fn": "nonexistent_handler"},
    ) in metrics


def test_run_listener_exception_propagates() -> None:
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
        subscription_event=SubscriptionEventParser(None, "", {}, 0, [], "github"),
    )
    message = msgspec.json.encode(check_run_event).decode("utf-8")

    with pytest.raises(ValueError, match="Something went wrong"):
        run_listener(
            "failing_handler",
            message,
            "check_run",
            stream=scm,
            get_current_time=lambda: 0.0,
            record_count=record_count,
            record_timer=lambda a, b, c: None,
        )

    assert (
        "sentry.scm.run_listener.failed",
        1,
        {"reason": "internal", "fn": "failing_handler"},
    ) in metrics


def test_run_listener_malformed_input() -> None:
    metrics = []

    def record_count(a, b, c):
        metrics.append((a, b, c))

    with pytest.raises(msgspec.MsgspecError):
        run_listener(
            "t",
            "",
            "check_run",
            stream=SourceCodeManagerEventStream(),
            get_current_time=lambda: 0.0,
            record_count=record_count,
            record_timer=lambda a, b, c: None,
        )

    assert metrics == [("sentry.scm.run_listener.failed", 1, {"reason": "parse", "fn": "t"})]


def test_serialize_deserialize_check_run_event() -> None:
    """
    Test round-trip serialization and deserialization of check run events.
    """
    event = CheckRunEvent(
        action="completed",
        check_run={"external_id": "12345", "html_url": "https://example.com/check"},
        subscription_event={
            "event": "raw_event_data",
            "event_type_hint": "check_run",
            "extra": {"key": "value", "number": 42},
            "received_at": 1234567890,
            "sentry_meta": [
                {"id": 1, "integration_id": 100, "organization_id": 200},
                {"id": None, "integration_id": 101, "organization_id": 201},
            ],
            "type": "github",
        },
    )

    serialized = serialize_check_run_event(event)
    assert isinstance(serialized, str)

    deserialized = deserialize_check_run_event(serialized)
    assert deserialized.action == event.action
    assert deserialized.check_run["external_id"] == event.check_run["external_id"]
    assert deserialized.check_run["html_url"] == event.check_run["html_url"]
    assert deserialized.subscription_event["event"] == event.subscription_event["event"]
    assert deserialized.subscription_event["type"] == event.subscription_event["type"]
    assert deserialized.subscription_event["sentry_meta"] == event.subscription_event["sentry_meta"]


def test_serialize_deserialize_comment_event() -> None:
    """
    Test round-trip serialization and deserialization of comment events.
    """
    event = CommentEvent(
        action="created",
        comment_type="issue",
        comment={
            "id": "comment-123",
            "body": "This is a comment",
            "author": {"id": "user-456", "username": "testuser"},
        },
        subscription_event={
            "event": "raw_event_data",
            "event_type_hint": "comment",
            "extra": {},
            "received_at": 1234567890,
            "sentry_meta": None,
            "type": "github",
        },
    )

    serialized = serialize_comment_event(event)
    assert isinstance(serialized, str)

    deserialized = deserialize_comment_event(serialized)
    assert deserialized.action == event.action
    assert deserialized.comment_type == event.comment_type
    assert deserialized.comment["id"] == event.comment["id"]
    assert deserialized.comment["body"] == event.comment["body"]
    assert deserialized.comment["author"] is not None
    assert event.comment["author"] is not None
    assert deserialized.comment["author"]["username"] == event.comment["author"]["username"]


def test_serialize_deserialize_comment_event_no_author() -> None:
    """
    Test serialization/deserialization of comment events with null author.
    """
    event = CommentEvent(
        action="deleted",
        comment_type="pull_request",
        comment={
            "id": "comment-789",
            "body": None,
            "author": None,
        },
        subscription_event={
            "event": "",
            "event_type_hint": None,
            "extra": {},
            "received_at": 0,
            "sentry_meta": None,
            "type": "github",
        },
    )

    serialized = serialize_comment_event(event)
    deserialized = deserialize_comment_event(serialized)

    assert deserialized.comment["author"] is None
    assert deserialized.comment["body"] is None


def test_serialize_deserialize_pull_request_event() -> None:
    """
    Test round-trip serialization and deserialization of pull request events.
    """
    event = PullRequestEvent(
        action="opened",
        pull_request={
            "id": "pr-123",
            "title": "Add new feature",
            "description": "This PR adds a new feature",
            "head": {"ref": "feature-branch", "sha": "abc123def456"},
            "base": {"ref": "main", "sha": "fedcba654321"},
            "is_private_repo": True,
            "author": {"id": "user-789", "username": "contributor"},
        },
        subscription_event={
            "event": "raw_event_data",
            "event_type_hint": "pull_request",
            "extra": {"repo": "test-repo"},
            "received_at": 9876543210,
            "sentry_meta": [{"id": 5, "integration_id": 50, "organization_id": 500}],
            "type": "github",
        },
    )

    serialized = serialize_pull_request_event(event)
    assert isinstance(serialized, str)

    deserialized = deserialize_pull_request_event(serialized)
    assert deserialized.action == event.action
    assert deserialized.pull_request["id"] == event.pull_request["id"]
    assert deserialized.pull_request["title"] == event.pull_request["title"]
    assert deserialized.pull_request["head"]["ref"] == event.pull_request["head"]["ref"]
    assert deserialized.pull_request["base"]["sha"] == event.pull_request["base"]["sha"]
    assert deserialized.pull_request["is_private_repo"] is True


def test_serialize_deserialize_pull_request_event_no_author() -> None:
    """
    Test serialization/deserialization of PR events with null author and description.
    """
    event = PullRequestEvent(
        action="closed",
        pull_request={
            "id": "pr-456",
            "title": "Fix bug",
            "description": None,
            "head": {"ref": "bugfix", "sha": "aaa"},
            "base": {"ref": "develop", "sha": "bbb"},
            "is_private_repo": False,
            "author": None,
        },
        subscription_event={
            "event": "",
            "event_type_hint": None,
            "extra": {},
            "received_at": 0,
            "sentry_meta": None,
            "type": "github",
        },
    )

    serialized = serialize_pull_request_event(event)
    deserialized = deserialize_pull_request_event(serialized)

    assert deserialized.pull_request["author"] is None
    assert deserialized.pull_request["description"] is None


def test_serialize_event_dispatches_correctly() -> None:
    """
    Test that serialize_event dispatches to the correct serializer based on event type.
    """
    check_run_event = CheckRunEvent(
        action="completed",
        check_run={"external_id": "1", "html_url": "url"},
        subscription_event={
            "event": "",
            "event_type_hint": None,
            "extra": {},
            "received_at": 0,
            "sentry_meta": None,
            "type": "github",
        },
    )

    comment_event = CommentEvent(
        action="created",
        comment_type="issue",
        comment={"id": "1", "body": None, "author": None},
        subscription_event={
            "event": "",
            "event_type_hint": None,
            "extra": {},
            "received_at": 0,
            "sentry_meta": None,
            "type": "github",
        },
    )

    pr_event = PullRequestEvent(
        action="opened",
        pull_request={
            "id": "1",
            "title": "Test",
            "description": None,
            "head": {"ref": "a", "sha": "b"},
            "base": {"ref": "c", "sha": "d"},
            "is_private_repo": False,
            "author": None,
        },
        subscription_event={
            "event": "",
            "event_type_hint": None,
            "extra": {},
            "received_at": 0,
            "sentry_meta": None,
            "type": "github",
        },
    )

    check_run_bytes = serialize_event(check_run_event)
    comment_bytes = serialize_event(comment_event)
    pr_bytes = serialize_event(pr_event)

    assert isinstance(check_run_bytes, str)
    assert isinstance(comment_bytes, str)
    assert isinstance(pr_bytes, str)

    # Verify they can be deserialized back
    assert isinstance(deserialize_check_run_event(check_run_bytes), CheckRunEvent)
    assert isinstance(deserialize_comment_event(comment_bytes), CommentEvent)
    assert isinstance(deserialize_pull_request_event(pr_bytes), PullRequestEvent)


def test_deserialize_event_dispatches_correctly() -> None:
    """
    Test that deserialize_event dispatches to the correct deserializer based on type hint.
    """
    check_run_parser = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "url"),
        subscription_event=SubscriptionEventParser(None, "", {}, 0, None, "github"),
    )
    check_run_bytes = msgspec.json.encode(check_run_parser).decode("utf-8")

    comment_parser = CommentEventParser(
        action="created",
        comment_type="issue",
        comment=CommentEventDataParser("1", None, None),
        subscription_event=SubscriptionEventParser(None, "", {}, 0, None, "github"),
    )
    comment_bytes = msgspec.json.encode(comment_parser).decode("utf-8")

    pr_parser = PullRequestEventParser(
        action="opened",
        pull_request=PullRequestEventDataParser(
            "1",
            "Test",
            None,
            PullRequestBranchParser("a", "b"),
            PullRequestBranchParser("c", "d"),
            False,
            None,
        ),
        subscription_event=SubscriptionEventParser(None, "", {}, 0, None, "github"),
    )
    pr_bytes = msgspec.json.encode(pr_parser).decode("utf-8")

    assert isinstance(deserialize_event(check_run_bytes, "check_run"), CheckRunEvent)
    assert isinstance(deserialize_event(comment_bytes, "comment"), CommentEvent)
    assert isinstance(deserialize_event(pr_bytes, "pull_request"), PullRequestEvent)


def test_produce_to_listeners_check_run() -> None:
    """
    Test that produce_to_listeners correctly routes check run events to registered listeners.
    """
    produced_messages = []

    def mock_produce(message, event_type_hint, listener_name, silo):
        produced_messages.append((message, event_type_hint, listener_name, silo))

    subscription_event: SubscriptionEvent = {
        "event": '{"action": "completed"}',
        "event_type_hint": "check_run",
        "extra": {},
        "received_at": 0,
        "sentry_meta": None,
        "type": "github",
    }

    def mock_deserialize(event):
        return CheckRunEvent(
            action="completed",
            check_run={"external_id": "1", "html_url": "url"},
            subscription_event=event,
        )

    mock_stream = SourceCodeManagerEventStream()

    @mock_stream.listen_for("check_run")
    def listener_one(e):
        pass

    @mock_stream.listen_for("check_run")
    def listener_two(e):
        pass

    with mock.patch("sentry.scm.private.ipc.deserialize_raw_event", mock_deserialize):
        produce_to_listeners(subscription_event, "control", mock_produce, stream=mock_stream)

        assert len(produced_messages) == 2
        assert all(event_type == "check_run" for _, event_type, _, _ in produced_messages)
        assert all(silo == "control" for _, _, _, silo in produced_messages)
        listener_names = {listener_name for _, _, listener_name, _ in produced_messages}
        assert listener_names == {"listener_one", "listener_two"}


def test_produce_to_listeners_comment() -> None:
    """
    Test that produce_to_listeners correctly routes comment events to registered listeners.
    """
    produced_messages = []

    def mock_produce(message, event_type_hint, listener_name, silo):
        produced_messages.append((message, event_type_hint, listener_name, silo))

    subscription_event: SubscriptionEvent = {
        "event": "{}",
        "event_type_hint": "comment",
        "extra": {},
        "received_at": 0,
        "sentry_meta": None,
        "type": "github",
    }

    def mock_deserialize(event):
        return CommentEvent(
            action="created",
            comment_type="issue",
            comment={"id": "1", "body": "test", "author": None},
            subscription_event=event,
        )

    mock_stream = SourceCodeManagerEventStream()

    @mock_stream.listen_for("comment")
    def comment_listener(e):
        pass

    with mock.patch("sentry.scm.private.ipc.deserialize_raw_event", mock_deserialize):
        produce_to_listeners(subscription_event, "region", mock_produce, stream=mock_stream)

        assert len(produced_messages) == 1
        assert produced_messages[0][1] == "comment"
        assert produced_messages[0][3] == "region"


def test_produce_to_listeners_pull_request() -> None:
    """
    Test that produce_to_listeners correctly routes PR events to registered listeners.
    """
    produced_messages = []

    def mock_produce(message, event_type_hint, listener_name, silo):
        produced_messages.append((message, event_type_hint, listener_name, silo))

    subscription_event: SubscriptionEvent = {
        "event": "",
        "event_type_hint": "pull_request",
        "extra": {},
        "received_at": 0,
        "sentry_meta": None,
        "type": "github",
    }

    def mock_deserialize(event):
        return PullRequestEvent(
            action="opened",
            pull_request={
                "id": "1",
                "title": "Test",
                "description": None,
                "head": {"ref": "a", "sha": "b"},
                "base": {"ref": "c", "sha": "d"},
                "is_private_repo": False,
                "author": None,
            },
            subscription_event=event,
        )

    mock_stream = SourceCodeManagerEventStream()

    @mock_stream.listen_for("pull_request")
    def pr_listener(e):
        pass

    with mock.patch("sentry.scm.private.ipc.deserialize_raw_event", mock_deserialize):
        produce_to_listeners(subscription_event, "control", mock_produce, stream=mock_stream)

        assert len(produced_messages) == 1
        assert produced_messages[0][1] == "pull_request"
        assert produced_messages[0][3] == "control"


def test_produce_to_listeners_returns_none_for_unsupported_events() -> None:
    """
    Test that produce_to_listeners returns None when deserialize_raw_event returns None.
    """
    produced_messages = []

    def mock_produce(message, event_type_hint, listener_name, silo):
        produced_messages.append((message, event_type_hint, listener_name, silo))

    subscription_event: SubscriptionEvent = {
        "event": "unsupported",
        "event_type_hint": None,
        "extra": {},
        "received_at": 0,
        "sentry_meta": None,
        "type": "github",
    }

    with mock.patch("sentry.scm.private.ipc.deserialize_raw_event", lambda e: None):
        produce_to_listeners(subscription_event, "region", mock_produce)
        assert len(produced_messages) == 0

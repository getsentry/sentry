import msgspec

from fixtures.github import PULL_REQUEST_OPENED_EVENT_EXAMPLE
from sentry.scm.private.stream_producer import produce_event_to_scm_stream
from sentry.scm.types import SubscriptionEvent


def test_produce_to_scm_stream() -> None:
    metrics = []

    def record_count(k, a, t):
        metrics.append((k, a, t))

    event: SubscriptionEvent = {
        "event": PULL_REQUEST_OPENED_EVENT_EXAMPLE.decode("utf-8"),
        "event_type_hint": "pull_request",
        "extra": {},
        "received_at": 0,
        "sentry_meta": [],
        "type": "github",
    }
    produce_event_to_scm_stream(
        event,
        "control",
        produce_to_listener=lambda a, b, c, d: None,
        record_count=record_count,
        rollout_enabled=lambda _: True,
    )
    assert metrics == [("sentry.scm.produce_event_to_scm_stream.success", 1, {})]


def test_produce_to_scm_stream_unsupported_provider() -> None:
    metrics = []

    def record_count(k, a, t):
        metrics.append((k, a, t))

    event: SubscriptionEvent = {
        "event": "",
        "event_type_hint": None,
        "extra": {},
        "received_at": 0,
        "sentry_meta": [],
        "type": "bitbucket",
    }
    produce_event_to_scm_stream(
        event,
        "control",
        record_count=record_count,
        rollout_enabled=lambda _: True,
    )

    assert metrics == [
        (
            "sentry.scm.produce_event_to_scm_stream.failed",
            1,
            {"reason": "provider-not-supported", "provider": event["type"]},
        )
    ]


def test_produce_to_scm_stream_invalid_payload() -> None:
    metrics = []
    reported_exception = None

    def record_count(k, a, t):
        metrics.append((k, a, t))

    def report_error(e):
        nonlocal reported_exception
        reported_exception = e

    event: SubscriptionEvent = {
        "event": "",
        "event_type_hint": "pull_request",
        "extra": {},
        "received_at": 0,
        "sentry_meta": [],
        "type": "github",
    }
    produce_event_to_scm_stream(
        event,
        "control",
        record_count=record_count,
        report_error=report_error,
        rollout_enabled=lambda _: True,
    )

    assert isinstance(reported_exception, msgspec.MsgspecError)
    assert metrics == [
        ("sentry.scm.produce_event_to_scm_stream.failed", 1, {"reason": "processing"})
    ]


def test_produce_to_scm_stream_unknown_pr_action_is_not_reported() -> None:
    """
    Unknown GitHub PR actions (e.g. 'stacked') should be silently dropped as
    'event-not-supported', not reported to Sentry as errors.  This guards against
    GitHub adding new action types that haven't been added to the PullRequestAction
    Literal in the scm-platform package yet.
    """
    metrics = []
    reported_exception = None

    def record_count(k, a, t):
        metrics.append((k, a, t))

    def report_error(e):
        nonlocal reported_exception
        reported_exception = e

    stacked_event = PULL_REQUEST_OPENED_EVENT_EXAMPLE.replace(b'"opened"', b'"stacked"')
    event: SubscriptionEvent = {
        "event": stacked_event.decode("utf-8"),
        "event_type_hint": "pull_request",
        "extra": {},
        "received_at": 0,
        "sentry_meta": [],
        "type": "github",
    }
    produce_event_to_scm_stream(
        event,
        "control",
        record_count=record_count,
        report_error=report_error,
        rollout_enabled=lambda _: True,
    )

    assert reported_exception is None
    assert metrics == [
        (
            "sentry.scm.produce_event_to_scm_stream.failed",
            1,
            {"reason": "event-not-supported", "provider": event["type"]},
        )
    ]


def test_produce_to_scm_stream_rollout_disabled() -> None:
    metrics = []
    reported_exception = None

    def record_count(k, a, t):
        metrics.append((k, a, t))

    def report_error(e):
        nonlocal reported_exception
        reported_exception = e

    event: SubscriptionEvent = {
        "event": "",
        "event_type_hint": "pull_request",
        "extra": {},
        "received_at": 0,
        "sentry_meta": [],
        "type": "github",
    }
    produce_event_to_scm_stream(
        event,
        "control",
        record_count=record_count,
        report_error=report_error,
        rollout_enabled=lambda _: False,
    )

    # Would have raised if enabled.
    assert reported_exception is None
    assert metrics == []

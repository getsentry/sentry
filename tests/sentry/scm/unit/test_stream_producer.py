import msgspec

from fixtures.github import PULL_REQUEST_OPENED_EVENT_EXAMPLE
from sentry.scm.private.stream_producer import produce_event_to_scm_stream
from sentry.scm.types import SubscriptionEvent


def test_produce_to_scm_stream():
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


def test_produce_to_scm_stream_unsupported_provider():
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
            {"reason": "not-supported", "provider": event["type"]},
        )
    ]


def test_produce_to_scm_stream_invalid_payload():
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


def test_produce_to_scm_stream_rollout_disabled():
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

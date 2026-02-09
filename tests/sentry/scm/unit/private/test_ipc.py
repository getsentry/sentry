from sentry.scm.private.ipc import deserialize_subscription_event, serialize_subscription_event
from sentry.scm.types import SubscriptionEvent


def test_subscription_event_serialization():
    event: SubscriptionEvent = {
        "event": b"hello, world",
        "event_type_hint": "something",
        "extra": {"hello": "world"},
        "received_at": 22,
        "sentry_meta": [
            {"id": None, "integration_id": 1, "organization_id": 2},
            {"id": 1, "integration_id": 2, "organization_id": 3},
        ],
        "type": "github",
    }

    assert (
        deserialize_subscription_event(serialize_subscription_event(event), lambda _: None) == event
    )


def test_subscription_event_deserialization_failure():
    assert deserialize_subscription_event(b"hello, world", lambda _: None) is None
    assert deserialize_subscription_event(b"", lambda _: None) is None

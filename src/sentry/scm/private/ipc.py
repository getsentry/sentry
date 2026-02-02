"""
This file implements a parallel SubscriptionEvent type. Its in the msgspec format rather than a
typed dictionary. We maintain a mapping between the two types. Msgspec gives us typed
deserialization and the typed dictionary gives us an import free calling convention when
serializing.

Both types are owned by the SCM platform and should not diverge without the team's knowledge.
Exposing the msgspec type is not preferred. It is an internal implementation detail. It is both an
optimization and a convenient, typed deserialization library.
"""

from collections.abc import Callable

import msgspec

from sentry.scm.subscriptions.types import SubscriptionEvent
from sentry.scm.types import ProviderName


class SubscriptionEventParser(msgspec.Struct, gc=False):
    received_at: int
    type: ProviderName
    event_type_hint: str | None
    event: bytes
    extra: dict[str, str | None | bool | int | float]
    sentry_meta: list["SubscriptionEventSentryMetaParser"] | None


class SubscriptionEventSentryMetaParser(msgspec.Struct, gc=False):
    id: int | None
    integration_id: int
    organization_id: int


# A decoder global is defined. This is a performance optimization. Because this decoder will be
# repeatedly called within a Kafka consumer (which should have a reasonably tight loop) this
# optimization will improve deserialization performance for most consumer types (especially types
# with rare events).
decoder = msgspec.msgpack.Decoder(SubscriptionEventParser)


def deserialize_event(
    event: bytes, report_exception: Callable[[Exception], None]
) -> SubscriptionEvent | None:
    try:
        result = decoder.decode(event)
        return {
            "event": result.event,
            "event_type_hint": result.event_type_hint,
            "extra": result.extra,
            "received_at": result.received_at,
            "sentry_meta": [
                {
                    "id": item.id,
                    "integration_id": item.integration_id,
                    "organization_id": item.organization_id,
                }
                for item in result.sentry_meta
            ],
            "type": result.type,
        }
    except msgspec.DecodeError as e:
        report_exception(e)
        return None

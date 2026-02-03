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
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.scm.subscriptions.types import SubscriptionEvent
from sentry.scm.types import ProviderName
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition


# GC is disabled. You MUST NEVER use this in such a way that a reference cycle is created.
# Fortunately this is a private struct not intended for use anywhere but here. So as long as we
# know what to do we can give great performace to our consumers transparently.
#
# Frozen is set to ensure immuatability. Attributes may not be changed after being set.
#
# To gain a 7% performance uplift we can set "array_like=True". However, this will significantly
# impact our ability to change the schema with little benefit to consumers and producers.
class SubscriptionEventParser(msgspec.Struct, gc=False, frozen=True):
    event_type_hint: str | None
    event: bytes
    extra: dict[str, str | None | bool | int | float]
    received_at: int
    sentry_meta: list["SubscriptionEventSentryMetaParser"] | None
    type: ProviderName


class SubscriptionEventSentryMetaParser(msgspec.Struct, gc=False, frozen=True):
    id: int | None
    integration_id: int
    organization_id: int


# $$$$$$$\                                          $$\           $$\ $$\
# $$  __$$\                                         \__|          $$ |\__|
# $$ |  $$ | $$$$$$\   $$$$$$$\  $$$$$$\   $$$$$$\  $$\  $$$$$$\  $$ |$$\ $$$$$$$$\  $$$$$$\   $$$$$$\
# $$ |  $$ |$$  __$$\ $$  _____|$$  __$$\ $$  __$$\ $$ | \____$$\ $$ |$$ |\____$$  |$$  __$$\ $$  __$$\
# $$ |  $$ |$$$$$$$$ |\$$$$$$\  $$$$$$$$ |$$ |  \__|$$ | $$$$$$$ |$$ |$$ |  $$$$ _/ $$$$$$$$ |$$ |  \__|
# $$ |  $$ |$$   ____| \____$$\ $$   ____|$$ |      $$ |$$  __$$ |$$ |$$ | $$  _/   $$   ____|$$ |
# $$$$$$$  |\$$$$$$$\ $$$$$$$  |\$$$$$$$\ $$ |      $$ |\$$$$$$$ |$$ |$$ |$$$$$$$$\ \$$$$$$$\ $$ |
# \_______/  \_______|\_______/  \_______|\__|      \__| \_______|\__|\__|\________| \_______|\__|


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


#  $$$$$$\                      $$\           $$\ $$\
# $$  __$$\                     \__|          $$ |\__|
# $$ /  \__| $$$$$$\   $$$$$$\  $$\  $$$$$$\  $$ |$$\ $$$$$$$$\  $$$$$$\   $$$$$$\
# \$$$$$$\  $$  __$$\ $$  __$$\ $$ | \____$$\ $$ |$$ |\____$$  |$$  __$$\ $$  __$$\
#  \____$$\ $$$$$$$$ |$$ |  \__|$$ | $$$$$$$ |$$ |$$ |  $$$$ _/ $$$$$$$$ |$$ |  \__|
# $$\   $$ |$$   ____|$$ |      $$ |$$  __$$ |$$ |$$ | $$  _/   $$   ____|$$ |
# \$$$$$$  |\$$$$$$$\ $$ |      $$ |\$$$$$$$ |$$ |$$ |$$$$$$$$\ \$$$$$$$\ $$ |
#  \______/  \_______|\__|      \__| \_______|\__|\__|\________| \_______|\__|


encoder = msgspec.msgpack.Encoder()


def serialize_event(event: SubscriptionEvent) -> bytes:
    structured_event = SubscriptionEventParser(
        event=event["event"],
        event_type_hint=event["event_type_hint"],
        extra=event["extra"],
        received_at=event["received_at"],
        sentry_meta=[
            SubscriptionEventSentryMetaParser(
                id=item["id"],
                integration_id=item["integration_id"],
                organization_id=item["organization_id"],
            )
            for item in event["sentry_meta"]
        ],
        type=event["type"],
    )

    return encoder.encode(structured_event)


# $$$$$$$\            $$\       $$\ $$\           $$\
# $$  __$$\           $$ |      $$ |\__|          $$ |
# $$ |  $$ |$$\   $$\ $$$$$$$\  $$ |$$\  $$$$$$$\ $$$$$$$\   $$$$$$\   $$$$$$\
# $$$$$$$  |$$ |  $$ |$$  __$$\ $$ |$$ |$$  _____|$$  __$$\ $$  __$$\ $$  __$$\
# $$  ____/ $$ |  $$ |$$ |  $$ |$$ |$$ |\$$$$$$\  $$ |  $$ |$$$$$$$$ |$$ |  \__|
# $$ |      $$ |  $$ |$$ |  $$ |$$ |$$ | \____$$\ $$ |  $$ |$$   ____|$$ |
# $$ |      \$$$$$$  |$$$$$$$  |$$ |$$ |$$$$$$$  |$$ |  $$ |\$$$$$$$\ $$ |
# \__|       \______/ \_______/ \__|\__|\_______/ \__|  \__| \_______|\__|


ingest_scm_subscription_events = SingletonProducer(
    lambda: get_arroyo_producer(
        name="sentry.scm.subscription_events",
        topic=Topic.INGEST_SCM_SUBSCRIPTION_EVENTS,
    )
)


def publish_subscription_event(event: SubscriptionEvent) -> None:
    """
    Publish source code management service provider subscription events to the
    ingest-scm-subscription-events topic.

    Events are encoded with msgpack. Exact details listed in the msgspec structs above.
    """
    ingest_scm_subscription_events.produce(
        ArroyoTopic(get_topic_definition(Topic.INGEST_SCM_SUBSCRIPTION_EVENTS)["real_topic_name"]),
        payload=KafkaPayload(None, serialize_event(event), []),
    )

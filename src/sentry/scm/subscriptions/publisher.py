import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.scm.subscriptions.types import SubscriptionEvent
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition

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

    Events are encoded with msgpack.

    Messages published to the topic have had their provedence asserted. They are genuine requests
    and can be trusted. Untrusted messages must never be published to this topic. There is no
    gurantee down-stream consumers will validate the message's authenticity.
    """
    ingest_scm_subscription_events.produce(
        ArroyoTopic(get_topic_definition(Topic.INGEST_SCM_SUBSCRIPTION_EVENTS)["real_topic_name"]),
        payload=KafkaPayload(None, msgpack.packb(event), []),
    )

from __future__ import annotations

import logging
from datetime import timedelta
from uuid import uuid4

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka.configuration import build_kafka_configuration
from arroyo.backends.kafka.consumer import KafkaPayload, KafkaProducer
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.uptime_configs_v1 import CheckConfig

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.snuba.models import QuerySubscription
from sentry.tasks.base import instrumented_task
from sentry.uptime.models import UptimeSubscription
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


SUBSCRIPTION_STATUS_MAX_AGE = timedelta(minutes=10)
uptime_config_producer: KafkaProducer | None = None
uptime_config_codec: Codec | None = None


def _get_subscription_producer() -> KafkaProducer:
    global uptime_config_producer
    if uptime_config_producer is None:
        cluster_name = get_topic_definition(Topic.UPTIME_CONFIG)["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        producer_config.pop("compression.type", None)
        producer_config.pop("message.max.bytes", None)
        uptime_config_producer = KafkaProducer(
            build_kafka_configuration(default_config=producer_config)
        )

    return uptime_config_producer


def _get_config_codec() -> Codec:
    global uptime_config_codec
    if uptime_config_codec is None:
        uptime_config_codec = get_topic_codec(Topic.UPTIME_CONFIG)
    return uptime_config_codec


def get_uptime_config_topic() -> ArroyoTopic:
    return ArroyoTopic(get_topic_definition(Topic.UPTIME_CONFIG)["real_topic_name"])


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.create_uptime_subscription",
    queue="uptime",
    default_retry_delay=5,
    max_retries=5,
)
def create_remote_uptime_subscription(uptime_subscription_id, **kwargs):
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.create.subscription_does_not_exist")
        return
    if subscription.status != UptimeSubscription.Status.CREATING.value:
        metrics.incr("uptime.subscriptions.create.incorrect_status")
        return

    subscription_id = send_uptime_subscription_config(subscription)
    # TODO: Ideally this should actually be `PENDING_FIRST_UPDATE` so we can validate it's really working as expected
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value, subscription_id=subscription_id
    )


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.update_uptime_subscription",
    queue="uptime",
    default_retry_delay=5,
    max_retries=5,
)
def update_remote_uptime_subscription(uptime_subscription_id, **kwargs):
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.update.subscription_does_not_exist")
        return
    if subscription.status != UptimeSubscription.Status.UPDATING.value:
        metrics.incr("uptime.subscriptions.update.incorrect_status")
        return

    old_subscription_id = subscription.subscription_id
    new_subscription_id = send_uptime_subscription_config(subscription)
    # TODO: Ideally this should actually be `PENDING_FIRST_UPDATE` so we can validate it's really working as expected
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value, subscription_id=new_subscription_id
    )

    if old_subscription_id is not None:
        # If we crash before we do this we don't really care - this subscription will be detected as unused in the
        # result consumer and we'll remove it then.
        send_uptime_config_deletion(old_subscription_id)


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.delete_uptime_subscription",
    queue="uptime",
    default_retry_delay=5,
    max_retries=5,
)
def delete_remote_uptime_subscription(uptime_subscription_id, **kwargs):
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.delete.subscription_does_not_exist")
        return

    if subscription.status not in [
        UptimeSubscription.Status.DELETING.value,
        UptimeSubscription.Status.DISABLED.value,
    ]:
        metrics.incr("uptime.subscriptions.delete.incorrect_status")
        return

    subscription_id = subscription.subscription_id
    if subscription.status == QuerySubscription.Status.DELETING.value:
        subscription.delete()
    else:
        subscription.update(subscription_id=None)

    if subscription_id is not None:
        send_uptime_config_deletion(subscription.subscription_id)


def send_uptime_subscription_config(subscription: UptimeSubscription) -> str:
    # Whenever we create/update a config we always want to generate a new subscription id. This allows us to validate
    # that the config took effect
    subscription_id = uuid4().hex
    check_config = uptime_subscription_to_check_config(subscription, subscription_id)
    send_uptime_config_message(subscription_id, _get_config_codec().encode(check_config))
    return subscription_id


def uptime_subscription_to_check_config(
    subscription: UptimeSubscription, subscription_id: str
) -> CheckConfig:
    return {
        "subscription_id": subscription_id,
        "url": subscription.url,
        "interval_seconds": subscription.interval_seconds,  # type: ignore[typeddict-item]
        "timeout_ms": subscription.timeout_ms,
    }


def send_uptime_config_deletion(subscription_id: str) -> None:
    send_uptime_config_message(subscription_id, b"")


def send_uptime_config_message(subscription_id: str, value: bytes) -> None:
    producer = _get_subscription_producer()
    message_key = md5_text(subscription_id).hexdigest().encode()
    payload = KafkaPayload(message_key, value, [])
    result = producer.produce(get_uptime_config_topic(), payload)
    # Wait to make sure we successfully produced to Kafka
    result.result()

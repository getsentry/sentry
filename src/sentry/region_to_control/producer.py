import dataclasses
from typing import Optional

from django.conf import settings

from sentry.models import UserIP
from sentry.region_to_control.messages import RegionToControlMessage, UserIpEvent
from sentry.silo import SiloMode
from sentry.utils import json, kafka_config
from sentry.utils.pubsub import KafkaPublisher


def produce_user_ip(event: UserIpEvent):
    if _should_produce_to_kafka():
        get_user_ip_publisher().publish(
            settings.KAFKA_REGION_TO_CONTROL,
            json.dumps(dataclasses.asdict(RegionToControlMessage(user_ip_event=event))),
        )
    else:
        UserIP.objects.create_or_update(
            user_id=event.user_id, ip_address=event.ip_address, values=dataclasses.asdict(event)
        )


_user_ip_publisher: Optional[KafkaPublisher] = None


def get_user_ip_publisher() -> KafkaPublisher:
    """
    Locks in the configuration for a KafkaPublisher on first usage.  KafkaPublishers are thread safe in practice
    due to librdkafka which implements the CPython client, as messages are processed in a separate thread + queue
    at that level.
    """
    global _user_ip_publisher
    if _user_ip_publisher is None:
        config = settings.KAFKA_TOPICS.get(settings.KAFKA_REGION_TO_CONTROL)
        _user_ip_publisher = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"])
        )
    return _user_ip_publisher


def _should_produce_to_kafka():
    from sentry import options

    mode = SiloMode.get_current_mode()
    is_region = mode == SiloMode.REGION
    is_mono_with_producer = mode == SiloMode.MONOLITH and options.get(
        "hc.region-to-control.monolith-publish"
    )
    return is_region or is_mono_with_producer

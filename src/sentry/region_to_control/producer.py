import atexit
import dataclasses
from typing import Any, Optional

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from django.conf import settings

from sentry.models import AuditLogEntry, UserIP
from sentry.region_to_control.messages import RegionToControlMessage, UserIpEvent
from sentry.silo import SiloMode
from sentry.utils import json, kafka_config


def produce_user_ip(event: UserIpEvent):
    if _should_produce_to_kafka():
        write_region_to_control_message(
            dataclasses.asdict(RegionToControlMessage(user_ip_event=event)), sync=False
        )
    else:
        UserIP.objects.create_or_update(
            user_id=event.user_id, ip_address=event.ip_address, values=dataclasses.asdict(event)
        )


def produce_audit_log_entry(entry: AuditLogEntry):
    if _should_produce_to_kafka():
        write_region_to_control_message(
            dataclasses.asdict(RegionToControlMessage(audit_log_event=entry.as_kafka_event())),
            sync=True,
        )
    else:
        entry.save()


_publisher: Optional[KafkaProducer] = None
_empty_headers = list()


# TODO: Would be nice to configure the timeout via a dynamic setting.
def write_region_to_control_message(payload: Any, sync=True, timeout=0.1):
    future = get_region_to_control_producer().produce(
        Topic(settings.KAFKA_REGION_TO_CONTROL),
        KafkaPayload(
            key=None,
            value=json.dumps(payload).encode("utf8"),
            headers=_empty_headers,
        ),
    )

    if not sync:
        return

    future.result(timeout)


def get_region_to_control_producer() -> KafkaProducer:
    """
    Locks in the configuration for a KafkaProducer on first usage.  KafkaProducers are thread safe in practice
    due to librdkafka which implements the CPython client, as messages are processed in a separate thread + queue
    at that level.
    """
    global _publisher
    if _publisher is None:
        config = settings.KAFKA_TOPICS.get(settings.KAFKA_REGION_TO_CONTROL)
        _publisher = KafkaProducer(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"])
        )

        @atexit.register
        def exit_handler():
            _publisher.close()

    return _publisher


def _should_produce_to_kafka():
    from sentry import options

    mode = SiloMode.get_current_mode()
    is_region = mode == SiloMode.REGION
    is_mono_with_producer = mode == SiloMode.MONOLITH and options.get(
        "hc.region-to-control.monolith-publish"
    )
    return is_region or is_mono_with_producer

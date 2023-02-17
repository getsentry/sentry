import logging
from typing import Any, List, MutableMapping, MutableSequence, Union

from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.types import Message
from django.conf import settings

from sentry.sentry_metrics.consumers.indexer.routing_producer import RoutingPayload
from sentry.utils import kafka_config

MessageBatch = List[Message[KafkaPayload]]
IndexerOutputMessageBatch = MutableSequence[Message[Union[RoutingPayload, KafkaPayload]]]

logger = logging.getLogger(__name__)

DEFAULT_QUEUED_MAX_MESSAGE_KBYTES = 50000
DEFAULT_QUEUED_MIN_MESSAGES = 100000


def get_config(
    topic: str, group_id: str, auto_offset_reset: str, strict_offset_reset: bool
) -> MutableMapping[Any, Any]:
    cluster_name: str = settings.KAFKA_TOPICS[topic]["cluster"]
    consumer_config: MutableMapping[str, Any] = build_kafka_consumer_configuration(
        kafka_config.get_kafka_consumer_cluster_options(
            cluster_name,
        ),
        group_id=group_id,
        auto_offset_reset=auto_offset_reset,
        strict_offset_reset=strict_offset_reset,
        queued_max_messages_kbytes=DEFAULT_QUEUED_MAX_MESSAGE_KBYTES,
        queued_min_messages=DEFAULT_QUEUED_MIN_MESSAGES,
    )
    return consumer_config

from typing import MutableMapping, Optional

from arroyo import Message, Topic
from arroyo.backends.kafka import KafkaPayload
from confluent_kafka import Producer
from django.conf import settings

from sentry.ingest.partitioning import (
    Sliceable,
    is_sliced,
    map_logical_partition_to_slice,
    map_org_id_to_logical_partition,
)
from sentry.sentry_metrics.consumers.indexer.routing_producer import MessageRoute, MessageRouter
from sentry.utils import kafka_config


class SlicingRouter(MessageRouter[KafkaPayload]):
    def __init__(
        self,
        sliceable: Sliceable,
        logical_output_topic: str,
    ) -> None:
        self.__sliceable = sliceable
        self.__logical_output_topic = logical_output_topic
        self.__slice_to_producer: MutableMapping[int, MessageRoute] = {}

        if not is_sliced(self.__sliceable):
            self.__slice_to_producer[0] = MessageRoute(
                producer=Producer(
                    kafka_config.get_kafka_producer_cluster_options(
                        settings.KAFKA_TOPICS[self.__logical_output_topic]["cluster"]
                    )
                ),
                topic=Topic(self.__logical_output_topic),
            )
            self.__slicing_enabled = False
        else:
            for (
                current_sliceable,
                current_slice_id,
            ), config in settings.SLICED_KAFKA_BROKER_CONFIG.items():
                self.__slice_to_producer[current_slice_id] = MessageRoute(
                    producer=Producer(config),
                    topic=Topic(
                        settings.SLICED_KAFKA_TOPIC_MAP[(current_sliceable, current_slice_id)]
                    ),
                )
            assert len(self.__slice_to_producer) == len(
                settings.SENTRY_SLICING_CONFIG[sliceable].keys()
            )
            self.__slicing_enabled = True

    def get_route_for_message(self, message: Message[KafkaPayload]) -> MessageRoute:
        """
        Get route for the message. If slicing is enabled, the message will be routed
        based on the mapping of partition to slice. If slicing is disabled, the message
        will be routed to the default topic.
        """
        if not self.__slicing_enabled:
            return self.__slice_to_producer[0]

        org_id: Optional[int] = None
        for header in message.payload.headers:
            if header[0] == "org_id":
                org_id = int(header[1])
                break

        if org_id is None:
            producer = self.__slice_to_producer[0]
        else:
            slice_id = map_logical_partition_to_slice(
                self.__sliceable, map_org_id_to_logical_partition(org_id)
            )
            producer = self.__slice_to_producer[slice_id]

        return producer

    def shutdown(self, timeout: Optional[float] = None) -> None:
        for route in self.__slice_to_producer.values():
            route.producer.close()

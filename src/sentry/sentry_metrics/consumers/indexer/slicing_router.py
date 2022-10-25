from typing import MutableMapping, Optional

from arroyo import Message, Topic
from arroyo.backends.kafka import KafkaPayload
from confluent_kafka import Producer
from django.conf import settings

from sentry.ingest.partitioning import Sliceable
from sentry.sentry_metrics.consumers.indexer.routing_producer import MessageRoute, MessageRouter
from sentry.utils import kafka_config


class SlicingRouter(MessageRouter):
    def __init__(
        self,
        sliceable: Sliceable,
        logical_output_topic: str,
    ) -> None:
        self.__sliceable = sliceable
        self.__logical_output_topic = logical_output_topic
        self.__slice_to_producer: MutableMapping[int, MessageRoute] = {}

        if self.__sliceable not in settings.SENTRY_SLICING_CONFIG.keys():
            self.__slice_to_producer[0] = MessageRoute(
                producer=Producer(
                    kafka_config.get_kafka_producer_cluster_options(
                        settings.KAFKA_TOPICS[self.__logical_output_topic]["cluster"]
                    )
                ),
                topic=Topic(self.__logical_output_topic),
            )
        else:
            for (
                current_sliceable,
                current_slice_id,
            ), config in settings.SLICED_KAFKA_BROKER_CONFIG.items():
                self.__slice_to_producer[current_slice_id] = MessageRoute(
                    producer=Producer(config),
                    topic=Topic(settings.SLICED_KAFKA_TOPIC_MAP[self.__logical_output_topic]),
                )

        if len(settings.SLICED_KAFKA_TOPIC_MAP) == 0:
            self.__slice_to_producer[0] = Producer(
                kafka_config.get_kafka_producer_cluster_options(
                    settings.KAFKA_TOPICS[self.__output_topic]["cluster"]
                )
            )
            self.__slice_to_producer_topic[0] = self.__output_topic
        else:
            for (_, slice_id), config in settings.SLICED_KAFKA_BROKER_CONFIG.items():
                self.__slice_to_producer[slice_id] = Producer(config)
            for (_, slice_id), topic in settings.SLICED_KAFKA_TOPIC_MAP.items():
                self.__slice_to_producer_topic[slice_id] = topic

        assert len(self.__slice_to_producer) == len(self.__slice_to_producer_topic)

        return dict(zip(self.__slice_to_producer.values(), self.__slice_to_producer_topic.values()))

    def get_route_for_message(self, message: Message[KafkaPayload]) -> MessageRoute:
        pass

    def shutdown(self, timeout: Optional[float] = None) -> None:
        pass

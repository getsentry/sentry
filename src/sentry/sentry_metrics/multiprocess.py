import functools
import logging
from typing import Any, Dict, MutableMapping, Optional, Sequence

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.processing.strategies.streaming import KafkaConsumerStrategyFactory
from confluent_kafka import Producer
from django.conf import settings

from sentry.utils import json, kafka_config

DEFAULT_QUEUED_MAX_MESSAGE_KBYTES = 50000
DEFAULT_QUEUED_MIN_MESSAGES = 10000

logger = logging.getLogger(__name__)


def initializer():
    from sentry.runner import configure

    configure()


def get_config(topic: str, **options) -> MutableMapping[str, Any]:
    consumer_config = kafka_config.get_kafka_consumer_cluster_options(
        "default",
        override_params={
            "enable.auto.commit": False,
            "enable.auto.offset.store": False,
            "group.id": "ingest-metrics-consumer",
            "default.topic.config": {"auto.offset.reset": "latest"},
            # overridden to reduce memory usage when there's a large backlog
            "queued.max.messages.kbytes": DEFAULT_QUEUED_MAX_MESSAGE_KBYTES,
            "queued.min.messages": DEFAULT_QUEUED_MIN_MESSAGES,
        },
    )
    return consumer_config


class FlushBatchStep(ProcessingStep):
    def __init__(self) -> None:
        snuba_metrics = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS]
        snuba_metrics_producer = Producer(
            kafka_config.get_kafka_producer_cluster_options(snuba_metrics["cluster"]),
        )
        self.__producer = snuba_metrics_producer
        self.__producer_topic = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS].get(
            "topic", "snuba-metrics"
        )

        self.__messages = []
        self.__closed = False

    def poll(self) -> None:
        pass

    def submit(self, message: Any) -> None:
        assert not self.__closed

        self.__producer.produce(
            topic=self.__producer_topic,
            key=None,
            value=json.dumps(message.payload).encode(),
            on_delivery=self._callback,
        )

        messages_left = self.__producer.flush(1.0)

        if messages_left != 0:
            # TODO(meredith): We are not currently keeping track of
            # which callbacks failed. This means could potentially
            # be duplicating messages since we don't commit offsets
            # unless all the callbacks are successful.
            #
            # In the future if we know which callback failed, we can
            # commit only up to that point and retry on the remaining
            # messages.
            raise Exception(f"didn't get all the callbacks: {messages_left} left")

        self.__messages.append(message)

    def _callback(self, error: Any, message: Any) -> None:
        if error is not None:
            raise Exception(error.str())

    def close(self) -> None:
        self.__closed = True

        if not self.__messages:
            return

        # if we have successfully produced messages to the snuba-metrics topic
        # then enque task to send a slimmed down payload to the product metrics data model.
        # TODO(meredith): once we know more about what the product data model needs
        # adjust payload to send the necessary data
        # messages = [
        #     {"tags": m.payload["tags"], "name": m.payload["name"], "org_id": m.payload["org_id"]}
        #     for m in self.__messages
        # ]
        # process_indexed_metrics.apply_async(kwargs={"messages": messages})
        self.__messages = []

    def terminate(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        pass


def flush_batch():
    return FlushBatchStep()


@functools.lru_cache(maxsize=10)
def get_indexer():
    from sentry.sentry_metrics import indexer

    return indexer


def process_messages(messages: Any) -> Sequence[MutableMapping[str, Any]]:
    indexer = get_indexer()

    strings = set()
    parsed_messages = [
        json.loads(message.payload.value, use_rapid_json=True) for message in messages
    ]

    for message in parsed_messages:
        metric_name = message["name"]
        tags = message.get("tags", {})

        parsed_strings = {
            metric_name,
            *tags.keys(),
            *tags.values(),
        }
        strings.update(parsed_strings)

    mapping = indexer.bulk_record(list(strings))  # type: ignore

    for i, message in enumerate(parsed_messages):
        metric_name = parsed_messages[i]["name"]
        tags = parsed_messages[i].get("tags", {})

        new_tags = {mapping[k]: mapping[v] for k, v in tags.items()}

        message["tags"] = new_tags
        message["metric_id"] = mapping[metric_name]
        message["retention_days"] = 90

    return parsed_messages


def get_streaming_metrics_consumer(topic: str, **options: Dict[str, str]) -> StreamProcessor:
    DEFAULT_BLOCK_SIZE = int(32 * 1e6)
    processing_factory = KafkaConsumerStrategyFactory(
        None,
        process_messages,
        flush_batch,
        max_batch_size=4,
        max_batch_time=1000.0,
        processes=2,
        input_block_size=DEFAULT_BLOCK_SIZE,
        output_block_size=DEFAULT_BLOCK_SIZE,
        initialize_parallel_transform=initializer,
        batch_execute=True,
    )
    return StreamProcessor(
        KafkaConsumer(get_config(topic, **options)),
        Topic(topic),
        processing_factory,
    )

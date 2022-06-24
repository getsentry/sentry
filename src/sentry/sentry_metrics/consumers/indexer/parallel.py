from __future__ import annotations

import functools
from functools import partial
from typing import Callable, Mapping, Union

from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.streaming.transform import ParallelTransformStep
from arroyo.types import Partition, Position, Topic
from django.conf import settings

from sentry.sentry_metrics.configuration import MetricsIngestConfiguration
from sentry.sentry_metrics.consumers.indexer.multiprocess import (
    BatchMessages,
    SimpleProduceStep,
    get_config,
    process_messages,
)
from sentry.utils.batching_kafka_consumer import create_topics


@functools.lru_cache(maxsize=10)
def get_metrics():  # type: ignore
    from sentry.utils import metrics

    return metrics


def initializer() -> None:
    from sentry.runner import configure

    configure()


class MetricsConsumerStrategyFactory(ProcessingStrategyFactory):  # type: ignore
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: float,
        processes: int,
        input_block_size: int,
        output_block_size: int,
        config: MetricsIngestConfiguration,
    ):
        self.__config = config
        self.__max_batch_time = max_batch_time
        self.__max_batch_size = max_batch_size

        self.__processes = processes

        self.__input_block_size = input_block_size
        self.__output_block_size = output_block_size

    def create(
        self, commit: Callable[[Mapping[Partition, Position]], None]
    ) -> ProcessingStrategy[KafkaPayload]:
        parallel_strategy = ParallelTransformStep(
            partial(process_messages, self.__config.use_case_id),
            SimpleProduceStep(
                commit_function=commit,
                commit_max_batch_size=self.__commit_max_batch_size,
                # convert to seconds
                commit_max_batch_time=self.__commit_max_batch_time / 1000,
                output_topic=self.__config.output_topic,
            ),
            self.__processes,
            max_batch_size=self.__max_batch_size,
            max_batch_time=self.__max_batch_time,
            input_block_size=self.__input_block_size,
            output_block_size=self.__output_block_size,
            initializer=initializer,
        )

        strategy = BatchMessages(parallel_strategy, self.__max_batch_time, self.__max_batch_size)

        return strategy


def get_streaming_metrics_consumer(
    topic: str,
    commit_max_batch_size: int,
    commit_max_batch_time: int,
    max_batch_size: int,
    max_batch_time: float,
    processes: int,
    input_block_size: int,
    output_block_size: int,
    group_id: str,
    auto_offset_reset: str,
    factory_name: str,
    indexer_profile: MetricsIngestConfiguration,
    **options: Mapping[str, Union[str, int]],
) -> StreamProcessor:
    assert factory_name == "multiprocess"
    processing_factory = MetricsConsumerStrategyFactory(
        max_batch_size=max_batch_size,
        max_batch_time=max_batch_time,
        processes=processes,
        input_block_size=input_block_size,
        output_block_size=output_block_size,
        config=indexer_profile,
    )

    cluster_name: str = settings.KAFKA_TOPICS[indexer_profile.input_topic]["cluster"]
    create_topics(cluster_name, [indexer_profile.input_topic])

    return StreamProcessor(
        KafkaConsumer(get_config(indexer_profile.input_topic, group_id, auto_offset_reset)),
        Topic(indexer_profile.input_topic),
        processing_factory,
    )

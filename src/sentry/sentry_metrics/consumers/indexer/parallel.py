from __future__ import annotations

import functools
import logging
from typing import Any, Mapping, Optional, Union, cast

from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.processing.strategies import ProcessingStrategyFactory
from arroyo.processing.strategies.transform import ParallelTransformStep
from arroyo.types import Commit, FilteredPayload, Message, Partition, Topic

from sentry.sentry_metrics.configuration import (
    MetricsIngestConfiguration,
    initialize_sentry_and_global_consumer_state,
)
from sentry.sentry_metrics.consumers.indexer.common import (
    BatchMessages,
    IndexerOutputMessageBatch,
    get_config,
)
from sentry.sentry_metrics.consumers.indexer.multiprocess import SimpleProduceStep
from sentry.sentry_metrics.consumers.indexer.processing import MessageProcessor
from sentry.sentry_metrics.consumers.indexer.routing_producer import (
    RoutingPayload,
    RoutingProducerStep,
)
from sentry.sentry_metrics.consumers.indexer.slicing_router import SlicingRouter

logger = logging.getLogger(__name__)


class Unbatcher(ProcessingStep[Union[FilteredPayload, IndexerOutputMessageBatch]]):
    def __init__(
        self,
        next_step: ProcessingStep[Union[KafkaPayload, RoutingPayload]],
    ) -> None:
        self.__next_step = next_step
        self.__closed = False

    def poll(self) -> None:
        self.__next_step.poll()

    def submit(self, message: Message[Union[FilteredPayload, IndexerOutputMessageBatch]]) -> None:
        assert not self.__closed

        # FilteredPayloads are not handled in the indexer
        for transformed_message in cast(IndexerOutputMessageBatch, message.payload):
            self.__next_step.submit(transformed_message)

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__closed = True

        logger.debug("Terminating %r...", self.__next_step)
        self.__next_step.terminate()

    def join(self, timeout: Optional[float] = None) -> None:
        self.__next_step.close()
        self.__next_step.join(timeout)


class MetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """
    Builds an indexer consumer based on the multi process transform Arroyo step.

    Multi processing happens in batches, the parallel step batches messages, then
    it dispatches them to a process. This is meant to avoid lock contention that
    would happen by transferring one message at a time.
    The parallel transform function is then applied to all messages one by one.

    The indexer must resolve batches of messages. It cannot resolve messages in
    isolation otherwise the amount of roundtrip to cache would be enormous.
    So the pipeline works this way:
    - the indexer batches messages like today.
    - each batch is a message for the parallel transform step.
    - the parallel transform step may or may not re-batch messages batcehs
      together. The load tests show it is still useful.
    - messages are exploded back into individual ones after the parallel
      transform step.
    """

    def __init__(
        self,
        max_msg_batch_size: int,
        max_msg_batch_time: float,
        max_parallel_batch_size: int,
        max_parallel_batch_time: float,
        processes: int,
        input_block_size: int,
        output_block_size: int,
        config: MetricsIngestConfiguration,
        slicing_router: Optional[SlicingRouter],
    ):
        self.__config = config

        # This is the size of the initial message batching the indexer does
        self.__max_msg_batch_size = max_msg_batch_size
        self.__max_msg_batch_time = max_msg_batch_time

        # This is the size of the batches sent to the parallel processes.
        # These are batches of batches.
        self.__max_parallel_batch_size = max_parallel_batch_size
        self.__max_parallel_batch_time = max_parallel_batch_time

        self.__processes = processes

        self.__input_block_size = input_block_size
        self.__output_block_size = output_block_size
        self.__slicing_router = slicing_router

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        producer = get_metrics_producer_strategy(
            config=self.__config,
            commit=commit,
            slicing_router=self.__slicing_router,
        )
        parallel_strategy = ParallelTransformStep(
            MessageProcessor(self.__config).process_messages,
            Unbatcher(next_step=producer),
            self.__processes,
            max_batch_size=self.__max_parallel_batch_size,
            # This is in seconds
            max_batch_time=self.__max_parallel_batch_time / 1000,
            input_block_size=self.__input_block_size,
            output_block_size=self.__output_block_size,
            # It is absolutely crucial that we pass a function reference here
            # where the function lives in a module that does not depend on
            # Django settings. `sentry.sentry_metrics.configuration` fulfills
            # that requirement, but if you were to create a wrapper function in
            # this module, and pass that function here, it would attempt to
            # pull in a bunch of modules that try to read django settings at
            # import time
            initializer=functools.partial(
                initialize_sentry_and_global_consumer_state, self.__config
            ),
        )

        strategy = BatchMessages(
            parallel_strategy, self.__max_msg_batch_time, self.__max_msg_batch_size
        )

        return strategy


def get_metrics_producer_strategy(
    config: MetricsIngestConfiguration,
    commit: Commit,
    slicing_router: Optional[SlicingRouter],
) -> Any:
    if config.is_output_sliced:
        if slicing_router is None:
            raise ValueError("Slicing router is required for sliced output")
        return RoutingProducerStep(
            commit_function=commit,
            message_router=slicing_router,
        )
    else:
        return SimpleProduceStep(
            commit_function=commit,
            output_topic=config.output_topic,
        )


def get_parallel_metrics_consumer(
    max_msg_batch_size: int,
    max_msg_batch_time: float,
    max_parallel_batch_size: int,
    max_parallel_batch_time: float,
    processes: int,
    input_block_size: int,
    output_block_size: int,
    group_id: str,
    auto_offset_reset: str,
    strict_offset_reset: bool,
    indexer_profile: MetricsIngestConfiguration,
    slicing_router: Optional[SlicingRouter],
) -> StreamProcessor[KafkaPayload]:
    processing_factory = MetricsConsumerStrategyFactory(
        max_msg_batch_size=max_msg_batch_size,
        max_msg_batch_time=max_msg_batch_time,
        max_parallel_batch_size=max_parallel_batch_size,
        max_parallel_batch_time=max_parallel_batch_time,
        processes=processes,
        input_block_size=input_block_size,
        output_block_size=output_block_size,
        config=indexer_profile,
        slicing_router=slicing_router,
    )

    return StreamProcessor(
        KafkaConsumer(
            get_config(
                indexer_profile.input_topic,
                group_id,
                auto_offset_reset=auto_offset_reset,
                strict_offset_reset=strict_offset_reset,
            )
        ),
        Topic(indexer_profile.input_topic),
        processing_factory,
        ONCE_PER_SECOND,
    )

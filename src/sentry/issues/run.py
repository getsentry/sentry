import logging
from typing import Mapping, Optional

import rapidjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.types import Commit, Message, Partition

from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing

logger = logging.getLogger(__name__)


class OccurrenceStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: Optional[int],
        output_block_size: Optional[int],
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.pool = MultiprocessingPool(num_processes)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskWithMultiprocessing(
            function=process_message,
            next_step=CommitOffsets(commit),
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def shutdown(self) -> None:
        self.pool.close()


def process_message(message: Message[KafkaPayload]) -> None:
    from sentry.issues.occurrence_consumer import (
        EventLookupError,
        InvalidEventPayloadError,
        _process_message,
    )
    from sentry.utils import json, metrics

    try:
        with metrics.timer("occurrence_consumer.process_message"):
            payload = json.loads(message.payload.value, use_rapid_json=True)
            _process_message(payload)
    except (
        rapidjson.JSONDecodeError,
        InvalidEventPayloadError,
        EventLookupError,
        Exception,
    ):
        logger.exception("failed to process message payload")

import logging
from collections.abc import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, Message, Partition

from sentry.spans.consumers.recombine.message import process_segment
from sentry.utils import json

logger = logging.getLogger(__name__)


def process_message(message: Message[KafkaPayload]):
    assert isinstance(message.value, BrokerValue)
    try:
        process_segment(json.loads(message.payload.value))
    except Exception:
        logger.exception("Failed to process segment payload")


class RecombineSegmentStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )

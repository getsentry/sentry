import logging
import random
from collections.abc import Mapping

import sentry_sdk
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
        segments = json.loads(message.payload.value)
    except Exception:
        logger.exception("Failed to process segment payload")
        return

    try:
        process_segment(segments)
    except Exception as e:
        if random.random() < 0.05:
            sentry_sdk.capture_exception(e)


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

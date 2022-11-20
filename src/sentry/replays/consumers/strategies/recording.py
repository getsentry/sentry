from __future__ import annotations

import logging
import random
from typing import Callable, Mapping

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.replays.consumers.base import ProcessPoolStrategy
from sentry.replays.usecases.ingest import ingest_recording_not_chunked

logger = logging.getLogger("sentry.replays")

COMMIT_FREQUENCY_SEC = 1


class RecordingProcessorStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RecordingProcessorStrategy(commit)


class RecordingProcessorStrategy(ProcessPoolStrategy):
    def submit_message(self, message: Message[KafkaPayload]) -> None:
        self.apply_async(run, message)


def run(message: Message[KafkaPayload]) -> None:
    transaction = sentry_sdk.start_transaction(
        name="replays.consumers.strategies.recording",
        op="run",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )

    try:
        ingest_recording_not_chunked(message.payload.value, transaction)
    except Exception:
        logger.exception("Failed to process message", extra={"offset": message.offset})
        transaction.finish()

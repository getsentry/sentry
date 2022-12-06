from __future__ import annotations

import logging
import random
from typing import Callable, Mapping, cast

import msgpack
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTaskInThreads
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.replays.usecases.ingest import RecordingMessage, ingest_recording_not_chunked

logger = logging.getLogger("sentry.replays")

COMMIT_FREQUENCY_SEC = 1


class RecordingProcessorStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskInThreads(
            processing_function=run,
            concurrency=16,
            max_pending_futures=32,
            next_step=CommitOffsets(commit),
        )


def run(message: Message[KafkaPayload]) -> None:
    transaction = sentry_sdk.start_transaction(
        name="replays.consumers.strategies.recording",
        op="run",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )

    try:
        message_dict = msgpack.unpackb(message.payload.value)
        ingest_recording_not_chunked(cast(RecordingMessage, message_dict), transaction)
    except Exception:
        logger.exception("Failed to process message")
        transaction.finish()

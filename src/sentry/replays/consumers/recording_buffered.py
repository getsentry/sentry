import logging
from collections.abc import Mapping

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTask, RunTaskInThreads
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, FilteredPayload, Message, Partition
from django.conf import settings

from sentry.filestore.gcs import GCS_RETRYABLE_ERRORS
from sentry.replays.usecases.ingest import (
    DropSilently,
    ProcessedRecordingMessage,
    commit_recording_message,
    parse_recording_message,
    process_recording_message,
)

logger = logging.getLogger(__name__)


class RecordingBufferedStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self, max_pending_futures: int = 256, num_threads: int = 16) -> None:
        self.max_pending_futures = max_pending_futures
        self.num_threads = num_threads

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=RunTaskInThreads(
                processing_function=commit_message,
                concurrency=self.num_threads,
                max_pending_futures=self.max_pending_futures,
                next_step=CommitOffsets(commit),
            ),
        )


def process_message(message: Message[KafkaPayload]) -> ProcessedRecordingMessage | FilteredPayload:
    with sentry_sdk.start_transaction(
        name="replays.consumer.recording_buffered.process_message",
        op="replays.consumer.recording_buffered",
        custom_sampling_context={
            "sample_rate": getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0)
        },
    ):
        try:
            return process_recording_message(parse_recording_message(message.payload.value))
        except DropSilently:
            return FilteredPayload()
        except Exception:
            logger.exception("Failed to process replay recording message.")
            return FilteredPayload()


def commit_message(message: Message[ProcessedRecordingMessage]) -> None:
    with sentry_sdk.start_transaction(
        name="replays.consumer.recording_buffered.commit_message",
        op="replays.consumer.recording_buffered",
        custom_sampling_context={
            "sample_rate": getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0)
        },
    ):
        try:
            commit_recording_message(message.payload)
            return None
        except GCS_RETRYABLE_ERRORS:
            raise
        except Exception:
            logger.exception("Failed to commit replay recording message.")
            return None

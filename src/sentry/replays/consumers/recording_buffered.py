import logging
from collections.abc import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import FilterStep, RunTask, RunTaskInThreads
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message, Partition

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
            next_step=FilterStep(
                function=lambda message: message.payload is not None,
                next_step=RunTaskInThreads(
                    processing_function=commit_message,
                    concurrency=self.num_threads,
                    max_pending_futures=self.max_pending_futures,
                    next_step=CommitOffsets(commit),
                ),
            ),
        )


def process_message(message: Message[KafkaPayload]) -> ProcessedRecordingMessage | None:
    try:
        return process_recording_message(parse_recording_message(message.payload.value))
    except DropSilently:
        return None
    except Exception:
        logger.exception("Failed to process replay recording message.")
        return None


def commit_message(message: Message[ProcessedRecordingMessage]) -> None:
    try:
        commit_recording_message(message.payload)
        return None
    except GCS_RETRYABLE_ERRORS:
        raise
    except Exception:
        logger.exception("Failed to commit replay recording message.")
        return None

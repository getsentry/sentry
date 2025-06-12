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
    track_recording_metadata,
)

logger = logging.getLogger(__name__)


class ProcessReplayRecordingStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        input_block_size: int | None,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        output_block_size: int | None,
        num_threads: int = 4,  # Defaults to 4 for self-hosted.
        force_synchronous: bool = False,  # Force synchronous runner (only used in test suite).
        max_pending_futures: int = 512,
    ) -> None:
        # For information on configuring this consumer refer to this page:
        #   https://getsentry.github.io/arroyo/strategies/run_task_with_multiprocessing.html
        self.input_block_size = input_block_size
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.num_processes = num_processes
        self.num_threads = num_threads
        self.output_block_size = output_block_size
        self.force_synchronous = force_synchronous
        self.max_pending_futures = max_pending_futures

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
        op="replays.consumer.recording_buffered.process_message",
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
    isolation_scope = sentry_sdk.get_isolation_scope().fork()
    with sentry_sdk.scope.use_isolation_scope(isolation_scope):
        with sentry_sdk.start_transaction(
            name="replays.consumer.recording_buffered.commit_message",
            op="replays.consumer.recording_buffered.commit_message",
            custom_sampling_context={
                "sample_rate": getattr(
                    settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0
                )
            },
        ):
            try:
                commit_recording_message(message.payload)
                track_recording_metadata(message.payload)
                return None
            except GCS_RETRYABLE_ERRORS:
                raise
            except DropSilently:
                return None
            except Exception:
                logger.exception("Failed to commit replay recording message.")
                return None

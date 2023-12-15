import dataclasses
import logging
import random
from typing import Any, Mapping, Optional

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTask, RunTaskInThreads
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message, Partition
from django.conf import settings
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording
from sentry_sdk.tracing import Span

from sentry.replays.usecases.ingest import ingest_recording
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing

logger = logging.getLogger(__name__)

RECORDINGS_CODEC = get_codec("ingest-replay-recordings")


@dataclasses.dataclass
class MessageContext:
    message: ReplayRecording
    transaction: Span
    current_hub: sentry_sdk.Hub

    # The message attribute can cause large log messages to be emitted which can pin the CPU
    # to 100.
    def __repr__(self) -> str:
        return f"MessageContext(message_dict=..., transaction={repr(self.transaction)})"


class ProcessReplayRecordingStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """
    This consumer processes replay recordings, which are compressed payloads split up into
    chunks.
    """

    def __init__(
        self,
        input_block_size: Optional[int],
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        output_block_size: Optional[int],
        num_threads: int = 4,  # Defaults to 4 for self-hosted.
        force_synchronous: bool = False,  # Force synchronous runner (only used in test suite).
    ) -> None:
        # For information on configuring this consumer refer to this page:
        #   https://getsentry.github.io/arroyo/strategies/run_task_with_multiprocessing.html
        self.input_block_size = input_block_size
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.num_processes = num_processes
        self.num_threads = num_threads
        self.output_block_size = output_block_size
        self.use_processes = self.num_processes > 1
        self.force_synchronous = force_synchronous
        self.pool = MultiprocessingPool(num_processes) if self.use_processes else None

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        if self.force_synchronous:
            return RunTask(
                function=process_message,
                next_step=CommitOffsets(commit),
            )
        elif self.use_processes:
            assert self.pool is not None
            return RunTaskWithMultiprocessing(
                function=process_message,
                next_step=CommitOffsets(commit),
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                pool=self.pool,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
            )
        else:
            # By default we preserve the previous behavior.
            return RunTask(
                function=initialize_threaded_context,
                next_step=RunTaskInThreads(
                    processing_function=process_message_threaded,
                    concurrency=self.num_threads,
                    max_pending_futures=50,
                    next_step=CommitOffsets(commit),
                ),
            )

    def shutdown(self) -> None:
        if self.pool:
            self.pool.close()


def initialize_threaded_context(message: Message[KafkaPayload]) -> MessageContext:
    """Initialize a Sentry transaction and unpack the message."""
    transaction = sentry_sdk.start_transaction(
        name="replays.consumer.process_recording",
        op="replays.consumer",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )
    current_hub = sentry_sdk.Hub(sentry_sdk.Hub.current)
    message_dict = RECORDINGS_CODEC.decode(message.payload.value)
    return MessageContext(message_dict, transaction, current_hub)


def process_message_threaded(message: Message[MessageContext]) -> Any:
    """Move the replay payload to permanent storage."""
    context: MessageContext = message.payload
    message_dict = context.message

    ingest_recording(message_dict, context.transaction, context.current_hub)


def process_message(message: Message[KafkaPayload]) -> Any:
    """Move the replay payload to permanent storage."""
    transaction = sentry_sdk.start_transaction(
        name="replays.consumer.process_recording",
        op="replays.consumer",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )
    current_hub = sentry_sdk.Hub(sentry_sdk.Hub.current)
    message_dict = RECORDINGS_CODEC.decode(message.payload.value)
    ingest_recording(message_dict, transaction, current_hub)

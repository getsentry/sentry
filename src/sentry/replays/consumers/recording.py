import dataclasses
import logging
import random
from typing import Any, Mapping

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
from sentry.utils.arroyo import RunTaskWithMultiprocessing

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
        input_block_size: int,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        output_block_size: int,
    ) -> None:
        # For information on configuring this consumer refer to this page:
        #   https://getsentry.github.io/arroyo/strategies/run_task_with_multiprocessing.html
        self.input_block_size = input_block_size
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.num_processes = num_processes
        self.output_block_size = output_block_size
        self.use_multi_proc = self.num_processes > 1

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> Any:
        step: ProcessingStrategy[MessageContext]

        if self.use_multi_proc:
            step = RunTaskWithMultiprocessing(
                function=move_replay_to_permanent_storage,
                next_step=CommitOffsets(commit),
                num_processes=self.num_processes,
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
            )
        else:
            # By default we preserve the previous behavior.
            step = RunTaskInThreads(
                processing_function=move_replay_to_permanent_storage,
                concurrency=4,
                max_pending_futures=50,
                next_step=CommitOffsets(commit),
            )

        return RunTask(
            function=initialize_message_context,
            next_step=step,
        )


def initialize_message_context(message: Message[KafkaPayload]) -> MessageContext:
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


def move_replay_to_permanent_storage(message: Message[MessageContext]) -> Any:
    """Move the replay payload to permanent storage."""
    context: MessageContext = message.payload
    message_dict = context.message

    ingest_recording(message_dict, context.transaction, context.current_hub)

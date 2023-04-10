import dataclasses
import logging
import random
from typing import Any, Dict, Mapping, cast

import msgpack
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTaskWithMultiprocessing, TransformStep
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.filter import FilterStep
from arroyo.types import Commit, Message, Partition
from django.conf import settings
from sentry_sdk.tracing import Span

from sentry.replays.usecases.ingest import (
    RecordingMessage,
    RecordingSegmentChunkMessage,
    RecordingSegmentMessage,
    ingest_chunk,
    ingest_recording_chunked,
    ingest_recording_not_chunked,
)
from sentry.runner import configure

logger = logging.getLogger(__name__)


@dataclasses.dataclass
class MessageContext:
    message: Dict[str, Any]
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
        num_processes: int,
        input_block_size: int = 1024,
        output_block_size: int = 1024,
    ) -> None:
        self.num_processes = num_processes
        self.max_batch_size = 4
        self.max_batch_time = 10
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> Any:
        step = RunTaskWithMultiprocessing(
            function=move_replay_to_permanent_storage,
            next_step=CommitOffsets(commit),
            num_processes=self.num_processes,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
            initializer=configure,
        )

        step2: FilterStep[MessageContext] = FilterStep(
            function=is_capstone_message,
            next_step=step,
        )

        return TransformStep(
            function=move_chunks_to_cache_or_skip,
            next_step=step2,
        )


def move_chunks_to_cache_or_skip(message: Message[KafkaPayload]) -> MessageContext:
    """Move chunk messages to cache or skip."""
    transaction = sentry_sdk.start_transaction(
        name="replays.consumer.process_recording",
        op="replays.consumer",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )
    current_hub = sentry_sdk.Hub(sentry_sdk.Hub.current)

    message_dict = msgpack.unpackb(message.payload.value)

    if message_dict["type"] == "replay_recording_chunk":
        ingest_chunk(cast(RecordingSegmentChunkMessage, message_dict), transaction, current_hub)

    return MessageContext(message_dict, transaction, current_hub)


def is_capstone_message(message: Message[MessageContext]) -> Any:
    """Return "True" if the message is a capstone and can be processed in parallel."""
    message_type = message.payload.message["type"]
    return message_type == "replay_recording_not_chunked" or message_type == "replay_recording"


def move_replay_to_permanent_storage(message: Message[MessageContext]) -> Any:
    """Move the replay payload to permanent storage."""
    context: MessageContext = message.payload
    message_dict = context.message
    message_type = message_dict["type"]

    if message_type == "replay_recording_not_chunked":
        ingest_recording_not_chunked(
            cast(RecordingMessage, message_dict), context.transaction, context.current_hub
        )
    elif message_type == "replay_recording":
        ingest_recording_chunked(
            cast(RecordingSegmentMessage, message_dict), context.transaction, context.current_hub
        )
    else:
        raise ValueError(f"Invalid replays recording message type specified: {message_type}")

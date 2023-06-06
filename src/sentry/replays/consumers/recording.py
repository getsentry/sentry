import dataclasses
import logging
import random
from typing import Any, Mapping

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTaskInThreads, TransformStep
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message, Partition
from django.conf import settings
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording
from sentry_sdk.tracing import Span

from sentry.replays.usecases.ingest import ingest_recording

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

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> Any:
        step = RunTaskInThreads(
            processing_function=move_replay_to_permanent_storage,
            concurrency=4,
            max_pending_futures=50,
            next_step=CommitOffsets(commit),
        )

        return TransformStep(
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

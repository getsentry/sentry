import dataclasses
import logging
import random
from typing import Any, Dict, Mapping, cast

import msgpack
import sentry_sdk
from arroyo import configure_metrics
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTask, RunTaskWithMultiprocessing, TransformStep
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message, Partition
from django.conf import settings
from sentry_sdk.tracing import Span

from sentry.replays.usecases.ingest import RecordingMessage, ingest_recording
from sentry.snuba.utils import initialize_consumer_state

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
        input_block_size: int,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        output_block_size: int,
        use_multi_proc: bool,
    ) -> None:
        self.input_block_size = input_block_size
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.num_processes = num_processes
        self.output_block_size = output_block_size
        self.use_multi_proc = use_multi_proc

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> Any:
        if self.use_multi_proc:
            step = RunTaskWithMultiprocessing(
                function=move_replay_to_permanent_storage,
                next_step=CommitOffsets(commit),
                num_processes=self.num_processes,
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
                initializer=initialize_consumer_state,
            )
        else:
            step = RunTask(
                function=move_replay_to_permanent_storage,
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
    message_dict = msgpack.unpackb(message.payload.value)
    return MessageContext(message_dict, transaction, current_hub)


def move_replay_to_permanent_storage(message: Message[MessageContext]) -> Any:
    """Move the replay payload to permanent storage."""
    context: MessageContext = message.payload
    message_dict = context.message
    message_type = message_dict["type"]

    if message_type == "replay_recording_not_chunked":
        ingest_recording(
            cast(RecordingMessage, message_dict), context.transaction, context.current_hub
        )
    else:
        raise ValueError(f"Invalid replays recording message type specified: {message_type}")


def initialize_metrics() -> None:
    from sentry.utils import metrics
    from sentry.utils.arroyo import MetricsWrapper

    metrics_wrapper = MetricsWrapper(metrics.backend, name="ingest_replays")
    configure_metrics(metrics_wrapper)

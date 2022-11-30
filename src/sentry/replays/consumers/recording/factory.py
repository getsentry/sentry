import dataclasses
import functools
import logging
import random
from typing import Any, Callable, Dict, Mapping, cast

import msgpack
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTaskInThreads, TransformStep
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings
from sentry_sdk.tracing import Transaction

from sentry.replays.usecases.ingest import (
    RecordingMessage,
    RecordingSegmentChunkMessage,
    RecordingSegmentMessage,
    ingest_chunk,
    ingest_recording_chunked,
    ingest_recording_not_chunked,
)

logger = logging.getLogger(__name__)


class ProcessReplayRecordingStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """
    This consumer processes replay recordings, which are compressed payloads split up into
    chunks.
    """

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        commit_strategy = CommitOffsets(commit)
        store_strategy = RunTaskInThreads(
            processing_function=store,
            concurrency=16,
            max_pending_futures=32,
            next_step=commit_strategy,
        )
        cache_or_pass_strategy = TransformStep(cache_or_pass, store_strategy)
        deserialize_strategy = TransformStep(deserialize, cache_or_pass_strategy)
        return deserialize_strategy


@dataclasses.dataclass
class MessageContext:
    message: Dict[str, Any]
    transaction: Transaction


def error_handler(
    fn: Callable[[Message[KafkaPayload]], MessageContext]
) -> Callable[[Message[KafkaPayload]], MessageContext]:
    @functools.wraps(fn)
    def decorator(message: Message[KafkaPayload]) -> MessageContext:
        context: MessageContext = message.payload.value
        try:
            return fn(message)
        except Exception:
            logger.error("Invalid recording specified.", extra={"offset": message.offset})
        finally:
            context.transaction.finish()

    return decorator


def deserialize(message: Message[KafkaPayload]) -> MessageContext:
    # This transaction might be passed into a threaded environment.  We need to carry it all the
    # way to the end.
    transaction = sentry_sdk.start_transaction(
        name="replays.consumer.process_recording",
        op="replays.consumer",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )

    # Messages are always serialized with msgpack.  If this is raising an error check your
    # producer logic.
    unpacked_message = msgpack.unpackb(message.payload.value)
    assert isinstance(unpacked_message, dict)

    return MessageContext(unpacked_message, transaction)


@error_handler
def cache_or_pass(message: Message[KafkaPayload]) -> MessageContext:
    """Cache recording chunks.  Skip all other message types."""
    context: MessageContext = message.payload.value
    message_dict = context.message

    if message_dict["type"] == "replay_recording_chunk":
        _normalize_payloads(message_dict)
        ingest_chunk(cast(RecordingSegmentChunkMessage, message_dict), context.transaction)

    return context


@error_handler
def store(message: Message[KafkaPayload]) -> MessageContext:
    """Move the recording blob to permanent storage.

    This function is threaded.  To ensure processing order guarantees, all pre-requisite tasks
    need to be completed prior to this function's execution.  You may configure additional
    pre-requisite logic in the `create_with_partitions` method.
    """
    context: MessageContext = message.payload.value
    message_dict = context.message
    message_type = message_dict["type"]

    if message_type == "replay_recording":
        ingest_recording_chunked(cast(RecordingSegmentMessage, message_dict), context.transaction)
    elif message_type == "replay_recording_not_chunked":
        ingest_recording_not_chunked(cast(RecordingMessage, message_dict), context.transaction)
    elif message_type == "replay_recording_chunk":
        pass
    else:
        raise ValueError(f"Invalid replays recording message type specified: {message_type}")

    return context


def _normalize_payloads(message_dict) -> None:
    """Normalize payloads that were not compressed."""
    if type(message_dict["payload"]) is str:
        message_dict["payload"] = message_dict["payload"].encode("utf-8")


# TODO: vv REMOVE AFTER DEPS UPDATE vv


from typing import Optional

from arroyo.types import Commit, TPayload


class CommitOffsets(ProcessingStrategy[TPayload]):
    """
    Just commits offsets.

    This should always be used as the last step in a chain of processing
    strategies. It commits offsets back to the broker after all prior
    processing of that message is completed.
    """

    def __init__(self, commit: Commit) -> None:
        self.__commit = commit

    def poll(self) -> None:
        pass

    def submit(self, message: Message[TPayload]) -> None:
        self.__commit(message.committable)

    def close(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def join(self, timeout: Optional[float] = None) -> None:
        # Commit all previously staged offsets
        self.__commit({}, force=True)

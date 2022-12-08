import dataclasses
import logging
import random
from typing import Any, Callable, Dict, Mapping, Optional, Tuple, cast

import msgpack
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTaskInThreads, TransformStep
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.filter import FilterStep
from arroyo.types import Message, Partition, Position, TPayload
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
        return LogExceptionStep(
            message="Invalid recording specified.",
            next_step=TransformStep(
                function=lambda m: msgpack.unpackb(m.payload.value),
                next_step=TransformStep(
                    function=initialize_message_context,
                    next_step=TransformStep(
                        function=cache_if_chunk,
                        next_step=FilterStep(
                            function=lambda m: m.payload.message["type"]
                            != "replay_recording_chunk",
                            next_step=RunTaskInThreads(
                                processing_function=store,
                                concurrency=16,
                                max_pending_futures=32,
                                next_step=CommitOffsets(commit),
                            ),
                        ),
                    ),
                ),
            ),
        )


@dataclasses.dataclass
class MessageContext:
    message: Dict[str, Any]
    transaction: Transaction


def initialize_message_context(message: Message[Dict[str, Any]]) -> MessageContext:
    transaction = sentry_sdk.start_transaction(
        name="replays.consumer.process_recording",
        op="replays.consumer",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )
    return MessageContext(message.payload, transaction)


def cache_if_chunk(message: Message[MessageContext]) -> MessageContext:
    context: MessageContext = message.payload
    message_dict = context.message
    message_type = message_dict["type"]

    if message_type == "replay_recording_chunk":
        # Uncompressed recording data will be deserialized as a string instead of bytes.  We
        # encode as bytes to simplify our ingest method.
        if type(message_dict["payload"]) is str:
            message_dict["payload"] = message_dict["payload"].encode("utf-8")

        ingest_chunk(cast(RecordingSegmentChunkMessage, message_dict), message.transaction)

    return MessageContext(message_dict, message.transaction)


def store(message: Message[MessageContext]) -> MessageContext:
    """Move the recording blob to permanent storage.

    This function is threaded.  To ensure processing order guarantees, all pre-requisite tasks
    need to be completed prior to this function's execution.  You may configure additional
    pre-requisite logic in the `create_with_partitions` method.
    """
    context: MessageContext = message.payload
    message_dict = context.message
    message_type = message_dict["type"]

    if message_type == "replay_recording":
        ingest_recording_chunked(cast(RecordingSegmentMessage, message_dict), context.transaction)
    elif message_type == "replay_recording_not_chunked":
        ingest_recording_not_chunked(cast(RecordingMessage, message_dict), context.transaction)
    else:
        raise ValueError(f"Invalid replays recording message type specified: {message_type}")

    return context


class LogExceptionStep(ProcessingStrategy[TPayload]):
    def __init__(
        self, message: str, next_step: ProcessingStrategy[Tuple[bytes, Transaction]]
    ) -> None:
        self.__exception_message = message
        self.__next_step = next_step
        self.__closed = False

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        try:
            self.__next_step.submit(message)
        except Exception:
            logger.exception(self.__exception_message)

    def poll(self) -> None:
        try:
            self.__next_step.poll()
        except Exception:
            logger.exception(self.__exception_message)

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__closed = True

        logger.debug("Terminating %r...", self.__next_step)
        self.__next_step.terminate()

    def join(self, timeout: Optional[float] = None) -> None:
        self.__next_step.close()
        self.__next_step.join(timeout)

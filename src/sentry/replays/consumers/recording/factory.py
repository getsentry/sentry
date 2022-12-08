import dataclasses
import functools
import logging
import random
from typing import Any, Callable, Dict, List, Mapping, Optional, cast

import msgpack
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import RunTaskInThreads, TransformStep
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.filter import FilterStep
from arroyo.types import Message, Partition, Position, TPayload, TReplaced
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
        return Pipeline(
            steps=[
                # Catch and log any exceptions that occur during processing.
                Partial(LogExceptionStep, message="Invalid recording specified."),
                # Deserialize the msgpack payload.
                Apply(deserialize),
                # Initialize a sentry transaction.
                Apply(init_context),
                # Cache chunk messages.
                Apply(cache_chunks),
                # Remove chunk messages from pipeline.  They should never be committed.
                Filter(filter_chunks),
                # Run the capstone messages in a thread-pool.
                Partial(
                    RunTaskInThreads,
                    processing_function=store,
                    concurrency=16,
                    max_pending_futures=32,
                ),
            ],
            # Batch capstone messages and commit when called.
            next_pipeline=CommitOffsets(commit),
        )


@dataclasses.dataclass
class MessageContext:
    message: Dict[str, Any]
    transaction: Transaction


def deserialize(message: Message[KafkaPayload]) -> Dict[str, Any]:
    return msgpack.unpackb(message.payload.value)


def init_context(message: Message[Dict[str, Any]]) -> MessageContext:
    transaction = sentry_sdk.start_transaction(
        name="replays.consumer.process_recording",
        op="replays.consumer",
        sampled=random.random()
        < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
    )
    return MessageContext(message.payload, transaction)


def cache_chunks(message: Message[MessageContext]) -> MessageContext:
    context: MessageContext = message.payload
    message_dict = context.message
    message_type = message_dict["type"]

    if message_type == "replay_recording_chunk":
        # Uncompressed recording data will be deserialized as a string instead of bytes.  We
        # encode as bytes to simplify our ingest method.
        if type(message_dict["payload"]) is str:
            message_dict["payload"] = message_dict["payload"].encode("utf-8")

        ingest_chunk(cast(RecordingSegmentChunkMessage, message_dict), context.transaction)

    return MessageContext(message_dict, context.transaction)


def filter_chunks(message: Message[MessageContext]) -> bool:
    return message.payload.message["type"] != "replay_recording_chunk"


def store(message: Message[MessageContext]) -> None:
    """Move the recording blob to permanent storage."""
    context: MessageContext = message.payload
    message_dict = context.message
    message_type = message_dict["type"]

    if message_type == "replay_recording":
        ingest_recording_chunked(cast(RecordingSegmentMessage, message_dict), context.transaction)
    elif message_type == "replay_recording_not_chunked":
        ingest_recording_not_chunked(cast(RecordingMessage, message_dict), context.transaction)
    else:
        raise ValueError(f"Invalid replays recording message type specified: {message_type}")


# Lib.


class LogExceptionStep(ProcessingStrategy[TPayload]):
    def __init__(
        self,
        message: str,
        next_step: ProcessingStrategy[TPayload],
    ) -> None:
        self.__exception_message = message
        self.__next_step = next_step
        self.__closed = False

    def submit(self, message: Message[TPayload]) -> None:
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


def Apply(
    function: Callable[[Message[TPayload]], TReplaced]
) -> Callable[[ProcessingStrategy[TReplaced]], TransformStep[TPayload]]:
    return lambda next_step: TransformStep(function=function, next_step=next_step)


def Filter(
    function: Callable[[Message[TPayload]], bool]
) -> Callable[[ProcessingStrategy[TPayload]], FilterStep[TPayload]]:
    return lambda next_step: FilterStep(function=function, next_step=next_step)


def Partial(
    strategy: Callable[[ProcessingStrategy[TReplaced]], ProcessingStrategy[TPayload]],
    **kwargs: Any,
) -> Callable[[ProcessingStrategy[TReplaced]], ProcessingStrategy[TPayload]]:
    return lambda next_step: strategy(next_step=next_step, **kwargs)


def Pipeline(
    steps: List[Callable[[ProcessingStrategy[TPayload]], FilterStep[TReplaced]]],
    next_pipeline: Optional[ProcessingStrategy[TPayload]] = None,
) -> ProcessingStrategy[TPayload]:
    if not steps:
        raise ValueError("Pipeline misconfigured.  Missing required step functions.")

    return functools.reduce(
        lambda prev_step, step_fn: step_fn(prev_step),
        sequence=reversed(steps),
        initial=next_pipeline,
    )

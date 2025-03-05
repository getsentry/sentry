"""Session Replay recording consumer implementation.

The consumer implementation follows a batching flush strategy. We accept messages, process them,
buffer them, and when some threshold is reached we flush the buffer. The batch has finished work
after the buffer is flushed so we commit with a None value.
"""

import contextlib
import logging
import time
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import dataclass
from typing import TypedDict

import sentry_sdk

from sentry.filestore.gcs import GCS_RETRYABLE_ERRORS
from sentry.replays.consumers.buffered.platform import (
    Cmd,
    Commit,
    Effect,
    Join,
    Nothing,
    Poll,
    RunTime,
    Sub,
    Task,
)
from sentry.replays.consumers.buffered.types import Result
from sentry.replays.usecases.ingest import (
    DropSilently,
    ProcessedRecordingMessage,
    commit_recording_message,
    parse_recording_message,
    process_recording_message,
    track_recording_metadata,
)

logger = logging.getLogger()

# Types.


class Flags(TypedDict):
    max_buffer_length: int
    max_buffer_wait: int
    max_workers: int


@dataclass
class Model:
    buffer: list[ProcessedRecordingMessage]
    last_flushed_at: float
    max_buffer_length: int
    max_buffer_wait: int
    max_workers: int


@dataclass(frozen=True)
class Append:
    """Append the item to the buffer."""

    item: ProcessedRecordingMessage


@dataclass(frozen=True)
class Committed:
    """The platform committed offsets. Our buffer is now completely done."""


@dataclass(frozen=True)
class Flush:
    """Our application hit the flush threshold and has been instructed to flush."""

    buffer: list[ProcessedRecordingMessage]


@dataclass(frozen=True)
class Flushed:
    """Our application successfully flushed."""

    result: Result[float, list[bool]]


class Skip:
    """Skip the message."""


@dataclass(frozen=True)
class TryFlush:
    """Instruct the application to flush the buffer if its time."""

    now: float


# A "Msg" is the union of all application messages our RunTime will accept.
Msg = Append | Committed | Flush | Flushed | Skip | TryFlush


# State machine functions.


def init(flags: Flags) -> tuple[Model, Cmd[Msg, None]]:
    """Initialize the state of the consumer."""
    return (
        Model(
            buffer=[],
            last_flushed_at=time.time(),
            max_buffer_wait=flags["max_buffer_wait"],
            max_workers=flags["max_workers"],
            max_buffer_length=flags["max_buffer_length"],
        ),
        Nothing(),
    )


@sentry_sdk.trace
def process(model: Model, message: bytes) -> Msg:
    """Process raw bytes to structured output.

    Some messages can not be parsed and their failures are known to the application. Other messages
    can not be parsed and their failures are unknown to the application. In either case we don't
    block ingestion for deterministic failures. We'll address the short-comings in a pull request.

    This is a good place to DLQ messages within unknown failure modes. The DLQ does not exist
    currently and so is not implemented here.
    """
    try:
        item = process_recording_message(parse_recording_message(message))
        return Append(item=item)
    except DropSilently:
        return Skip()
    except Exception:
        logger.exception("Could not process replay recording message.")  # Unmanaged effect.
        return Skip()


def update(model: Model, msg: Msg) -> tuple[Model, Cmd[Msg, None]]:
    """Grand central dispatch.

    This is the brain of the consumer. Events are processed and sent here for handling. Msgs enter
    and Cmds exit this function. If the sequence of messages and commands are in a specific order a
    flush event will occur and the buffer will be committed.
    """
    match msg:
        case Append(item=item):
            model.buffer.append(item)
            return (model, Effect(fun=time.time, msg=TryFlush))
        case Skip():
            return (model, Effect(fun=time.time, msg=TryFlush))
        case Committed():
            return (model, Nothing())
        case Flush(buffer=buffer):
            return (model, Effect(fun=FlushBuffer(buffer, model.max_workers), msg=Flushed))
        case Flushed(result=result):
            if result.is_ok:
                value = result.unwrap()
                model.buffer = []
                model.last_flushed_at = value
                model.retries = 0
                return (model, Commit(msg=Committed(), value=None))
            else:
                buffer = [item for item, error in zip(model.buffer, result.unwrap_err()) if error]
                logger.info("[FLUSHED] Retrying %d/%d messages.", len(buffer), len(model.buffer))
                return (model, Task(msg=Flush(buffer=buffer)))
        case TryFlush(now=now):
            if can_flush(model, now):
                return (model, Task(msg=Flush(buffer=model.buffer)))
            else:
                return (model, Nothing())


def subscription(model: Model) -> list[Sub[Msg]]:
    """Platform event subscriptions.

    This function registers the platform subscriptions we want to listen for. When the platform
    decides its time to poll or shutdown the platform will emit those commands to the runtime and
    the runtime will inform us (the application) so we can handle the situation approporiately.
    """
    return [
        Join(msg=lambda: Flush(model.buffer)),
        Poll(msg=lambda: TryFlush(now=time.time())),
    ]


# Helpers.


def can_flush(model: Model, now: float) -> bool:
    return (
        len(model.buffer) >= model.max_buffer_length
        or (now - model.max_buffer_wait) >= model.last_flushed_at
    )


@dataclass(frozen=True)
class FlushBuffer:
    buffer: list[ProcessedRecordingMessage]
    max_workers: int

    def __call__(self) -> Result[float, list[bool]]:
        @sentry_sdk.trace
        def flush_message(message: ProcessedRecordingMessage) -> None:
            with contextlib.suppress(DropSilently):
                commit_recording_message(message)

        if len(self.buffer) == 0:
            return Result.ok(time.time())

        with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
            waiter = wait(pool.submit(flush_message, message) for message in self.buffer)
            errors = [future.exception() for future in waiter.done]

        # Recording metadata is not tracked in the threadpool. This is because this function will
        # log. Logging will acquire a lock and make our threading less useful due to the speed of
        # the I/O we do in this step.
        for message, error in zip(self.buffer, errors):
            if error is None:
                track_recording_metadata(message)

        errs = []
        for error in errors:
            if isinstance(error, GCS_RETRYABLE_ERRORS):
                errs.append(True)
            elif error is None:
                errs.append(False)
            else:
                # Unhandled exceptions are logged and do not block ingestion.
                logger.error("Unhandled error in flush buffer.", exc_info=error)
                errs.append(False)

        if any(errs):
            return Result.err(errs)

        return Result.ok(time.time())


# Consumer.


recording_consumer = RunTime(
    init=init,
    process=process,
    subscription=subscription,
    update=update,
)

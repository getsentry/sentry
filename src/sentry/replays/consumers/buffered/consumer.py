"""Session Replay recording consumer implementation."""

import contextlib
import time
from collections.abc import MutableMapping
from concurrent.futures import FIRST_EXCEPTION, ThreadPoolExecutor, wait
from dataclasses import dataclass
from typing import TypedDict

import sentry_sdk
from arroyo.types import Partition

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
from sentry.replays.usecases.ingest import (
    DropSilently,
    ProcessedRecordingMessage,
    commit_recording_message,
    parse_recording_message,
    process_recording_message,
    track_recording_metadata,
)

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
    offsets: MutableMapping[Partition, int]


@dataclass(frozen=True)
class Append:
    """Append the item to the buffer and update the offsets."""

    item: ProcessedRecordingMessage
    offset: MutableMapping[Partition, int]


@dataclass(frozen=True)
class AppendOffset:
    """Update the offsets; no item needs to be appended to the buffer."""

    offset: MutableMapping[Partition, int]


class Committed:
    """The platform committed offsets. Our buffer is now completely done."""


class Flush:
    """Our application hit the flush threshold and has been instructed to flush."""


@dataclass(frozen=True)
class Flushed:
    """Our application successfully flushed."""

    now: float


@dataclass(frozen=True)
class TryFlush:
    """Instruct the application to flush the buffer if its time."""

    now: float


# A "Msg" is the union of all application messages our RunTime will accept.
Msg = Append | AppendOffset | Committed | Flush | Flushed | TryFlush


# State machine functions.


def init(flags: Flags) -> tuple[Model, Cmd[Msg] | None]:
    return (
        Model(
            buffer=[],
            last_flushed_at=time.time(),
            max_buffer_wait=flags["max_buffer_wait"],
            max_workers=flags["max_workers"],
            max_buffer_length=flags["max_buffer_length"],
            offsets={},
        ),
        None,
    )


@sentry_sdk.trace
def process(_: Model, message: bytes, offset: MutableMapping[Partition, int]) -> Msg | None:
    try:
        item = process_recording_message(parse_recording_message(message))
        return Append(item=item, offset=offset)
    except Exception:
        return AppendOffset(offset=offset)


def update(model: Model, msg: Msg) -> tuple[Model, Cmd[Msg] | None]:
    match msg:
        case Append(item=item, offset=offset):
            model.buffer.append(item)
            model.offsets.update(offset)
            return (model, Effect(fun=time.time, msg=lambda now: TryFlush(now=now)))
        case AppendOffset(offset=offset):
            model.offsets.update(offset)
            return (model, Effect(fun=time.time, msg=lambda now: TryFlush(now=now)))
        case Committed():
            return (model, None)
        case Flush():
            return (model, Effect(fun=FlushBuffer(model), msg=lambda now: Flushed(now=now)))
        case Flushed(now=now):
            model.buffer = []
            model.last_flushed_at = now
            return (model, Commit(msg=Committed(), offsets=model.offsets))
        case TryFlush(now=now):
            return (model, Task(msg=Flush())) if can_flush(model, now) else (model, Nothing())


def subscription(model: Model) -> list[Sub[Msg]]:
    return [
        Join(msg=Flush),
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
    model: Model

    def __call__(self) -> float:
        @sentry_sdk.trace
        def flush_message(message: ProcessedRecordingMessage) -> None:
            with contextlib.suppress(DropSilently):
                commit_recording_message(message)

        if len(self.model.buffer) == 0:
            return time.time()

        with ThreadPoolExecutor(max_workers=self.model.max_workers) as pool:
            futures = [pool.submit(flush_message, message) for message in self.model.buffer]

            # Tasks can fail. We check the done set for any failures. We will wait for all the
            # futures to complete before running this step or eagerly run this step if any task
            # errors.
            done, _ = wait(futures, return_when=FIRST_EXCEPTION)
            for future in done:
                exc = future.exception()
                # Raising preserves the existing behavior. We can address error handling in a
                # follow up.
                if exc is not None and not isinstance(exc, DropSilently):
                    raise exc

        # Recording metadata is not tracked in the threadpool. This is because this function will
        # log. Logging will acquire a lock and make our threading less useful due to the speed of
        # the I/O we do in this step.
        for message in self.model.buffer:
            track_recording_metadata(message)

        return time.time()


# Consumer.


recording_consumer = RunTime(
    init=init,
    process=process,
    subscription=subscription,
    update=update,
)

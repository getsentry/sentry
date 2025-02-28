"""Session Replay recording consumer implementation.

To understand how the buffering works visit the `lib.py` module and inspect the source of the
buffering runtime.

This module has two parts. A processing component and a buffer flushing component. The processing
component is straight-forward. It accepts a message and performs some work on it. After it
completes it instructs the runtime to append the message to the buffer. This is abstracted by the
buffering runtime library so we just return the transformed data in this module.

The second part is the flushing of the buffer. The buffering runtime library has no idea when to
flush this buffer so it constantly asks us if it can flush. We control flushing behavior through a
stateful "BufferManager" class.  If we can_flush then we do_flush. After the flush completes the
RunTime will commit the offsets.
"""

import contextlib
import time
from concurrent.futures import FIRST_EXCEPTION, ThreadPoolExecutor, wait
from typing import TypedDict

import sentry_sdk

from sentry.replays.consumers.buffered.lib import Model, buffering_runtime
from sentry.replays.usecases.ingest import (
    DropSilently,
    ProcessedRecordingMessage,
    commit_recording_message,
    parse_recording_message,
    process_recording_message,
    sentry_tracing,
    track_recording_metadata,
)


class Flags(TypedDict):
    max_buffer_length: int
    max_buffer_wait: int
    max_workers: int


class BufferManager:
    """Buffer manager.

    The buffer manager is a class instance has a lifetime as long as the RunTime's. We pass its
    methods as callbacks to the Model. The state contained within the method's instance is implicit
    and unknown to the RunTime.
    """

    def __init__(self, flags: Flags) -> None:
        self.__max_buffer_length = flags["max_buffer_length"]
        self.__max_buffer_wait = flags["max_buffer_wait"]
        self.__max_workers = flags["max_workers"]

        self.__last_flushed_at = time.time()

    def can_flush(self, model: Model[ProcessedRecordingMessage]) -> bool:
        # TODO: time.time is stateful and hard to test. We should enable the RunTime to perform
        #       managed effects so we can properly test this behavior.
        return (
            len(model.buffer) >= self.__max_buffer_length
            or (time.time() - self.__max_buffer_wait) >= self.__last_flushed_at
        )

    def do_flush(self, model: Model[ProcessedRecordingMessage]) -> None:
        with sentry_tracing("replays.consumers.buffered.flush_buffer"):
            flush_buffer(model, max_workers=self.__max_workers)
            # TODO: time.time again. Should be declarative for testing purposes.
            self.__last_flushed_at = time.time()


@sentry_sdk.trace
def flush_buffer(model: Model[ProcessedRecordingMessage], max_workers: int) -> None:
    if len(model.buffer) == 0:
        return None

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(flush_message, message) for message in model.buffer]

        # Tasks can fail. We check the done set for any failures. We will wait for all the
        # futures to complete before running this step or eagerly run this step if any task
        # errors.
        done, _ = wait(futures, return_when=FIRST_EXCEPTION)
        for future in done:
            exc = future.exception()
            if exc is not None:
                # TODO: Why raise? Can I do something more meaningful here than reject the whole
                #       batch? Raising is certainly the easiest way of handling failures...
                raise exc

    # Recording metadata is not tracked in the threadpool. This is because this function will
    # log. Logging will acquire a lock and make our threading less useful due to the speed of
    # the I/O we do in this step.
    for message in model.buffer:
        track_recording_metadata(message)

    return None


@sentry_sdk.trace
def flush_message(message: ProcessedRecordingMessage) -> None:
    with contextlib.suppress(DropSilently):
        commit_recording_message(message)


def process_message(message_bytes: bytes) -> ProcessedRecordingMessage | None:
    """Message processing function.

    Accepts an unstructured type and returns a structured one. Other than tracing the goal is to
    have no I/O here. We'll commit the I/O on flush.
    """
    with sentry_tracing("replays.consumers.buffered.process_message"):
        with contextlib.suppress(DropSilently):
            message = parse_recording_message(message_bytes)
            return process_recording_message(message)
        return None


def init(flags: Flags) -> Model[ProcessedRecordingMessage]:
    """Return the initial state of the application."""
    buffer = BufferManager(flags)
    return Model(buffer=[], can_flush=buffer.can_flush, do_flush=buffer.do_flush, offsets={})


recording_runtime = buffering_runtime(
    init_fn=init,
    process_fn=process_message,
)

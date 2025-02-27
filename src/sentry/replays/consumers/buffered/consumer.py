import contextlib
import time
from concurrent.futures import FIRST_EXCEPTION, ThreadPoolExecutor, wait

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


class BufferManager:
    """Buffer manager.

    Determines if and when a buffer should flush. The buffer accepts only one argument (`flags`)
    which can contain any number of configuration options. Currently we only care about the time
    the buffer has been active and the length of the buffer. But we could update this function to
    extract an option thats concerned with the bytesize of the buffer if we thought that was a
    useful metric for committing.

    The buffer manager is a class instance has a lifetime as long as the RunTime's. We pass its
    methods as callbacks to the Model. The state contained within the method's instance is implicit
    and unknown to the RunTime. We could model this state inside the RunTime but the state is
    simple enough that I don't feel the need to over-engineer the buffering RunTime. For more
    complex use-cases you would want to formalize state transformations in the RunTime. Especially
    if you wanted to expose the state across more locations in the application.
    """

    def __init__(self, flags: dict[str, str]) -> None:
        # Flags are safely extracted and default arguments are used.
        self.__max_buffer_length = int(flags.get("max_buffer_length", 8))
        self.__max_buffer_wait = int(flags.get("max_buffer_wait", 1))
        self.__max_workers = int(flags.get("max_workers", 8))

        self.__last_flushed_at = time.time()

    def can_flush(self, model: Model[ProcessedRecordingMessage]) -> bool:
        return (
            len(model.buffer) >= self.__max_buffer_length
            or (time.time() - self.__max_buffer_wait) >= self.__last_flushed_at
        )

    def do_flush(self, model: Model[ProcessedRecordingMessage]) -> None:
        with sentry_tracing("replays.consumers.buffered.flush_buffer"):
            flush_buffer(model, max_workers=self.__max_workers)
            # Update the buffer manager with the new time so we don't continuously commit in a
            # loop!
            self.__last_flushed_at = time.time()


@sentry_sdk.trace
def flush_buffer(model: Model[ProcessedRecordingMessage], max_workers: int) -> None:
    if len(model.buffer) == 0:
        return None

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        # We apply whatever function is defined on the class to each message in the list. This
        # is useful for testing reasons (dependency injection).
        futures = [pool.submit(flush_message, message) for message in model.buffer]

        # Tasks can fail. We check the done set for any failures. We will wait for all the
        # futures to complete before running this step or eagerly run this step if any task
        # errors.
        done, _ = wait(futures, return_when=FIRST_EXCEPTION)
        for future in done:
            exc = future.exception()
            if exc is not None:
                raise exc

    # Recording metadata is not tracked in the threadpool. This is because this function will
    # log. Logging will acquire a lock and make our threading less useful due to the speed of
    # the I/O we do in this step.
    for message in model.buffer:
        track_recording_metadata(message)

    return None


@sentry_sdk.trace
def flush_message(message: ProcessedRecordingMessage) -> None:
    """Message flushing function."""
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


def init(flags: dict[str, str]) -> Model[ProcessedRecordingMessage]:
    """Return the initial state of the application."""
    buffer = BufferManager(flags)
    return Model(buffer=[], can_flush=buffer.can_flush, do_flush=buffer.do_flush, offsets={})


recording_runtime = buffering_runtime(
    init_fn=init,
    process_fn=process_message,
)

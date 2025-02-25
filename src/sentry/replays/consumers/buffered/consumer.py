import time

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.replays.consumers.buffered.buffer_managers import (
    BatchedBufferManager,
    ThreadedBufferManager,
)
from sentry.replays.consumers.buffered.lib import Model, buffering_runtime
from sentry.replays.usecases.ingest import (
    DropSilently,
    ProcessedRecordingMessage,
    process_recording_message,
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
        self.__max_buffer_length = int(flags["max_buffer_length"])
        self.__max_buffer_wait = int(flags["max_buffer_wait"])
        self.__last_flushed_at = time.time()

    def can_flush(self, model: Model[ProcessedRecordingMessage]) -> bool:
        return (
            len(model.buffer) >= self.__max_buffer_length
            or (time.time() - self.__max_buffer_wait) >= self.__last_flushed_at
        )

    @sentry_sdk.trace
    def do_flush(self, model: Model[ProcessedRecordingMessage]) -> None:
        # During the transitionary period most organizations will commit following a traditional
        # commit pattern...
        #
        # TODO: Would be nice to cache this value.
        org_ids = set(options.get("replay.consumer.use-file-batching"))

        threaded = list(filter(lambda i: i.org_id not in org_ids, model.buffer))
        threaded_buffer = ThreadedBufferManager(max_workers=32)
        threaded_buffer.commit(threaded)

        # ...But others will be opted in to the batched version of uploading. This will give us a
        # chance to test the feature with as minimal risk as possible.
        batched = list(filter(lambda i: i.org_id in org_ids, model.buffer))
        batched_buffer = BatchedBufferManager()
        batched_buffer.commit(batched)

        # Update the buffer manager with the new time so we don't continuously commit in a loop!
        self.__last_flushed_at = time.time()


def process_message(message: bytes) -> ProcessedRecordingMessage | None:
    """Message processing function.

    Accepts an unstructured type and returns a structured one. Other than tracing the goal is to
    have no I/O here. We'll commit the I/O on flush.
    """
    isolation_scope = sentry_sdk.Scope.get_isolation_scope().fork()

    with sentry_sdk.scope.use_isolation_scope(isolation_scope):
        transaction = sentry_sdk.start_transaction(
            name="replays.consumer.process_recording",
            op="replays.consumer",
            custom_sampling_context={
                "sample_rate": getattr(
                    settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0
                )
            },
        )

        try:
            return process_recording_message(message)
        except DropSilently:
            return None
        finally:
            transaction.finish()


def init(flags: dict[str, str]) -> Model[ProcessedRecordingMessage]:
    """Return the initial state of the application."""
    buffer = BufferManager(flags)
    return Model(buffer=[], can_flush=buffer.can_flush, do_flush=buffer.do_flush, offsets={})


recording_runtime = buffering_runtime(
    init_fn=init,
    process_fn=process_message,
)

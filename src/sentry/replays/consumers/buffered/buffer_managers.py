import dataclasses
import uuid
from concurrent.futures import FIRST_EXCEPTION, ThreadPoolExecutor, wait

import sentry_sdk

from sentry.replays.lib.storage import storage_kv
from sentry.replays.models import FilePart
from sentry.replays.usecases.ingest import (
    ProcessedRecordingMessage,
    commit_recording_message,
    track_initial_segment_event,
    track_recording_metadata,
)
from sentry.replays.usecases.ingest.dom_index import _initialize_publisher, emit_replay_actions


@dataclasses.dataclass(frozen=True)
class FilePartRow:
    key: str
    range_start: int
    range_stop: int


@dataclasses.dataclass(frozen=True)
class MergedBuffer:
    buffer: bytes
    buffer_rows: list[FilePartRow]
    filename: str


class BatchedBufferManager:
    """Batched buffer manager.

    The batched buffer manager takes a list of messages and merges them into a single file before
    committing them to permanent storage. We store filename and byte locations in a PostgreSQL
    table.
    """

    @sentry_sdk.trace
    def commit(self, messages: list[ProcessedRecordingMessage]) -> None:
        merged_buffer = self.merge_buffer(messages)
        self.commit_merged_buffer(merged_buffer)
        self.bulk_track_initial_segment_events(messages)
        self.bulk_emit_action_events(messages)
        self.bulk_track_recording_metadata(messages)

    @sentry_sdk.trace
    def merge_buffer(self, buffer: list[ProcessedRecordingMessage]) -> MergedBuffer:
        def _append_part(parts: bytes, part: bytes, key: str) -> tuple[bytes, FilePartRow]:
            range_start = len(parts)
            range_stop = range_start + len(part) - 1
            return (parts + part, FilePartRow(key, range_start, range_stop))

        parts = b""
        parts_rows = []

        for item in buffer:
            # The recording data is appended to the buffer and a row for tracking is
            # returned.
            parts, part_row = _append_part(parts, item.filedata, key=item.filename)
            parts_rows.append(part_row)

        return MergedBuffer(
            buffer=parts,
            buffer_rows=parts_rows,
            filename=f"90/{uuid.uuid4().hex}",
        )

    @sentry_sdk.trace
    def commit_merged_buffer(self, buffer: MergedBuffer) -> None:
        if buffer.buffer == b"":
            return None

        # Storage goes first. Headers go second. If we were to store the headers first we could
        # expose a record that does not exist to the user which would ultimately 404.
        storage_kv.set(buffer.filename, buffer.buffer)

        # Bulk insert the filepart.
        FilePart.objects.bulk_create(
            FilePart(
                filename=buffer.filename,
                key=row.key,
                range_start=row.range_start,
                range_stop=row.range_stop,
            )
            for row in buffer.buffer_rows
        )

    @sentry_sdk.trace
    def bulk_track_initial_segment_events(self, items: list[ProcessedRecordingMessage]) -> None:
        # Each item in the buffer needs to record a billing outcome. Not every segment will bill
        # but we defer that behavior to the `track_initial_segment_event` function.
        for item in items:
            track_initial_segment_event(
                item.org_id,
                item.project_id,
                item.replay_id,
                item.segment_id,
                item.key_id,
                item.received,
                item.is_replay_video,
            )

    @sentry_sdk.trace
    def bulk_emit_action_events(self, items: list[ProcessedRecordingMessage]) -> None:
        # The action events need to be emitted to Snuba. We do it asynchronously so its fast. The
        # Kafka publisher is asynchronous. We need to flush to make sure the data is fully committed
        # before we can consider this buffer fully flushed and commit our local offsets.
        for item in items:
            if item.actions_event:
                emit_replay_actions(item.actions_event)

        # Ensure the replay-actions were committed to the broker before we commit this batch.
        publisher = _initialize_publisher()
        publisher.flush()

    @sentry_sdk.trace
    def bulk_track_recording_metadata(self, items: list[ProcessedRecordingMessage]) -> None:
        # Each item in the buffer needs to record metrics about itself.
        for item in items:
            track_recording_metadata(item)


class ThreadedBufferManager:
    """Threaded buffer manager.

    The threaded buffer manager is the original way we uploaded files except in an application
    managed thread-pool. We iterate over each processed recording, commit them in a thread, and
    finally return null when all the tasks complete. It requires no changes elsewhere in the code
    to accomodate.

    The goal of this class is to _not_ be clever. We want to as closely as possible immitate
    current production behavior. The reason being is that a consumer refactor is a difficult task
    to feature flag and we want to gradually rollout the behavior over time after assuring
    ourselves that there are no defects in the `BatchedBufferManager`.
    """

    def __init__(self, max_workers: int) -> None:
        self.fn = commit_recording_message
        self.max_workers = max_workers

    @sentry_sdk.trace
    def commit(self, messages: list[ProcessedRecordingMessage]) -> None:
        # Use as many workers as necessary up to a limit. We don't want to start thousands of
        # worker threads.
        max_workers = min(len(messages), self.max_workers)

        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            # We apply whatever function is defined on the class to each message in the list. This
            # is useful for testing reasons (dependency injection).
            futures = [pool.submit(self.fn, message) for message in messages]

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
        for message in messages:
            track_recording_metadata(message)

        return None

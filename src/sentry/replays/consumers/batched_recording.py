import time
from typing import List, Mapping, Optional

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Message, Partition

from sentry.replays.usecases.ingest import recording_billing_outcome
from sentry.replays.usecases.ingest.batched_recording import (
    ProcessedRecordingSegment,
    bulk_insert_file_part_rows,
    decode_recording_message,
    prepare_batched_commit,
    prepare_recording_message_batch_item,
    save_file,
)


class ProcessReplayRecordingStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """
    This consumer processes replay recordings, which are compressed payloads split up into
    chunks.
    """

    def create_with_partitions(
        self,
        max_batch_row_count: int,
        max_batch_size_in_bytes: int,
        max_batch_time_in_seconds: int,
        commit: CommitOffsets,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BatchedRecordingProcessingStrategy(
            max_batch_row_count=max_batch_row_count,
            max_batch_size_in_bytes=max_batch_size_in_bytes,
            max_batch_time_in_seconds=max_batch_time_in_seconds,
            next_step=commit,
        )


class BatchedRecordingProcessingStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        max_batch_row_count: int,
        max_batch_size_in_bytes: int,
        max_batch_time_in_seconds: int,
        next_step: ProcessingStrategy[KafkaPayload],
    ) -> None:
        self.max_batch_row_count = max_batch_row_count
        self.max_batch_size_in_bytes = max_batch_size_in_bytes
        self.max_batch_time_in_seconds = max_batch_time_in_seconds
        self.next_step = next_step

        self.__initialize_new_batch()
        self.__closed = False

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        # Coerce the Kafka message to a RecordingSegment message.
        recording_segment = decode_recording_message(message.payload.value)

        # If the message was not well-formed submit the offset to the commit step so that it can
        # be committed. Stop all processing of the message in this step.
        if recording_segment is None:
            self.next_step.submit(message)
            return None

        # Record a billing outcome for the to-be processed segment.
        #
        # There's no guarantee that this event is unique or that it will commit so our billing
        # outcome process must be able to handle duplicates.
        recording_billing_outcome(
            key_id=message["key_id"],
            org_id=message["org_id"],
            project_id=message["project_id"],
            received=message["received"],
            replay_id=message["replay_id"],
            segment_id=message["segment_id"],
        )

        # Process click events
        # replay_click_post_processor(message, headers["segment_id"], recording_segment, transaction)

        # Process the message and store in the batch accumulator.
        processed_recording_segment = prepare_recording_message_batch_item(recording_segment)
        self.__batch.append(processed_recording_segment)
        self.__batch_size_in_bytes += len(processed_recording_segment["encrypted_message"])

        # Forward the message to the commit step. The contents of the payload are irrelevant so
        # we forward the un-modified value.
        self.next_step.submit(message)

    def commit(self, force: bool) -> bool:
        if (
            force
            or self.has_exceeded_batch_row_count
            or self.has_exceeded_batch_byte_size
            or self.has_exceeded_last_batch_commit_time
        ):
            # Reduce the accumulated set of staged segments to a single file plus its offset rows.
            commit = prepare_batched_commit(self.__batch)

            # The file is saved first. In the event this process can not complete the file may be
            # orphaned in the remote storage provider. This is considered an acceptable outcome as
            # the file has a hard-coded TTL configured within the bucket.
            save_file(commit["filename"], commit["payload"])

            # Offsets are inserted for tracking in the database. If these rows are written the data
            # is considered fully committed and the process can complete.
            #
            # In the event Kafka offsets are not committed after this step then the file and the
            # rows will be re-inserted. Duplicates must be tolerated.
            bulk_insert_file_part_rows(commit["rows"])

            # Reset the batch.
            self.__initialize_new_batch()
            return True
        else:
            return False

    def poll(self) -> None:
        committed = self.commit(force=False)

        # Only commit the offsets if we've flushed the buffer.
        if committed:
            self.next_step.poll()

    def join(self, timeout: Optional[float] = None) -> None:
        committed = self.commit(force=True)

        # Only commit the offsets if we've flushed the buffer. This should always be true. This is
        # a guard to protect the consumer from future changes to buffer flushing semantics. If
        # this condition is not always observed data-loss will occur.
        if committed:
            self.next_step.join(timeout=timeout)

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__initialize_new_batch()
        self.__closed = True
        self.next_step.terminate()

    def __initialize_new_batch(self) -> None:
        self.__batch: List[ProcessedRecordingSegment] = []
        self.__batch_size_in_bytes: int = 0
        self.__batch_next_commit_time: int = self.__new_batch_next_commit_time()

    def __new_batch_next_commit_time(self) -> int:
        """Return the next batch commit time."""
        return int(time.time()) + self.max_batch_time_in_seconds

    @property
    def has_exceeded_batch_row_count(self) -> bool:
        return len(self.__batch) >= self.max_batch_row_count

    @property
    def has_exceeded_batch_byte_size(self) -> bool:
        """Return "True" if the batch's total byte size meets or exceeds the commit threshold."""
        return self.__batch_size_in_bytes >= self.max_batch_size_in_bytes

    @property
    def has_exceeded_last_batch_commit_time(self) -> bool:
        """Return "True" if the batch's wait time meets or exceeds the commit threshold."""
        return time.time() >= self.__batch_next_commit_time

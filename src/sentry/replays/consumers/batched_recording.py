from typing import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Message, Partition

from sentry.replays.lib.batched_file_storage.consumer import BatchedFileStorageProcessingStrategy
from sentry.replays.usecases.ingest import recording_billing_outcome
from sentry.replays.usecases.ingest.batched_recording import decode_recording_message


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


class BatchedRecordingProcessingStrategy(BatchedFileStorageProcessingStrategy):
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
            key_id=recording_segment["key_id"],
            org_id=recording_segment["org_id"],
            project_id=recording_segment["project_id"],
            received=recording_segment["received"],
            replay_id=recording_segment["replay_id"],
            segment_id=recording_segment["segment_id"],
        )

        # Process click events
        # replay_click_post_processor(message, headers["segment_id"], recording_segment, transaction)

        self.__append_to_batch(
            key=f"{recording_segment['replay_id']}{recording_segment['segment_id']}",
            message=recording_segment["payload"],
        )

        self.next_step.submit(message)

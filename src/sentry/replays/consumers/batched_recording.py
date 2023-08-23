import random
from typing import Mapping

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Message, Partition
from django.conf import settings

from sentry.replays.lib.batched_file_storage.consumer import BatchedFileStorageProcessingStrategy
from sentry.replays.usecases.ingest import recording_billing_outcome, replay_click_post_processor
from sentry.replays.usecases.ingest.decode import decode_recording_message


class ProcessReplayRecordingStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
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

        recording_segment = decode_recording_message(message.payload.value)

        # If the message was not well-formed submit the offset to the commit step so that it can
        # be committed. Stop all processing of the message in this step.
        if recording_segment is None:
            self.next_step.submit(message)
            return None

        transaction = sentry_sdk.start_transaction(
            name="replays.consumer.process_batched_recording",
            op="replays.consumer",
            sampled=random.random()
            < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
        )

        # Process the segment.
        #
        # There's no guarantee that this event is unique or that it will commit so any side-effect
        # we produce must tolerate duplicates.
        recording_billing_outcome(message)
        replay_click_post_processor(message, transaction)

        self.__append_to_batch(
            key=f"{recording_segment['replay_id']}{recording_segment['segment_id']}",
            message=recording_segment["payload"],
        )

        self.next_step.submit(message)

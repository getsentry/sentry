import time
from typing import List, Optional, cast

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message

from sentry.replays.lib.batched_file_storage.create import (
    FilePart,
    RawFilePart,
    create_new_batch,
    process_pending_file_part,
)


class BatchedFileStorageProcessingStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        max_batch_size_in_bytes: int,
        max_batch_time_in_seconds: int,
        max_message_count: int,
        next_step: ProcessingStrategy[KafkaPayload],
    ) -> None:
        self.max_batch_size_in_bytes = max_batch_size_in_bytes
        self.max_batch_time_in_seconds = max_batch_time_in_seconds
        self.max_message_count = max_message_count
        self.next_step = next_step

        self.__initialize_new_batch()
        self.__closed = False

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        # Deserialize the message.
        raw_file_part = cast(RawFilePart, msgpack.unpackb(message.payload.value))

        #
        self.__append_to_batch(key=raw_file_part["key"], message=raw_file_part["message"])

        # Forward the message to the commit step. The contents of the payload are irrelevant so
        # we forward the un-modified value.
        self.next_step.submit(message)

    def commit(self, force: bool) -> bool:
        if (
            force
            or self.has_exceeded_max_message_count
            or self.has_exceeded_batch_byte_size
            or self.has_exceeded_last_batch_commit_time
        ):
            create_new_batch(self.__batch)
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

    def __append_to_batch(self, key: str, message: bytes) -> None:
        file_part = process_pending_file_part({"key": key, "message": message})
        self.__batch.append(file_part)
        self.__batch_size_in_bytes += len(file_part["message"])

    def __initialize_new_batch(self) -> None:
        self.__batch: List[FilePart] = []
        self.__batch_size_in_bytes: int = 0
        self.__batch_next_commit_time: int = self.__new_batch_next_commit_time()

    def __new_batch_next_commit_time(self) -> int:
        """Return the next batch commit time."""
        return int(time.time()) + self.max_batch_time_in_seconds

    @property
    def has_exceeded_max_message_count(self) -> bool:
        return len(self.__batch) >= self.max_message_count

    @property
    def has_exceeded_batch_byte_size(self) -> bool:
        """Return "True" if the batch's total byte size meets or exceeds the commit threshold."""
        return self.__batch_size_in_bytes >= self.max_batch_size_in_bytes

    @property
    def has_exceeded_last_batch_commit_time(self) -> bool:
        """Return "True" if the batch's wait time meets or exceeds the commit threshold."""
        return time.time() >= self.__batch_next_commit_time

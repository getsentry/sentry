"""Batched file consumer reference implementation.

This could be implemented as its own consumer or it can be inherited by a pre-existing consumer.
"""
from __future__ import annotations

import time

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message

from sentry.replays.lib.batched_file_storage.create import FilePart, create_new_batch


class BatchedFileStorageProcessingStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        max_batch_size_in_bytes: int,
        max_batch_time_in_seconds: int,
        max_batch_row_count: int,
        next_step: ProcessingStrategy[KafkaPayload],
    ) -> None:
        self.max_batch_size_in_bytes = max_batch_size_in_bytes
        self.max_batch_time_in_seconds = max_batch_time_in_seconds
        self.max_batch_row_count = max_batch_row_count
        self.next_step = next_step

        self.__initialize_new_batch()
        self._closed = False

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self._closed

        # Deserialize and push into the buffer.
        self.append_to_batch(msgpack.unpackb(message.payload.value))

        # The next-step accepts the raw message value.  As of writing, the next-step is assumed to
        # be the commit-step (a no-op).
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

    def join(self, timeout: float | None = None) -> None:
        committed = self.commit(force=True)

        # Only commit the offsets if we've flushed the buffer. This should always be true. This is
        # a guard to protect the consumer from future changes to buffer flushing semantics. If
        # this condition is not always observed data-loss will occur.
        if committed:
            self.next_step.join(timeout=timeout)

    def close(self) -> None:
        self._closed = True

    def terminate(self) -> None:
        self.__initialize_new_batch()
        self._closed = True
        self.next_step.terminate()

    def append_to_batch(self, file_part: FilePart) -> None:
        self.__batch.append(file_part)
        self.__batch_size_in_bytes += len(file_part["message"])

    def __initialize_new_batch(self) -> None:
        self.__batch: list[FilePart] = []
        self.__batch_size_in_bytes: int = 0
        self.__batch_next_commit_time: int = self.__new_batch_next_commit_time()

    def __new_batch_next_commit_time(self) -> int:
        """Return the next batch commit time."""
        return int(time.time()) + self.max_batch_time_in_seconds

    @property
    def has_exceeded_max_message_count(self) -> bool:
        """Return "True" if we have accumulated the configured number of messages."""
        return len(self.__batch) >= self.max_batch_row_count

    @property
    def has_exceeded_batch_byte_size(self) -> bool:
        """Return "True" if we have accumulated the configured number of bytes."""
        return self.__batch_size_in_bytes >= self.max_batch_size_in_bytes

    @property
    def has_exceeded_last_batch_commit_time(self) -> bool:
        """Return "True" if we have waited to commit for the configured amount of time."""
        return time.time() >= self.__batch_next_commit_time

from typing import Any, Generic, TypeVar

from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message

TPayload = TypeVar("TPayload")


class CommitSpanOffsets(CommitOffsets, Generic[TPayload]):
    """
    Inherits from CommitOffsets so we can add a next step. We'd like to commit offsets for
    processed spans before carrying on the work to build segments and produce them since
    the processing messages and producing segments are two distinct operations. Span messages
    should be committed once they are processed and put into redis.
    """

    def __init__(self, commit: Commit, next_step: ProcessingStrategy[TPayload]) -> None:
        super().__init__(commit=commit)
        self.__next_step = next_step

    def poll(self) -> None:
        super().poll()
        self.__next_step.poll()

    def submit(self, message: Message[TPayload]) -> None:
        super().submit(message)
        self.__next_step.submit(message)

    def close(self) -> None:
        self.__next_step.close()

    def terminate(self) -> None:
        self.__next_step.terminate()

    def join(self, timeout: float | None = None) -> None:
        super().join(timeout)
        self.__next_step.join(timeout=timeout)


class NoOp(ProcessingStrategy[Any]):
    def __init__(self) -> None:
        return

    def poll(self) -> None:
        pass

    def submit(self, message: Message[Any]) -> None:
        pass

    def close(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def join(self, timeout: float | None = None) -> None:
        pass

from typing import Any, TypeVar

from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, FilteredPayload, Message

TPayload = TypeVar("TPayload")


class CommitSpanOffsets(CommitOffsets):
    def __init__(
        self, commit: Commit, next_step: ProcessingStrategy[FilteredPayload | TPayload]
    ) -> None:
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

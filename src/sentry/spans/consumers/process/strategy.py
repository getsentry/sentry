import time
from typing import Any, Generic, TypeVar, Union

from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Commit, FilteredPayload, Message
from arroyo.utils.metrics import get_metrics

TPayload = TypeVar("TPayload")


class CommitSpanOffsets(ProcessingStrategy[Union[FilteredPayload, TPayload]], Generic[TPayload]):
    def __init__(
        self, commit: Commit, next_step: ProcessingStrategy[FilteredPayload | TPayload]
    ) -> None:
        self.__commit = commit
        self.__metrics = get_metrics()
        self.__last_record_time: float | None = None
        self.__next_step = next_step

    def poll(self) -> None:
        self.__commit({})
        self.__next_step.poll()

    def submit(self, message: Message[Any]) -> None:
        now = time.time()
        if self.__last_record_time is None or now - self.__last_record_time > 1:
            if message.timestamp is not None:
                self.__metrics.timing(
                    "arroyo.consumer.latency", now - message.timestamp.timestamp()
                )
                self.__last_record_time = now
        self.__commit(message.committable)
        self.__next_step.submit(message)

    def close(self) -> None:
        self.__next_step.close()

    def terminate(self) -> None:
        self.__next_step.terminate()

    def join(self, timeout: float | None = None) -> None:
        # Commit all previously staged offsets
        self.__commit({}, force=True)
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

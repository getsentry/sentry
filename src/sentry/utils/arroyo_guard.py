import logging
from abc import ABC, abstractmethod
from collections import deque
from collections.abc import Callable
from typing import Any, Deque, Generic, TypeVar

from arroyo.dlq import InvalidMessage
from arroyo.processing.strategies import MessageRejected
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, TStrategyPayload

logger = logging.getLogger(__name__)

TResult = TypeVar("TResult")
TResult_co = TypeVar("TResult_co", covariant=True)


class HasNextStep(ABC, Generic[TResult]):
    @abstractmethod
    def __init__(self, next_step: ProcessingStrategy[TResult], *args: Any, **kwargs: Any) -> None:
        pass


class NonFinalStrategy(ProcessingStrategy[TStrategyPayload], HasNextStep[TResult]):
    pass


def guard(
    max_buffer_size: int = 10,
) -> Callable[
    [type[NonFinalStrategy[TStrategyPayload, TResult]]],
    type[NonFinalStrategy[TStrategyPayload, TResult]],
]:
    """
    Handles backpressure and invalid messages for any strategy. If
    MessageRejected or InvalidMessage is received from the inner strategy
    from the inner strategy the message is carried over by the guard for
    future submission / reraise so the parent strategy does not have to implement
    any handling for this scenario and can safely call `next_step.submit()`
    in any part of the strategy.

    `next_step` must be the first arg in the constructor.

    """

    def guard_inner(
        cls: type[NonFinalStrategy[TStrategyPayload, TResult]]
    ) -> type[NonFinalStrategy[TStrategyPayload, TResult]]:

        class Guard(NonFinalStrategy[TStrategyPayload, TResult]):
            def __init__(
                self, next_step: ProcessingStrategy[TResult], *args: Any, **kwargs: Any
            ) -> None:
                self.__messages_carried_over: Deque[Message[TResult]] = deque()
                self.__invalid_messages: Deque[InvalidMessage] = deque()
                self.__instance = cls(next_step, *args, **kwargs)
                self.__inner_submit = next_step.submit

                def wrapped_inner_submit(msg: Message[TResult]) -> None:
                    self.__messages_carried_over.append(msg)
                    self.__process_pending_messages()

                setattr(next_step, "submit", wrapped_inner_submit)
                assert isinstance(next_step, ProcessingStrategy)

            def __process_pending_messages(self) -> None:
                while self.__invalid_messages:
                    raise self.__invalid_messages.popleft()

                while self.__messages_carried_over:
                    try:
                        self.__inner_submit(self.__messages_carried_over[0])
                        self.__messages_carried_over.popleft()
                    except MessageRejected:
                        break
                    except InvalidMessage as exc:
                        self.__invalid_messages.append(exc)

            def submit(self, msg: Message[TStrategyPayload]) -> None:
                if len(self.__messages_carried_over) > max_buffer_size:
                    raise MessageRejected

                self.__messages_carried_over.append(msg)
                self.__process_pending_messages()

            def poll(self) -> None:
                self.__process_pending_messages()
                self.__instance.poll()

            def close(self) -> None:
                self.__instance.close()

            def terminate(self) -> None:
                self.__instance.terminate()

            def join(self, timeout: float | None = None) -> None:
                self.__process_pending_messages()
                self.__instance.join(timeout)

            def __getattr__(self, name: str) -> Any:
                # Forward all other attributes to the original class
                return getattr(cls, name)

        # Return modified class, keep original metadata
        Guard.__name__ = cls.__name__
        Guard.__doc__ = cls.__doc__
        Guard.__module__ = cls.__module__
        Guard.__qualname__ = cls.__qualname__

        return Guard

    return guard_inner


class Guard(ProcessingStrategy[TStrategyPayload]):
    """
    Handles backpressure and invalid messages for any strategy. If
    MessageRejected or InvalidMessage is received from the inner strategy
    from the inner strategy the message is carried over by the guard for
    future submission / reraise so the parent strategy does not have to implement
    any handling for this scenario and can safely call `next_step.submit()`
    in any part of the strategy.

    Usage:
    ```
    class StepOne(...):
        def __init__(self, next_step):
            self.next_step = Guard(next_step)
    ```
    """

    def __init__(
        self, next_step: ProcessingStrategy[TStrategyPayload], max_buffer_size: int = 10
    ) -> None:
        self.next_step = next_step
        self.max_buffer_size = max_buffer_size
        self.__messages_carried_over: Deque[Message[TResult] | InvalidMessage] = deque()
        self.__invalid_messages: Deque[Message[TResult] | InvalidMessage] = deque()

    def __process_pending_messages(self) -> None:
        # re-raise any invalid messages first
        while self.__invalid_messages:
            raise self.__messages_carried_over.popleft()

        # re-submit carried over messages in order
        while self.__messages_carried_over:
            try:
                self.next_step(self.__messages_carried_over[0])
                self.__messages_carried_over.popleft()
            except MessageRejected:
                break
            except InvalidMessage as exc:
                self.__invalid_messages.append(exc)

    def submit(self, message: Message[TStrategyPayload]) -> None:
        if len(self.__messages_carried_over) > self.max_buffer_size:
            raise MessageRejected

        self.__messages_carried_over.append(message)
        self.__process_pending_messages()

    def poll(self) -> None:
        self.__process_pending_messages()

        self.next_step.poll()

    def join(self, timeout: float | None = None) -> None:
        self.__process_pending_messages()
        self.next_step.join(timeout)

    def close(self) -> None:
        self.next_step.close()

    def terminate(self) -> None:
        self.next_step.terminate()

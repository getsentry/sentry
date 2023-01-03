import logging
from typing import Optional

from arroyo.errors import MessageRejected
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, TPayload


class LogExceptionStep(ProcessingStrategy[TPayload]):
    def __init__(
        self,
        message: str,
        logger: logging.Logger,
        next_step: ProcessingStrategy[TPayload],
    ) -> None:
        self.__exception_message = message
        self.__next_step = next_step
        self.__closed = False
        self.__logger = logger

    def submit(self, message: Message[TPayload]) -> None:
        assert not self.__closed

        try:
            self.__next_step.submit(message)
        except MessageRejected:
            # if we reject due to backpressure, we should not log an exception
            # as this can cause an extreme amount of exceptions to be generated
            return
        except Exception:
            self.__logger.exception(self.__exception_message)

    def poll(self) -> None:
        try:
            self.__next_step.poll()
        except Exception:
            self.__logger.exception(self.__exception_message)

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__closed = True

        self.__logger.debug("Terminating %r...", self.__next_step)
        self.__next_step.terminate()

    def join(self, timeout: Optional[float] = None) -> None:
        self.__next_step.close()
        self.__next_step.join(timeout)

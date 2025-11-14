from __future__ import annotations
from typing import int

import sentry_sdk
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, TStrategyPayload


class JoinProfiler(ProcessingStrategy[TStrategyPayload]):
    """
    Strategy which passes through all ProcessingStrategy method calls,
    but runs Sentry's continuous profiler for `join()` calls.

    This startegy is being used to troubleshoot our consumers hanging during `join()` occasionally.
    """

    def __init__(self, next_step: ProcessingStrategy[TStrategyPayload]) -> None:
        self.__next_step = next_step

    def join(self, timeout: float | None = None):
        with sentry_sdk.start_transaction(
            op="consumer_join", name="consumer.join", custom_sampling_context={"sample_rate": 1.0}
        ):
            self.__next_step.join(timeout)

    def submit(self, message: Message[TStrategyPayload]) -> None:
        self.__next_step.submit(message)

    def poll(self) -> None:
        self.__next_step.poll()

    def close(self) -> None:
        self.__next_step.close()

    def terminate(self) -> None:
        self.__next_step.terminate()

from __future__ import annotations

import sentry_sdk
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, TStrategyPayload
from sentry_sdk import traces
from sentry_sdk.scope import Scope


class JoinProfiler(ProcessingStrategy[TStrategyPayload]):
    """
    Strategy which passes through all ProcessingStrategy method calls,
    but runs Sentry's continuous profiler for `join()` calls.

    This startegy is being used to troubleshoot our consumers hanging during `join()` occasionally.
    """

    def __init__(self, next_step: ProcessingStrategy[TStrategyPayload]) -> None:
        self.__next_step = next_step

    def join(self, timeout: float | None = None):
        traces.new_trace()
        _start_span_ctx_1 = sentry_sdk.get_current_scope().get_active_propagation_context()
        _start_span_prev_1 = _start_span_ctx_1.custom_sampling_context
        Scope.set_custom_sampling_context({"sample_rate": 1.0})
        try:
            _start_span_tmp_1 = traces.start_span(
                name="consumer.join",
                attributes={"sentry.op": "consumer_join"},
                parent_span=None,
            )
        finally:
            _start_span_ctx_1.custom_sampling_context = _start_span_prev_1
        with _start_span_tmp_1:
            self.__next_step.join(timeout)

    def submit(self, message: Message[TStrategyPayload]) -> None:
        self.__next_step.submit(message)

    def poll(self) -> None:
        self.__next_step.poll()

    def close(self) -> None:
        self.__next_step.close()

    def terminate(self) -> None:
        self.__next_step.terminate()

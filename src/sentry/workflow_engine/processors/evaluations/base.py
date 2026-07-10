from collections.abc import Collection
from dataclasses import dataclass
from functools import cached_property

from sentry.workflow_engine.processors.evaluations.trigger_result import TriggerResult


@dataclass(frozen=True, kw_only=True)
class BaseWorkflowEngineEvaluation[R, E]:
    """
    This is a shared base class for all Evaluation classes.

    Should `result` be an abstract property?
    Should `error` be limited to ConditionError?
    """

    result: R
    error: E | None = None

    @cached_property
    def outcome(self) -> TriggerResult:
        if isinstance(self.result, Collection):
            triggered = len(self.result) > 0
        else:
            triggered = self.result is not None

        return TriggerResult(
            triggered=triggered,
            error=self.error,
        )

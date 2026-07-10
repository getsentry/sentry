from dataclasses import dataclass
from functools import cached_property

from sentry.workflow_engine.processors.evaluations.trigger_result import TriggerResult


@dataclass(frozen=True, kw_only=True)
class BaseWorkflowEngineEvaluation[R, E]:
    """
    This is a shared base class for all Evaluation classes.
    """

    result: R | None = None
    error: E | None = None

    @cached_property
    def outcome(self) -> TriggerResult:
        return TriggerResult(
            triggered=(self.result is not None),
            error=self.error,
        )

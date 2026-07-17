from collections.abc import Collection
from dataclasses import dataclass, field
from functools import cached_property

from sentry.workflow_engine.processors.evaluations.trigger_result import TriggerResult
from sentry.workflow_engine.types import ConditionError


@dataclass(frozen=True, kw_only=True)
class BaseWorkflowEngineEvaluation[R, D]:
    """
    This is a shared base class for all Evaluation classes.

    - result: R - the result of the evaluation, this is what should be consumed.
    - data: D - this is to store data used to generate the evaluation.
    - error: ConditionError - if there is an error while evaluating something in workflow engine, create a condition error
    - outcome: TriggerResult - this is a two fold helper, first it allows us to reuse the `TriggerResult`
        to simplify the migration. Second, it allows us to do taint tracking with the result and error fields.
    - triggered: bool | None - The authoritative triggered state, set by the evaluation when `result` alone
        can't express it. A group can trigger with an empty `result` - e.g. it has no
        conditions, or it's a NONE group where nothing matched - and `len(result)` can't
        tell that apart from an ANY/ALL group that failed. When left unset we infer it
        from `result`. Excluded from equality so evaluations still compare on `result`
        and `error`.
    """

    result: R
    data: D
    error: ConditionError | None = None

    triggered: bool | None = field(default=None, compare=False)

    @cached_property
    def outcome(self) -> TriggerResult:
        if self.triggered is not None:
            triggered = self.triggered
        elif isinstance(self.result, bool):
            triggered = self.result
        elif isinstance(self.result, Collection):
            triggered = len(self.result) > 0
        else:
            triggered = self.result is not None

        return TriggerResult(
            triggered=triggered,
            error=self.error,
        )

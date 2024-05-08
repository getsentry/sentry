from pydantic import BaseModel, constr

from flagpole.evaluation_context import EvaluationContext
from flagpole.operators import AvailableOperators


class Condition(BaseModel):
    property: str | None
    operator: AvailableOperators

    def match(self, context: EvaluationContext, segment_name: str) -> bool:
        if self.property is None:
            return False

        return self.operator.match(
            condition_property=context.get(self.property), segment_name=segment_name
        )


class Segment(BaseModel):
    name: constr(min_length=1)  # type:ignore[valid-type]
    conditions: list[Condition]
    rollout: int | None = 0

    def match(self, context: EvaluationContext) -> bool:
        for condition in self.conditions:
            match_condition = condition.match(context, segment_name=self.name)
            if not match_condition:
                return False
        # Apply incremental rollout if available.
        if self.rollout is not None and self.rollout < 100:
            return context.id() % 100 <= self.rollout

        return True

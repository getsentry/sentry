from pydantic import BaseModel

from flagpole.evaluation_context import EvaluationContext
from flagpole.operators import AvailableOperators


class Condition(BaseModel):
    name: str
    property: str | None
    operator: AvailableOperators

    def match(self, context: EvaluationContext, segment_name: str) -> bool:
        if self.property is None:
            return False

        return self.operator.match(
            condition_property=context.get(self.property), segment_name=segment_name
        )

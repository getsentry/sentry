from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors.evaluations import (
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
)
from sentry.workflow_engine.types import ConditionError


class TestFromConditions(TestCase):
    def _condition_evaluation(self, triggered: bool) -> DataConditionEvaluation:
        return DataConditionEvaluation(
            result=True if triggered else None,
            triggered=triggered,
            data=None,
            condition=self.create_data_condition(),
        )

    def test_result_mirrors_triggered(self) -> None:
        for triggered in (True, False):
            evaluation = DataConditionGroupEvaluation.from_conditions(
                triggered=triggered,
                logic_type=DataConditionGroup.Type.ANY,
            )
            assert evaluation.result is triggered
            assert evaluation.triggered is triggered

    def test_defaults(self) -> None:
        evaluation = DataConditionGroupEvaluation.from_conditions(
            triggered=True,
            logic_type=DataConditionGroup.Type.ALL,
        )
        assert evaluation.condition_evaluations == []
        assert evaluation.logic_type == DataConditionGroup.Type.ALL
        assert evaluation.error is None
        assert not evaluation.is_tainted()

    def test_condition_evaluations_and_error(self) -> None:
        condition_evaluation = self._condition_evaluation(triggered=True)
        error = ConditionError(msg="boom")
        evaluation = DataConditionGroupEvaluation.from_conditions(
            triggered=True,
            logic_type=DataConditionGroup.Type.ANY,
            condition_evaluations=[condition_evaluation],
            error=error,
        )
        assert evaluation.data["condition_evaluations"] == [condition_evaluation]
        assert evaluation.error == error
        assert evaluation.is_tainted()

    def test_accepts_raw_logic_type_string(self) -> None:
        evaluation = DataConditionGroupEvaluation.from_conditions(
            triggered=False,
            logic_type="not-a-real-logic-type",
            error=ConditionError(msg="Invalid DataConditionGroup.logic_type"),
        )
        assert evaluation.data["logic_type"] == "not-a-real-logic-type"
        assert evaluation.triggered is False

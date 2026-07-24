from unittest import mock

from sentry.workflow_engine.models import DataCondition, DataConditionGroup
from sentry.workflow_engine.processors.evaluations import (
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    DetectorEvaluation,
)
from sentry.workflow_engine.processors.evaluations.base import BaseWorkflowEngineEvaluation
from sentry.workflow_engine.types import (
    ConditionError,
    DataConditionResult,
    DetectorPriorityLevel,
)

ERR = ConditionError(msg="test error")
OTHER_ERR = ConditionError(msg="other error")


def _ev(triggered: bool, error: ConditionError | None = None) -> DataConditionGroupEvaluation:
    """Build a minimal evaluation carrying just `triggered`/`error` for the taint algebra."""
    return DataConditionGroupEvaluation(
        result=triggered,
        triggered=triggered,
        error=error,
        data={
            "condition_evaluations": [],
            "logic_type": DataConditionGroup.Type.ANY,
        },
    )


class TestAny:
    def test_all_untainted_true_returns_untainted_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.any([_ev(False), _ev(True), _ev(False)]) == (True, None)

    def test_one_untainted_true_returns_untainted_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.any([_ev(True), _ev(True, ERR)]) == (True, None)
        assert BaseWorkflowEngineEvaluation.any([_ev(True, ERR), _ev(True)]) == (True, None)

    def test_only_tainted_true_returns_tainted_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.any([_ev(False), _ev(True, ERR), _ev(False)]) == (
            True,
            ERR,
        )

    def test_no_true_returns_false_with_error_if_present(self) -> None:
        assert BaseWorkflowEngineEvaluation.any([_ev(False), _ev(False, ERR), _ev(False)]) == (
            False,
            ERR,
        )

    def test_all_false_untainted_returns_untainted_false(self) -> None:
        assert BaseWorkflowEngineEvaluation.any([_ev(False), _ev(False), _ev(False)]) == (
            False,
            None,
        )

    def test_untainted_true_with_tainted_false_returns_clean_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.any([_ev(True), _ev(False, ERR)]) == (True, None)

    def test_generator_preserves_error(self) -> None:
        assert BaseWorkflowEngineEvaluation.any(
            iter([_ev(False), _ev(False, ERR), _ev(False)])
        ) == (False, ERR)

    def test_empty_returns_untainted_false(self) -> None:
        assert BaseWorkflowEngineEvaluation.any([]) == (False, None)


class TestAll:
    def test_all_untainted_true_returns_untainted_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.all([_ev(True), _ev(True), _ev(True)]) == (True, None)

    def test_any_tainted_returns_tainted(self) -> None:
        assert BaseWorkflowEngineEvaluation.all([_ev(True), _ev(True, ERR), _ev(True)]) == (
            True,
            ERR,
        )

    def test_untainted_false_and_tainted_true_returns_clean_false(self) -> None:
        # Clean because we have untainted False
        assert BaseWorkflowEngineEvaluation.all([_ev(True), _ev(False), _ev(True, ERR)]) == (
            False,
            None,
        )

    def test_only_tainted_false_returns_tainted_false(self) -> None:
        assert BaseWorkflowEngineEvaluation.all([_ev(True), _ev(False, ERR)]) == (False, ERR)

    def test_all_false_untainted_returns_untainted_false(self) -> None:
        assert BaseWorkflowEngineEvaluation.all([_ev(False), _ev(False), _ev(False)]) == (
            False,
            None,
        )

    def test_untainted_false_with_tainted_true_returns_clean_false(self) -> None:
        assert BaseWorkflowEngineEvaluation.all([_ev(False), _ev(True, ERR)]) == (False, None)

    def test_generator_preserves_error(self) -> None:
        assert BaseWorkflowEngineEvaluation.all(iter([_ev(True), _ev(True, ERR), _ev(True)])) == (
            True,
            ERR,
        )

    def test_empty_returns_untainted_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.all([]) == (True, None)


class TestNone:
    def test_empty_returns_untainted_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.none([]) == (True, None)

    def test_all_false_untainted_returns_untainted_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.none([_ev(False), _ev(False), _ev(False)]) == (
            True,
            None,
        )

    def test_all_false_with_error_returns_tainted_true(self) -> None:
        assert BaseWorkflowEngineEvaluation.none([_ev(False), _ev(False, ERR), _ev(False)]) == (
            True,
            ERR,
        )

    def test_one_true_returns_untainted_false(self) -> None:
        assert BaseWorkflowEngineEvaluation.none([_ev(False), _ev(True), _ev(False)]) == (
            False,
            None,
        )

    def test_one_true_with_error_returns_tainted_false(self) -> None:
        assert BaseWorkflowEngineEvaluation.none([_ev(False), _ev(True, ERR), _ev(False)]) == (
            False,
            ERR,
        )

    def test_untainted_true_with_tainted_false_returns_clean_false(self) -> None:
        assert BaseWorkflowEngineEvaluation.none([_ev(True), _ev(False, ERR)]) == (False, None)

    def test_generator_preserves_error(self) -> None:
        assert BaseWorkflowEngineEvaluation.none(
            iter([_ev(False), _ev(False, ERR), _ev(False)])
        ) == (True, ERR)


class TestWithError:
    def test_sets_error_when_untainted(self) -> None:
        assert _ev(True).with_error(ERR).error == ERR

    def test_is_noop_when_already_tainted(self) -> None:
        assert _ev(True, ERR).with_error(OTHER_ERR).error == ERR


class TestChooseTainted:
    def test_returns_first_tainted(self) -> None:
        a, b = _ev(True, ERR), _ev(False)
        assert BaseWorkflowEngineEvaluation.choose_tainted(a, b) is a

    def test_returns_second_when_only_second_tainted(self) -> None:
        a, b = _ev(True), _ev(False, ERR)
        assert BaseWorkflowEngineEvaluation.choose_tainted(a, b) is b

    def test_returns_first_when_neither_tainted(self) -> None:
        a, b = _ev(True), _ev(False)
        assert BaseWorkflowEngineEvaluation.choose_tainted(a, b) is a
        assert BaseWorkflowEngineEvaluation.choose_tainted(b, a) is b


def _condition_eval(
    *,
    result: DataConditionResult = True,
    triggered: bool = True,
    error: ConditionError | None = None,
) -> DataConditionEvaluation:
    # Unsaved model instance: to_artifact only reads `id`/`type`, no DB access.
    return DataConditionEvaluation(
        condition=DataCondition(id=42, type="eq"),
        result=result,
        triggered=triggered,
        error=error,
        data="the-raw-value",  # never surfaced in the artifact
    )


class TestDataConditionEvaluationArtifact:
    def test_serializes_metadata_result_and_triggered(self) -> None:
        artifact = _condition_eval(result=True, triggered=True).to_artifact()
        assert artifact == {
            "condition_id": 42,
            "type": "eq",
            "result": True,
            "triggered": True,
            "error": None,
        }

    def test_omits_raw_value(self) -> None:
        # The evaluated value may be large / contain PII; it must never appear in the artifact.
        assert "the-raw-value" not in _condition_eval().to_artifact().values()

    def test_unwraps_enum_result(self) -> None:
        artifact = _condition_eval(result=DetectorPriorityLevel.HIGH).to_artifact()
        assert artifact["result"] == DetectorPriorityLevel.HIGH.value

    def test_serializes_error_message(self) -> None:
        artifact = _condition_eval(triggered=False, error=ERR).to_artifact()
        assert artifact["triggered"] is False
        assert artifact["error"] == "test error"


class TestDataConditionGroupEvaluationArtifact:
    def test_embeds_condition_artifacts_and_unwraps_logic_type(self) -> None:
        condition = _condition_eval()
        group = DataConditionGroupEvaluation(
            result=True,
            triggered=True,
            error=None,
            data={
                "condition_evaluations": [condition],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )
        assert group.to_artifact() == {
            "logic_type": "any",
            "result": True,
            "triggered": True,
            "error": None,
            "condition_evaluations": [condition.to_artifact()],
        }

    def test_handles_raw_string_logic_type(self) -> None:
        group = DataConditionGroupEvaluation(
            result=False,
            triggered=False,
            error=None,
            data={"condition_evaluations": [], "logic_type": "not-a-real-type"},
        )
        assert group.to_artifact()["logic_type"] == "not-a-real-type"


class TestDetectorEvaluationArtifact:
    def test_embeds_trigger_group_and_unwraps_priority(self) -> None:
        trigger_group = DataConditionGroupEvaluation(
            result=True,
            triggered=True,
            error=None,
            data={
                "condition_evaluations": [_condition_eval()],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )
        detector = DetectorEvaluation(
            result=None,
            priority=DetectorPriorityLevel.HIGH,
            triggered=True,
            error=None,
            data={
                "group_key": "group-1",
                "trigger_group_evaluation": trigger_group,
                "event_data": None,
            },
        )
        assert detector.to_artifact() == {
            "group_key": "group-1",
            "priority": DetectorPriorityLevel.HIGH.value,
            "result": None,
            "triggered": True,
            "error": None,
            "trigger_group_evaluation": trigger_group.to_artifact(),
        }


class TestToLog:
    def test_logs_under_static_prefix_with_artifact_extra(self) -> None:
        evaluation = _ev(True)
        mock_logger = mock.MagicMock()

        evaluation.to_log(mock_logger)

        mock_logger.debug.assert_called_once_with(
            "workflow_engine.evaluation.condition_group",
            extra=evaluation.to_artifact(),
        )

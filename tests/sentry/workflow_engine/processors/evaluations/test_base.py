from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors.evaluations import DataConditionGroupEvaluation
from sentry.workflow_engine.processors.evaluations.base import BaseWorkflowEngineEvaluation
from sentry.workflow_engine.types import ConditionError

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

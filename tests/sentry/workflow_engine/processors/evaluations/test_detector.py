import pytest

from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.workflow_engine.processors.evaluations import (
    DetectorEvaluation,
    DetectorEvaluationOutcome,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


def _status_change() -> StatusChangeMessage:
    return StatusChangeMessage(
        fingerprint=["detector:1"],
        project_id=1,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
    )


class TestCreateIssue:
    def test_triggers_without_a_result(self) -> None:
        evaluation = DetectorEvaluation.create_issue("group", DetectorPriorityLevel.HIGH)

        assert evaluation.result is None
        assert evaluation.triggered is True
        assert evaluation.priority == DetectorPriorityLevel.HIGH
        assert evaluation.data["group_key"] == "group"
        assert evaluation.outcome == DetectorEvaluationOutcome.TRIGGERED

    def test_rejects_an_ok_priority(self) -> None:
        with pytest.raises(ValueError):
            DetectorEvaluation.create_issue(None, DetectorPriorityLevel.OK)


class TestOk:
    def test_does_not_trigger(self) -> None:
        evaluation = DetectorEvaluation.ok("group")

        assert evaluation.triggered is False
        assert evaluation.result is None
        assert evaluation.priority == DetectorPriorityLevel.OK
        assert evaluation.outcome == DetectorEvaluationOutcome.NOT_TRIGGERED


class TestWithResult:
    def test_returns_a_copy_carrying_the_result(self) -> None:
        evaluation = DetectorEvaluation.create_issue(None, DetectorPriorityLevel.HIGH)
        status_change = _status_change()

        delivered = evaluation.with_result(status_change)

        assert delivered.result is status_change
        assert delivered.triggered is True
        assert evaluation.result is None

    def test_resolving_an_ok_evaluation(self) -> None:
        resolved = DetectorEvaluation.ok(None).with_result(_status_change())

        assert resolved.triggered is False
        assert resolved.outcome == DetectorEvaluationOutcome.RESOLVED

    def test_keeps_the_event_data_unless_replaced(self) -> None:
        evaluation = DetectorEvaluation.create_issue(None, DetectorPriorityLevel.HIGH).with_result(
            _status_change(), event_data={"event_id": "first"}
        )

        kept = evaluation.with_result(_status_change())
        replaced = evaluation.with_result(_status_change(), event_data={"event_id": "second"})

        assert kept.data["event_data"] == {"event_id": "first"}
        assert replaced.data["event_data"] == {"event_id": "second"}

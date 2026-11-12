from enum import IntEnum
from typing import Any, cast
from unittest import mock

import pytest
from jsonschema import ValidationError

from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.actor import ActorType
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models.data_condition import Condition, get_condition_handler
from sentry.workflow_engine.processors.evaluations import DataConditionEvaluationException
from sentry.workflow_engine.types import ConditionError, DetectorPriorityLevel, WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest, DataConditionHandlerMixin


class MockDataConditionEnum(IntEnum):
    FOO = 1
    BAR = 2


class ActivityTypeInConditionTest(ConditionTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dc = self.create_data_condition(
            type=Condition.ACTIVITY_TYPE_IN,
            comparison=["issue.assigned", "issue.mentioned"],
            condition_result=True,
        )

    def test_assignments(self) -> None:
        for assignee_type, assignee_id in (("user", self.user.id), ("team", self.team.id)):
            activity = self.create_group_activity(
                group=self.group,
                type=ActivityType.ASSIGNED.value,
                data={"assignee": str(assignee_id), "assigneeType": assignee_type},
            )
            self.assert_passes(self.dc, WorkflowEventData(event=activity, group=self.group))

    def test_notes_without_mentions(self) -> None:
        activity = self.create_group_activity(group=self.group, type=ActivityType.NOTE.value)
        data: object
        for data in (
            {},
            {"mentions": []},
            None,
            {"mentions": "user:1"},
        ):
            activity.data = data
            self.assert_does_not_pass(self.dc, WorkflowEventData(event=activity, group=self.group))

    def test_group_event_does_not_match(self) -> None:
        self.assert_does_not_pass(
            self.dc, WorkflowEventData(event=self.group_event, group=self.group)
        )

    def test_kind_selection(self) -> None:
        assignment = self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": str(self.user.id), "assigneeType": "user"},
        )
        mention = self.create_group_activity(
            group=self.group,
            type=ActivityType.NOTE.value,
            data={"mentions": [{"actor_type": ActorType.USER, "id": self.user.id}]},
        )
        self.assert_passes(self.dc, WorkflowEventData(event=mention, group=self.group))
        self.dc.comparison = ["issue.assigned"]
        self.assert_passes(self.dc, WorkflowEventData(event=assignment, group=self.group))
        self.assert_does_not_pass(self.dc, WorkflowEventData(event=mention, group=self.group))
        self.dc.comparison = ["issue.mentioned"]
        self.assert_passes(self.dc, WorkflowEventData(event=mention, group=self.group))
        self.assert_does_not_pass(self.dc, WorkflowEventData(event=assignment, group=self.group))

    def test_comparison_schema(self) -> None:
        comparison: object
        for comparison in (
            [],
            "issue.assigned",
            [11],
            ["unknown"],
            ["issue.assigned", "issue.assigned"],
        ):
            self.dc.comparison = comparison
            with pytest.raises(ValidationError):
                self.dc.save()

    def test_malformed_stored_comparison(self) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": str(self.user.id)},
        )
        for comparison in (
            "issue.assigned",
            ["issue.assigned", {}],
        ):
            # Simulate invalid data written outside the model's save validation.
            self.dc.comparison = comparison
            self.assert_does_not_pass(self.dc, WorkflowEventData(event=activity, group=self.group))


class GetConditionResultTest(TestCase):
    def test_str(self) -> None:
        dc = self.create_data_condition(condition_result="wrong")
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            assert dc.get_condition_result() == ConditionError(msg="Invalid condition result")
            assert mock_logger.error.call_args[0][0] == "Invalid condition result"

    def test_int(self) -> None:
        dc = self.create_data_condition(condition_result=1)
        assert dc.get_condition_result() == 1

    def test_float(self) -> None:
        dc = self.create_data_condition(condition_result=1.0)
        assert dc.get_condition_result() == 1.0

    def test_int__overlaps_with_priority_low(self) -> None:
        dc = self.create_data_condition(condition_result=25)
        assert dc.get_condition_result() == 25
        assert dc.get_condition_result() == DetectorPriorityLevel.LOW

    def test_priority_level__as_level(self) -> None:
        dc = self.create_data_condition(condition_result=DetectorPriorityLevel.HIGH)
        assert dc.get_condition_result() == DetectorPriorityLevel.HIGH
        assert dc.get_condition_result() == 75

    def test_boolean(self) -> None:
        dc = self.create_data_condition(condition_result=True)
        assert dc.get_condition_result() is True


class GetConditionHandlerTest(TestCase):
    def test_operator_condition(self) -> None:
        assert get_condition_handler(Condition.EQUAL) is None

    def test_registered_condition(self) -> None:
        assert get_condition_handler(Condition.EVERY_EVENT) is not None

    @mock.patch("sentry.workflow_engine.models.data_condition.condition_handler_registry.get")
    def test_unregistered_condition(self, mock_get: mock.Mock) -> None:
        mock_get.side_effect = NoRegistrationExistsError

        assert get_condition_handler(Condition.AGE_COMPARISON) is None


class EvaluateValueTest(DataConditionHandlerMixin, BaseWorkflowTest):
    def test(self) -> None:
        dc = self.create_data_condition(
            type=Condition.GREATER,
            comparison=cast(Any, 1.0),
            condition_result=DetectorPriorityLevel.HIGH,
        )
        evaluation = dc.evaluate_value(2)
        assert evaluation.triggered is True
        assert evaluation.result == DetectorPriorityLevel.HIGH

        evaluation = dc.evaluate_value(1)
        assert evaluation.triggered is False
        assert evaluation.result is None

    def test_dict_comparison_result(self) -> None:
        def evaluate_value(
            value: int, comparison: dict[str, DetectorPriorityLevel]
        ) -> DetectorPriorityLevel:
            return (
                DetectorPriorityLevel.HIGH
                if comparison["baz"].value > 1
                else DetectorPriorityLevel.OK
            )

        dc = self.setup_condition_mocks(
            evaluate_value, ["sentry.workflow_engine.models.data_condition"]
        )
        dc.update(comparison={"baz": MockDataConditionEnum.BAR})
        evaluation = dc.evaluate_value(2)
        assert evaluation.result == DetectorPriorityLevel.HIGH

        dc.update(comparison={"baz": MockDataConditionEnum.FOO})
        evaluation = dc.evaluate_value(0)
        assert evaluation.result == DetectorPriorityLevel.OK
        self.teardown_condition_mocks()

    def test_bad_condition(self) -> None:
        with pytest.raises(ValueError):
            # Raises ValueError because the condition is invalid
            self.create_data_condition(
                type=cast(Any, "invalid"),
                comparison=cast(Any, 1.0),
                condition_result=DetectorPriorityLevel.HIGH,
            )

    def test_bad_comparison(self) -> None:
        dc = self.create_data_condition(
            type=Condition.GREATER, comparison="hi", condition_result=DetectorPriorityLevel.HIGH
        )

        # Raises a TypeError because str vs int comparison
        with mock.patch("sentry.workflow_engine.models.data_condition.logger") as mock_logger:
            dc.evaluate_value(2)
            assert mock_logger.exception.call_args[0][0] == "Invalid comparison for data condition"

    def test_condition_result_comparison_fails(self) -> None:
        dc = self.create_data_condition(
            type=Condition.GREATER,
            comparison=cast(Any, 1.0),
            condition_result="wrong",
        )
        evaluation = dc.evaluate_value(2)
        assert evaluation.result is None
        assert evaluation.error == ConditionError(msg="Invalid condition result")

    def test_condition_evaluation__data_condition_exception(self) -> None:
        def evaluate_value(value: int, comparison: int) -> bool:
            raise DataConditionEvaluationException("A known error occurred")

        dc = self.setup_condition_mocks(
            evaluate_value, ["sentry.workflow_engine.models.data_condition"]
        )

        with mock.patch("sentry.workflow_engine.models.data_condition.logger.info") as mock_logger:
            dc.evaluate_value(2)
            assert (
                mock_logger.call_args[0][0]
                == "A known error occurred while evaluating a data condition"
            )

        self.teardown_condition_mocks()

    def test_condition_evaluation___exception(self) -> None:
        def evaluate_value(value: int, comparison: int) -> bool:
            raise Exception("Something went wrong")

        dc = self.setup_condition_mocks(
            evaluate_value, ["sentry.workflow_engine.models.data_condition"]
        )

        with pytest.raises(Exception):
            dc.evaluate_value(2)

        self.teardown_condition_mocks()

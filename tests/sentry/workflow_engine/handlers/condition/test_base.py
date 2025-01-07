from typing import Any

from sentry.rules.base import RuleBase
from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    translate_to_data_condition as dual_write_condition,
)
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class ConditionTestCase(BaseWorkflowTest):
    def setUp(self):
        self.group, self.event, self.group_event = self.create_group_event()

    @property
    def condition(self) -> Condition:
        raise NotImplementedError

    @property
    def rule_cls(self) -> type[RuleBase]:
        # for mapping purposes, can delete later
        raise NotImplementedError

    @property
    def payload(self) -> dict[str, Any]:
        # for dual write, can delete later
        raise NotImplementedError

    def translate_to_data_condition(
        self, data: dict[str, Any], dcg: DataConditionGroup
    ) -> DataCondition:
        return dual_write_condition(data, dcg)

    def assert_passes(self, data_condition: DataCondition, job: WorkflowJob) -> None:
        assert data_condition.evaluate_value(job) == data_condition.get_condition_result()

    def assert_does_not_pass(self, data_condition: DataCondition, job: WorkflowJob) -> None:
        assert data_condition.evaluate_value(job) != data_condition.get_condition_result()

    # TODO: activity

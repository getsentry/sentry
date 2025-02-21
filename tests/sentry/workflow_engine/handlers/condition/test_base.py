from datetime import timedelta
from typing import Any
from uuid import uuid4

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.testutils.cases import PerformanceIssueTestCase, RuleTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
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
    def payload(self) -> dict[str, Any]:
        # for dual write, can delete later
        raise NotImplementedError

    def translate_to_data_condition(
        self, data: dict[str, Any], dcg: DataConditionGroup
    ) -> DataCondition:
        data_condition = dual_write_condition(data, dcg)
        data_condition.save()
        return data_condition

    def assert_passes(self, data_condition: DataCondition, job: WorkflowJob) -> None:
        assert data_condition.evaluate_value(job) == data_condition.get_condition_result()

    def assert_does_not_pass(self, data_condition: DataCondition, job: WorkflowJob) -> None:
        assert data_condition.evaluate_value(job) != data_condition.get_condition_result()

    def assert_slow_condition_passes(self, data_condition: DataCondition, value: list[int]) -> None:
        assert data_condition.evaluate_value(value) == data_condition.get_condition_result()

    def assert_slow_condition_does_not_pass(
        self, data_condition: DataCondition, value: list[int]
    ) -> None:
        assert data_condition.evaluate_value(value) != data_condition.get_condition_result()

    # TODO: activity


class EventFrequencyQueryTestBase(SnubaTestCase, RuleTestCase, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()

        self.start = before_now(minutes=5)
        self.end = self.start + timedelta(minutes=5)

        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=30).isoformat(),
                "fingerprint": ["group-1"],
                "user": {"id": uuid4().hex},
                "tags": {"foo": "bar", "baz": "quux", "region": "US"},
            },
            project_id=self.project.id,
        )
        self.event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": self.environment.name,
                "timestamp": before_now(seconds=12).isoformat(),
                "fingerprint": ["group-2"],
                "user": {"id": uuid4().hex},
                "tags": {"foo": "bar", "baz": "biz", "region": "EU"},
            },
            project_id=self.project.id,
        )
        self.environment2 = self.create_environment(name="staging")
        self.event3 = self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": self.environment2.name,
                "timestamp": before_now(seconds=12).isoformat(),
                "fingerprint": ["group-3"],
                "user": {"id": uuid4().hex},
                "tags": {"foo": None, "biz": "baz", "region": "US"},
            },
            project_id=self.project.id,
        )

        fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-something_random"
        perf_event_data = load_data(
            "transaction-n-plus-one",
            timestamp=before_now(seconds=12),
            start_timestamp=before_now(seconds=13),
            fingerprint=[fingerprint],
        )
        perf_event_data["user"] = {"id": uuid4().hex}
        perf_event_data["environment"] = self.environment.name

        # Store a performance event
        self.perf_event = self.create_performance_issue(
            event_data=perf_event_data,
            project_id=self.project.id,
            fingerprint=fingerprint,
        )
        self.data = {"interval": "5m", "value": 30}

from datetime import timedelta

from sentry.rules.history.backends.postgres import PostgresRuleHistoryBackend
from sentry.rules.history.base import RuleGroupHistory
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import WorkflowFireHistory
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class BasePostgresRuleHistoryBackendTest(TestCase):
    def setUp(self) -> None:
        self.backend = PostgresRuleHistoryBackend()


@freeze_time()
class FetchRuleGroupsPaginatedTest(BasePostgresRuleHistoryBackendTest, BaseWorkflowTest):
    def run_test(self, workflow, start, end, expected, cursor=None, per_page=25):
        result = self.backend.fetch_rule_groups_paginated(workflow, start, end, cursor, per_page)
        assert result.results == expected, (result.results, expected)
        return result

    def _create_workflow(self):
        workflow_triggers = self.create_data_condition_group()
        return self.create_workflow(
            when_condition_group=workflow_triggers,
            organization=self.organization,
        )

    def test(self) -> None:
        workflow = self._create_workflow()
        for i in range(3):
            wfh = WorkflowFireHistory.objects.create(workflow=workflow, group=self.group)
            wfh.update(date_added=before_now(days=i + 1))
        group_2 = self.create_group()
        wfh = WorkflowFireHistory.objects.create(workflow=workflow, group=group_2)
        wfh.update(date_added=before_now(days=1))
        group_3 = self.create_group()
        for i in range(2):
            wfh = WorkflowFireHistory.objects.create(workflow=workflow, group=group_3)
            wfh.update(date_added=before_now(days=i + 1))
        workflow_2 = self._create_workflow()
        wfh = WorkflowFireHistory.objects.create(workflow=workflow_2, group=self.group)
        wfh.update(date_added=before_now(days=0))

        base_triggered_date = before_now(days=1)

        self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    self.group, count=3, last_triggered=base_triggered_date, event_id=""
                ),
                RuleGroupHistory(group_3, count=2, last_triggered=base_triggered_date, event_id=""),
                RuleGroupHistory(group_2, count=1, last_triggered=base_triggered_date, event_id=""),
            ],
        )
        result = self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    self.group, count=3, last_triggered=base_triggered_date, event_id=""
                ),
            ],
            per_page=1,
        )
        result = self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(group_3, count=2, last_triggered=base_triggered_date, event_id=""),
            ],
            cursor=result.next,
            per_page=1,
        )
        self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(group_2, count=1, last_triggered=base_triggered_date, event_id=""),
            ],
            cursor=result.next,
            per_page=1,
        )

        self.run_test(
            workflow,
            before_now(days=1),
            before_now(days=0),
            [
                RuleGroupHistory(
                    self.group, count=1, last_triggered=base_triggered_date, event_id=""
                ),
                RuleGroupHistory(group_2, count=1, last_triggered=base_triggered_date, event_id=""),
                RuleGroupHistory(group_3, count=1, last_triggered=base_triggered_date, event_id=""),
            ],
        )

        self.run_test(
            workflow,
            before_now(days=3),
            before_now(days=2),
            [
                RuleGroupHistory(
                    self.group,
                    count=1,
                    last_triggered=base_triggered_date - timedelta(days=2),
                    event_id="",
                ),
            ],
        )

    def test_event_id(self) -> None:
        workflow = self._create_workflow()
        for i in range(3):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow,
                group=self.group,
                event_id=str(i),
            )
            wfh.update(date_added=before_now(days=i + 1))

        base_triggered_date = before_now(days=1)
        self.run_test(
            workflow,
            before_now(days=3),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=self.group, count=3, last_triggered=base_triggered_date, event_id="0"
                )
            ],
        )

        group_2 = self.create_group()
        for i in range(3):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow,
                group=group_2,
                event_id=str(i + 3),
            )
            wfh.update(date_added=before_now(days=i + 4))
        self.run_test(
            workflow,
            before_now(days=5),
            before_now(days=2),
            [
                RuleGroupHistory(
                    group=group_2,
                    count=2,
                    last_triggered=base_triggered_date - timedelta(days=3),
                    event_id="3",
                ),
                RuleGroupHistory(
                    group=self.group,
                    count=1,
                    last_triggered=base_triggered_date - timedelta(days=2),
                    event_id="2",
                ),
            ],
        )


@freeze_time()
class FetchRuleHourlyStatsPaginatedTest(BasePostgresRuleHistoryBackendTest, BaseWorkflowTest):
    def _create_workflow(self):
        workflow_triggers = self.create_data_condition_group()
        return self.create_workflow(
            when_condition_group=workflow_triggers,
            organization=self.organization,
        )

    def test(self) -> None:
        workflow = self._create_workflow()
        workflow_2 = self._create_workflow()

        for i in range(3):
            for _ in range(i + 1):
                wfh = WorkflowFireHistory.objects.create(
                    workflow=workflow,
                    group=self.group,
                )
                wfh.update(date_added=before_now(hours=i + 1))

        for i in range(2):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow_2,
                group=self.group,
            )
            wfh.update(date_added=before_now(hours=i + 1))

        results = self.backend.fetch_rule_hourly_stats(workflow, before_now(hours=24), before_now())
        assert len(results) == 24
        assert [r.count for r in results[-5:]] == [0, 3, 2, 1, 0]

        results = self.backend.fetch_rule_hourly_stats(
            workflow_2, before_now(hours=24), before_now()
        )
        assert len(results) == 24
        assert [r.count for r in results[-5:]] == [0, 0, 1, 1, 0]

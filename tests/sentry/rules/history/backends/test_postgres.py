from datetime import timedelta

from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.history.backends.postgres import PostgresRuleHistoryBackend
from sentry.rules.history.base import RuleGroupHistory
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import AlertRuleWorkflow, WorkflowFireHistory
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class BasePostgresRuleHistoryBackendTest(TestCase):
    def setUp(self) -> None:
        self.backend = PostgresRuleHistoryBackend()


class RecordTest(BasePostgresRuleHistoryBackendTest):
    def test(self) -> None:
        rule = self.create_project_rule(project=self.event.project)
        self.backend.record(rule, self.group)
        assert RuleFireHistory.objects.filter(rule=rule, group=self.group).count() == 1
        self.backend.record(rule, self.group)
        assert RuleFireHistory.objects.filter(rule=rule, group=self.group).count() == 2
        group_2 = self.create_group()
        self.backend.record(rule, group_2)
        assert RuleFireHistory.objects.filter(rule=rule, group=self.group).count() == 2
        assert RuleFireHistory.objects.filter(rule=rule, group=group_2).count() == 1
        assert RuleFireHistory.objects.filter(rule=rule).count() == 3

    def test_returns_new_instance(self) -> None:
        rule = self.create_project_rule(project=self.event.project)
        new_instance = self.backend.record(rule, self.group)
        assert new_instance is not None


@freeze_time()
class FetchRuleGroupsPaginatedTest(BasePostgresRuleHistoryBackendTest, BaseWorkflowTest):
    def run_test(self, rule, start, end, expected, cursor=None, per_page=25):
        result = self.backend.fetch_rule_groups_paginated(rule, start, end, cursor, per_page)
        assert result.results == expected, (result.results, expected)
        return result

    def test(self) -> None:
        history = []
        rule = self.create_project_rule(project=self.event.project)
        for i in range(3):
            history.append(
                RuleFireHistory(
                    project=rule.project,
                    rule=rule,
                    group=self.group,
                    date_added=before_now(days=i + 1),
                )
            )
        group_2 = self.create_group()
        history.append(
            RuleFireHistory(
                project=rule.project, rule=rule, group=group_2, date_added=before_now(days=1)
            )
        )
        group_3 = self.create_group()
        for i in range(2):
            history.append(
                RuleFireHistory(
                    project=rule.project,
                    rule=rule,
                    group=group_3,
                    date_added=before_now(days=i + 1),
                )
            )
        rule_2 = self.create_project_rule(project=self.event.project)
        history.append(
            RuleFireHistory(
                project=rule.project, rule=rule_2, group=self.group, date_added=before_now(days=0)
            )
        )
        RuleFireHistory.objects.bulk_create(history)

        base_triggered_date = before_now(days=1)

        self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(self.group, count=3, last_triggered=base_triggered_date),
                RuleGroupHistory(group_3, count=2, last_triggered=base_triggered_date),
                RuleGroupHistory(group_2, count=1, last_triggered=base_triggered_date),
            ],
        )
        result = self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(self.group, count=3, last_triggered=base_triggered_date),
            ],
            per_page=1,
        )
        result = self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(group_3, count=2, last_triggered=base_triggered_date),
            ],
            cursor=result.next,
            per_page=1,
        )
        self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(group_2, count=1, last_triggered=base_triggered_date),
            ],
            cursor=result.next,
            per_page=1,
        )

        self.run_test(
            rule,
            before_now(days=1),
            before_now(days=0),
            [
                RuleGroupHistory(self.group, count=1, last_triggered=base_triggered_date),
                RuleGroupHistory(group_2, count=1, last_triggered=base_triggered_date),
                RuleGroupHistory(group_3, count=1, last_triggered=base_triggered_date),
            ],
        )

        self.run_test(
            rule,
            before_now(days=3),
            before_now(days=2),
            [
                RuleGroupHistory(
                    self.group, count=1, last_triggered=base_triggered_date - timedelta(days=2)
                ),
            ],
        )

    def test_event_id(self) -> None:
        rule = self.create_project_rule(project=self.event.project)
        for i in range(3):
            RuleFireHistory.objects.create(
                project=rule.project,
                rule=rule,
                group=self.group,
                date_added=before_now(days=i + 1),
                event_id=i,
            )

        base_triggered_date = before_now(days=1)
        self.run_test(
            rule,
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
            RuleFireHistory.objects.create(
                project=rule.project,
                rule=rule,
                group=group_2,
                date_added=before_now(days=i + 4),
                event_id=i + 3,
            )
        self.run_test(
            rule,
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

    @with_feature("organizations:workflow-engine-rule-serializers")
    def test_single_written_workflow_history(self) -> None:
        """Test using WorkflowFireHistory when feature flag is enabled"""
        workflow_triggers = self.create_data_condition_group()
        workflow = self.create_workflow(
            when_condition_group=workflow_triggers,
            organization=self.organization,
        )

        # Create some WorkflowFireHistory entries
        for i in range(2):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow,
                group=self.group,
                date_added=before_now(days=i + 3),
                event_id=f"workflow_event_{i}",
            )
            wfh.update(date_added=before_now(days=i + 3))

        group_2 = self.create_group()
        new_workflow_history = WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=group_2,
            date_added=before_now(days=2),
            event_id="workflow_event_group2",
        )
        new_workflow_history.update(date_added=before_now(days=2))

        self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=self.group,
                    count=2,
                    last_triggered=before_now(days=3),
                    event_id="workflow_event_0",
                ),
                RuleGroupHistory(
                    group=group_2,
                    count=1,
                    last_triggered=before_now(days=2),
                    event_id="workflow_event_group2",
                ),
            ],
        )

        # Test pagination
        result = self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=self.group,
                    count=2,
                    last_triggered=before_now(days=3),
                    event_id="workflow_event_0",
                ),
            ],
            per_page=1,
        )
        self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=group_2,
                    count=1,
                    last_triggered=before_now(days=2),
                    event_id="workflow_event_group2",
                ),
            ],
            per_page=1,
            cursor=result.next,
        )

    @with_feature("organizations:workflow-engine-rule-serializers")
    def test_combined_rule_and_workflow_history(self) -> None:
        """Test combining RuleFireHistory and WorkflowFireHistory when both exist"""
        rule = self.create_project_rule(project=self.event.project)
        workflow_triggers = self.create_data_condition_group()
        workflow = self.create_workflow(
            when_condition_group=workflow_triggers,
            organization=self.organization,
        )
        AlertRuleWorkflow.objects.create(rule_id=rule.id, workflow=workflow)

        # RuleFireHistory: self.group fired 2 days ago, group_2 fired 4 days ago
        rfh1 = RuleFireHistory.objects.create(
            project=rule.project,
            rule=rule,
            group=self.group,
            date_added=before_now(days=2),
            event_id="rule_event_group1",
        )
        rfh1.update(date_added=before_now(days=2))

        group_2 = self.create_group()
        rfh2 = RuleFireHistory.objects.create(
            project=rule.project,
            rule=rule,
            group=group_2,
            date_added=before_now(days=4),
            event_id="rule_event_group2",
        )
        rfh2.update(date_added=before_now(days=4))

        # WorkflowFireHistory: self.group fired 1 day ago (more recent), group_2 fired 3 days ago
        wfh1 = WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
            date_added=before_now(days=1),
            event_id="workflow_event_group1",
        )
        wfh1.update(date_added=before_now(days=1))

        wfh2 = WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=group_2,
            date_added=before_now(days=3),
            event_id="workflow_event_group2",
        )
        wfh2.update(date_added=before_now(days=3))

        # self.group: 2 total (1 rule + 1 workflow), last_triggered=1 day ago
        # group_2: 2 total (1 rule + 1 workflow), last_triggered=3 days ago
        self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=self.group,
                    count=2,
                    last_triggered=before_now(days=1),
                    event_id="workflow_event_group1",
                ),
                RuleGroupHistory(
                    group=group_2,
                    count=2,
                    last_triggered=before_now(days=3),
                    event_id="workflow_event_group2",
                ),
            ],
        )

        # Test pagination
        result = self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=self.group,
                    count=2,
                    last_triggered=before_now(days=1),
                    event_id="workflow_event_group1",
                ),
            ],
            per_page=1,
        )
        self.run_test(
            workflow,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=group_2,
                    count=2,
                    last_triggered=before_now(days=3),
                    event_id="workflow_event_group2",
                ),
            ],
            per_page=1,
            cursor=result.next,
        )


@freeze_time()
class FetchRuleHourlyStatsPaginatedTest(BasePostgresRuleHistoryBackendTest):
    def test(self) -> None:
        rule = self.create_project_rule(project=self.event.project)
        rule_2 = self.create_project_rule(project=self.event.project)
        history = []

        for i in range(3):
            for _ in range(i + 1):
                history.append(
                    RuleFireHistory(
                        project=rule.project,
                        rule=rule,
                        group=self.group,
                        date_added=before_now(hours=i + 1),
                    )
                )

        for i in range(2):
            history.append(
                RuleFireHistory(
                    project=rule_2.project,
                    rule=rule_2,
                    group=self.group,
                    date_added=before_now(hours=i + 1),
                )
            )

        RuleFireHistory.objects.bulk_create(history)

        results = self.backend.fetch_rule_hourly_stats(rule, before_now(hours=24), before_now())
        assert len(results) == 24
        assert [r.count for r in results[-5:]] == [0, 3, 2, 1, 0]

        results = self.backend.fetch_rule_hourly_stats(rule_2, before_now(hours=24), before_now())
        assert len(results) == 24
        assert [r.count for r in results[-5:]] == [0, 0, 1, 1, 0]

    @with_feature("organizations:workflow-engine-rule-serializers")
    def test_single_written_workflow_history(self) -> None:
        """Test using WorkflowFireHistory when feature flag is enabled"""
        workflow_triggers = self.create_data_condition_group()
        workflow = self.create_workflow(
            when_condition_group=workflow_triggers,
            organization=self.organization,
        )

        # Hour 1: 1 workflow fire entry
        wfh = WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
            date_added=before_now(hours=1),
        )
        wfh.update(date_added=before_now(hours=1))
        # Hour 3: 2 workflow fire entries
        for _ in range(2):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow,
                group=self.group,
                date_added=before_now(hours=3),
            )
            wfh.update(date_added=before_now(hours=3))

        results = self.backend.fetch_rule_hourly_stats(workflow, before_now(hours=24), before_now())
        assert len(results) == 24

        # Check the last 5 hours (from most recent to oldest)
        # Hour 0: 0 total
        # Hour 1: 1 (workflow)
        # Hour 2: 0 (workflow)
        # Hour 3: 2 (workflow)
        # Hour 4: 0 total
        assert [r.count for r in results[-5:]] == [0, 2, 0, 1, 0]

    @with_feature("organizations:workflow-engine-rule-serializers")
    def test_combined_rule_and_workflow_history(self) -> None:
        """Test combining RuleFireHistory and WorkflowFireHistory when both exist"""
        rule = self.create_project_rule(project=self.event.project)
        workflow_triggers = self.create_data_condition_group()
        workflow = self.create_workflow(
            when_condition_group=workflow_triggers,
            organization=self.organization,
        )
        AlertRuleWorkflow.objects.create(rule_id=rule.id, workflow=workflow)

        # RuleFireHistory: hour 2 has 1 entry, hour 4 has 2 entries
        rfh1 = RuleFireHistory.objects.create(
            project=rule.project,
            rule=rule,
            group=self.group,
            date_added=before_now(hours=2),
        )
        rfh1.update(date_added=before_now(hours=2))

        for _ in range(2):
            rfh = RuleFireHistory.objects.create(
                project=rule.project,
                rule=rule,
                group=self.group,
                date_added=before_now(hours=4),
            )
            rfh.update(date_added=before_now(hours=4))

        # WorkflowFireHistory: hour 1 has 1 entry, hour 3 has 2 entries
        wfh1 = WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
            date_added=before_now(hours=1),
        )
        wfh1.update(date_added=before_now(hours=1))

        for _ in range(2):
            wfh = WorkflowFireHistory.objects.create(
                workflow=workflow,
                group=self.group,
                date_added=before_now(hours=3),
            )
            wfh.update(date_added=before_now(hours=3))

        results = self.backend.fetch_rule_hourly_stats(workflow, before_now(hours=24), before_now())
        assert len(results) == 24

        # Check the last 5 hours (from oldest to most recent):
        # Hour 4: 2 (rule)
        # Hour 3: 2 (workflow)
        # Hour 2: 1 (rule)
        # Hour 1: 1 (workflow)
        # Hour 0: 0
        assert [r.count for r in results[-5:]] == [2, 2, 1, 1, 0]

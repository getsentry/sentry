from datetime import timedelta

from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.history.backends.postgres import PostgresRuleHistoryBackend
from sentry.rules.history.base import RuleGroupHistory
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import WorkflowFireHistory

pytestmark = [requires_snuba]


class BasePostgresRuleHistoryBackendTest(TestCase):
    def setUp(self):
        self.backend = PostgresRuleHistoryBackend()


class RecordTest(BasePostgresRuleHistoryBackendTest):
    def test(self):
        rule = Rule.objects.create(project=self.event.project)
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
        rule = Rule.objects.create(project=self.event.project)
        new_instance = self.backend.record(rule, self.group)
        assert new_instance is not None


@freeze_time()
class FetchRuleGroupsPaginatedTest(BasePostgresRuleHistoryBackendTest):
    def run_test(self, rule, start, end, expected, cursor=None, per_page=25):
        result = self.backend.fetch_rule_groups_paginated(rule, start, end, cursor, per_page)
        assert result.results == expected, (result.results, expected)
        return result

    def test(self):
        history = []
        rule = Rule.objects.create(project=self.event.project)
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
        rule_2 = Rule.objects.create(project=self.event.project)
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

    def test_event_id(self):
        rule = Rule.objects.create(project=self.event.project)
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

    @with_feature("organizations:workflow-engine-single-process-workflows")
    def test_combined_rule_and_workflow_history(self):
        """Test combining RuleFireHistory and WorkflowFireHistory when feature flag is enabled"""
        rule = self.create_project_rule(project=self.event.project)
        workflow = self.create_workflow(organization=self.event.project.organization)

        # Create AlertRuleWorkflow association
        from sentry.workflow_engine.models import AlertRuleWorkflow

        AlertRuleWorkflow.objects.create(rule_id=rule.id, workflow=workflow)

        # Create some RuleFireHistory entries
        rule_history = []
        for i in range(2):
            rule_history.append(
                RuleFireHistory(
                    project=rule.project,
                    rule=rule,
                    group=self.group,
                    date_added=before_now(days=i + 1),
                    event_id=f"rule_event_{i}",
                )
            )

        # Create some WorkflowFireHistory entries with is_single_written=True
        workflow_history = []
        for i in range(2):
            workflow_history.append(
                WorkflowFireHistory(
                    workflow=workflow,
                    group=self.group,
                    date_added=before_now(days=i + 3),
                    event_id=f"workflow_event_{i}",
                    is_single_written=True,
                )
            )

        # Create some WorkflowFireHistory entries with is_single_written=False (should be ignored)
        for i in range(2):
            workflow_history.append(
                WorkflowFireHistory(
                    workflow=workflow,
                    group=self.group,
                    date_added=before_now(days=i + 5),
                    event_id=f"workflow_event_ignored_{i}",
                    is_single_written=False,
                )
            )

        RuleFireHistory.objects.bulk_create(rule_history)
        workflow_fire_histories = WorkflowFireHistory.objects.bulk_create(workflow_history)

        # Manually update date_added for workflow fire histories since bulk_create doesn't set it
        for i, wfh in enumerate(workflow_fire_histories):
            if i < 2:  # First two are is_single_written=True
                wfh.date_added = before_now(days=i + 3)
            else:  # Last two are is_single_written=False
                wfh.date_added = before_now(days=(i - 2) + 5)
            wfh.save(update_fields=["date_added"])

        group_2 = self.create_group()
        RuleFireHistory.objects.create(
            project=rule.project,
            rule=rule,
            group=group_2,
            date_added=before_now(days=3),
            event_id="rule_event_group2",
        )
        new_workflow_history = WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=group_2,
            date_added=before_now(days=2),
            event_id="workflow_event_group2",
            is_single_written=True,
        )

        # Manually update date_added
        new_workflow_history.update(date_added=before_now(days=2))

        self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=self.group,
                    count=4,  # 4 from the original data
                    last_triggered=before_now(days=1),  # Most recent from RuleFireHistory
                    event_id="rule_event_0",
                ),
                RuleGroupHistory(
                    group=group_2,
                    count=2,  # 2 from both RuleFireHistory and WorkflowFireHistory
                    last_triggered=before_now(days=2),
                    event_id="workflow_event_group2",
                ),
            ],
        )

        result = self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=self.group,
                    count=4,  # 4 from the original data
                    last_triggered=before_now(days=1),  # Most recent from RuleFireHistory
                    event_id="rule_event_0",
                ),
            ],
            per_page=1,
        )
        self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(
                    group=group_2,
                    count=2,  # 2 from both RuleFireHistory and WorkflowFireHistory
                    last_triggered=before_now(days=2),
                    event_id="workflow_event_group2",
                ),
            ],
            per_page=1,
            cursor=result.next,
        )


@freeze_time()
class FetchRuleHourlyStatsPaginatedTest(BasePostgresRuleHistoryBackendTest):
    def test(self):
        rule = Rule.objects.create(project=self.event.project)
        rule_2 = Rule.objects.create(project=self.event.project)
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

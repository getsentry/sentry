from freezegun import freeze_time

from sentry.models import Rule, RuleFireHistory
from sentry.rules.history.backends.postgres import PostgresRuleHistoryBackend
from sentry.rules.history.base import RuleGroupHistory
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now


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

        self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(self.group, count=3),
                RuleGroupHistory(group_3, count=2),
                RuleGroupHistory(group_2, count=1),
            ],
        )
        result = self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(self.group, count=3),
            ],
            per_page=1,
        )
        result = self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(group_3, count=2),
            ],
            cursor=result.next,
            per_page=1,
        )
        self.run_test(
            rule,
            before_now(days=6),
            before_now(days=0),
            [
                RuleGroupHistory(group_2, count=1),
            ],
            cursor=result.next,
            per_page=1,
        )

        self.run_test(
            rule,
            before_now(days=1),
            before_now(days=0),
            [
                RuleGroupHistory(self.group, count=1),
                RuleGroupHistory(group_2, count=1),
                RuleGroupHistory(group_3, count=1),
            ],
        )

        self.run_test(
            rule,
            before_now(days=3),
            before_now(days=2),
            [
                RuleGroupHistory(self.group, count=1),
            ],
        )

from sentry.models import Rule, RuleFireHistory
from sentry.rules.history.backends.postgres import PostgresRuleHistoryBackend
from sentry.testutils import TestCase


class RecordPostgresRuleHistoryBackendTest(TestCase):
    def setUp(self):
        self.backend = PostgresRuleHistoryBackend()

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

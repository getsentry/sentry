from sentry.models import Rule, RuleSnooze
from sentry.testutils import APITestCase


class RuleSnoozeTest(APITestCase):
    def test_constraints(self):
        metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=self.team.actor
        )

        metric_alert_rule_snooze_user = RuleSnooze.objects.create(
            user_id=self.user.id, alert_rule=metric_alert_rule
        )
        issue_alert_rule_snooze_user = RuleSnooze.objects.create(
            user_id=self.user.id, rule=issue_alert_rule
        )

        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze_user.id).exists()
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user.id).exists()

        # ensure the rule can be globally ignored after it's been individually ignored
        metric_alert_rule_snooze_all = RuleSnooze.objects.create(alert_rule=metric_alert_rule)
        issue_alert_rule_snooze_all = RuleSnooze.objects.create(rule=issue_alert_rule)

        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze_all.id).exists()
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_all.id).exists()

        # ensure another user can ignore the same issue alert
        user2 = self.create_user()
        issue_alert_rule_snooze_user2 = RuleSnooze.objects.create(
            user_id=user2.id, rule=issue_alert_rule
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user2.id).exists()

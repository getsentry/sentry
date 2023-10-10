from datetime import datetime, timedelta, timezone

from sentry.models.rule import Rule
from sentry.models.rulesnooze import RuleSnooze
from sentry.tasks.clear_expired_rulesnoozes import clear_expired_rulesnoozes
from sentry.testutils.cases import APITestCase


class ClearExpiredRuleSnoozesTest(APITestCase):
    def setUp(self):
        self.issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=self.team.actor
        )
        self.metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        self.until = datetime.now(timezone.utc) - timedelta(minutes=1)
        self.login_as(user=self.user)

    def test_task_persistent_name(self):
        assert clear_expired_rulesnoozes.name == "sentry.tasks.clear_expired_rulesnoozes"

    def test_simple(self):
        """Test that expired rulesnoozes are deleted, and ones that still have time left are left alone"""
        issue_alert_rule_snooze = self.snooze_rule(
            user_id=self.user.id,
            rule=self.issue_alert_rule,
            owner_id=self.user.id,
            until=self.until,
            date_added=datetime.now(timezone.utc),
        )
        issue_alert_rule_snooze2 = self.snooze_rule(
            rule=self.issue_alert_rule,
            owner_id=self.user.id,
            until=datetime.now(timezone.utc) + timedelta(minutes=1),
            date_added=datetime.now(timezone.utc),
        )
        metric_alert_rule_snooze = self.snooze_rule(
            user_id=self.user.id,
            alert_rule=self.metric_alert_rule,
            owner_id=self.user.id,
            until=self.until,
            date_added=datetime.now(timezone.utc),
        )
        metric_alert_rule_snooze2 = self.snooze_rule(
            alert_rule=self.metric_alert_rule,
            owner_id=self.user.id,
            until=datetime.now(timezone.utc) + timedelta(minutes=1),
            date_added=datetime.now(timezone.utc),
        )

        clear_expired_rulesnoozes()

        assert not RuleSnooze.objects.filter(id=issue_alert_rule_snooze.id).exists()
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze2.id).exists()
        assert not RuleSnooze.objects.filter(id=metric_alert_rule_snooze.id).exists()
        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze2.id).exists()

    def test_snooze_forever(self):
        """Test that if an issue alert rule is snoozed forever, the task doesn't remove it."""
        issue_alert_rule_snooze = self.snooze_rule(
            user_id=self.user.id,
            rule=self.issue_alert_rule,
            owner_id=self.user.id,
            date_added=datetime.now(timezone.utc),
        )
        metric_alert_rule_snooze = self.snooze_rule(
            user_id=self.user.id,
            alert_rule=self.metric_alert_rule,
            owner_id=self.user.id,
            date_added=datetime.now(timezone.utc),
        )

        clear_expired_rulesnoozes()

        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze.id).exists()
        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze.id).exists()

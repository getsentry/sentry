from datetime import datetime, timedelta

import pytest
from django.db import IntegrityError, transaction

from sentry.models import Rule, RuleSnooze
from sentry.testutils import APITestCase


class RuleSnoozeTest(APITestCase):
    def setUp(self):
        self.issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=self.team.actor
        )
        self.metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        self.user2 = self.create_user()

    def test_snooze_user_and_global(self):
        """Test that a rule can be snoozed by a user and globally"""
        issue_alert_rule_snooze_user = RuleSnooze.objects.create(
            user_id=self.user.id,
            owner_id=self.user.id,
            rule=self.issue_alert_rule,
            until=datetime.now() + timedelta(days=10),
        )
        issue_alert_rule_snooze_all = RuleSnooze.objects.create(
            owner_id=self.user2.id,
            rule=self.issue_alert_rule,
            until=datetime.now() + timedelta(days=1),
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user.id).exists()
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_all.id).exists()

    def test_issue_alert_until_and_forever(self):
        issue_alert_rule_snooze_user_until = RuleSnooze.objects.create(
            user_id=self.user.id,
            owner_id=self.user.id,
            rule=self.issue_alert_rule,
            until=datetime.now() + timedelta(days=1),
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user_until.id).exists()

        issue_alert_rule2 = Rule.objects.create(
            label="test rule", project=self.project, owner=self.team.actor
        )
        issue_alert_rule_snooze_user_forever = RuleSnooze.objects.create(
            user_id=self.user.id, owner_id=self.user.id, rule=issue_alert_rule2
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user_forever.id).exists()

    def test_metric_alert_until_and_forever(self):
        metric_alert_rule_snooze_user = RuleSnooze.objects.create(
            user_id=self.user.id,
            owner_id=self.user.id,
            alert_rule=self.metric_alert_rule,
            until=datetime.now() + timedelta(days=1),
        )
        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze_user.id).exists()

        metric_alert_rule2 = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        metric_alert_rule_snooze_user = RuleSnooze.objects.create(
            user_id=self.user.id, owner_id=self.user.id, alert_rule=metric_alert_rule2
        )
        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze_user.id).exists()

    def test_constraints(self):
        # ensure the rule can be globally ignored after it's been individually ignored
        metric_alert_rule_snooze_all = RuleSnooze.objects.create(alert_rule=self.metric_alert_rule)
        issue_alert_rule_snooze_all = RuleSnooze.objects.create(rule=self.issue_alert_rule)

        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze_all.id).exists()
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_all.id).exists()

        # ensure another user can ignore the same issue alert
        issue_alert_rule_snooze_user2 = RuleSnooze.objects.create(
            user_id=self.user2.id, rule=self.issue_alert_rule
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user2.id).exists()

    def test_errors(self):
        # ensure no dupes
        RuleSnooze.objects.create(owner_id=self.user.id, alert_rule=self.metric_alert_rule)
        with pytest.raises(IntegrityError), transaction.atomic():
            RuleSnooze.objects.create(alert_rule=self.metric_alert_rule)

        RuleSnooze.objects.create(owner_id=self.user.id, rule=self.issue_alert_rule)
        with pytest.raises(IntegrityError), transaction.atomic():
            RuleSnooze.objects.create(rule=self.issue_alert_rule)

        # ensure valid data
        with pytest.raises(IntegrityError), transaction.atomic():
            RuleSnooze.objects.create(
                owner_id=self.user.id, rule=self.issue_alert_rule, alert_rule=self.metric_alert_rule
            )

        with pytest.raises(IntegrityError), transaction.atomic():
            RuleSnooze.objects.create(
                user_id=self.user.id,
                owner_id=self.user.id,
            )

        with pytest.raises(IntegrityError), transaction.atomic():
            RuleSnooze.objects.create(
                owner_id=self.user.id, until=datetime.now() + timedelta(days=1)
            )

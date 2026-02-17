from datetime import UTC, datetime, timedelta

import pytest
from django.db import IntegrityError, router, transaction

from sentry.models.rulesnooze import RuleSnooze
from sentry.testutils.cases import APITestCase, TestCase


class RuleSnoozeTest(APITestCase):
    def setUp(self) -> None:
        self.issue_alert_rule = self.create_project_rule(name="test rule", owner_team=self.team)
        self.metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        self.user2 = self.create_user()

    def test_snooze_user_and_global(self) -> None:
        """Test that a rule can be snoozed by a user and globally"""
        issue_alert_rule_snooze_user = self.snooze_rule(
            user_id=self.user.id,
            owner_id=self.user.id,
            rule=self.issue_alert_rule,
            until=datetime.now(UTC) + timedelta(days=10),
        )
        issue_alert_rule_snooze_all = self.snooze_rule(
            owner_id=self.user2.id,
            rule=self.issue_alert_rule,
            until=datetime.now(UTC) + timedelta(days=1),
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user.id).exists()
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_all.id).exists()

    def test_issue_alert_until_and_forever(self) -> None:
        issue_alert_rule_snooze_user_until = self.snooze_rule(
            user_id=self.user.id,
            owner_id=self.user.id,
            rule=self.issue_alert_rule,
            until=datetime.now(UTC) + timedelta(days=1),
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user_until.id).exists()

        issue_alert_rule2 = self.create_project_rule(name="test rule", owner_team=self.team)
        issue_alert_rule_snooze_user_forever = self.snooze_rule(
            user_id=self.user.id, owner_id=self.user.id, rule=issue_alert_rule2
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user_forever.id).exists()

    def test_metric_alert_until_and_forever(self) -> None:
        metric_alert_rule_snooze_user = self.snooze_rule(
            user_id=self.user.id,
            owner_id=self.user.id,
            alert_rule=self.metric_alert_rule,
            until=datetime.now(UTC) + timedelta(days=1),
        )
        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze_user.id).exists()

        metric_alert_rule2 = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        metric_alert_rule_snooze_user = self.snooze_rule(
            user_id=self.user.id, owner_id=self.user.id, alert_rule=metric_alert_rule2
        )
        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze_user.id).exists()

    def test_constraints(self) -> None:
        # ensure the rule can be globally ignored after it's been individually ignored
        metric_alert_rule_snooze_all = self.snooze_rule(alert_rule=self.metric_alert_rule)
        issue_alert_rule_snooze_all = self.snooze_rule(rule=self.issue_alert_rule)

        assert RuleSnooze.objects.filter(id=metric_alert_rule_snooze_all.id).exists()
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_all.id).exists()

        # ensure another user can ignore the same issue alert
        issue_alert_rule_snooze_user2 = self.snooze_rule(
            user_id=self.user2.id, rule=self.issue_alert_rule
        )
        assert RuleSnooze.objects.filter(id=issue_alert_rule_snooze_user2.id).exists()

    def test_errors(self) -> None:
        # ensure no dupes
        self.snooze_rule(owner_id=self.user.id, alert_rule=self.metric_alert_rule)
        with pytest.raises(IntegrityError), transaction.atomic(router.db_for_write(RuleSnooze)):
            self.snooze_rule(alert_rule=self.metric_alert_rule)

        self.snooze_rule(owner_id=self.user.id, rule=self.issue_alert_rule)
        with pytest.raises(IntegrityError), transaction.atomic(router.db_for_write(RuleSnooze)):
            self.snooze_rule(rule=self.issue_alert_rule)

        # ensure valid data
        with pytest.raises(IntegrityError), transaction.atomic(router.db_for_write(RuleSnooze)):
            self.snooze_rule(
                owner_id=self.user.id, rule=self.issue_alert_rule, alert_rule=self.metric_alert_rule
            )

        with pytest.raises(IntegrityError), transaction.atomic(router.db_for_write(RuleSnooze)):
            self.snooze_rule(
                user_id=self.user.id,
                owner_id=self.user.id,
            )

        with pytest.raises(IntegrityError), transaction.atomic(router.db_for_write(RuleSnooze)):
            self.snooze_rule(owner_id=self.user.id, until=datetime.now(UTC) + timedelta(days=1))


class GetSnoozedForAllDetectorIdsTest(TestCase):
    def test_returns_snoozed_detector_ids(self):
        alert_rule = self.create_alert_rule(organization=self.organization, projects=[self.project])
        detector = self.create_detector(project=self.project)
        self.create_alert_rule_detector(alert_rule_id=alert_rule.id, detector=detector)
        self.snooze_rule(alert_rule=alert_rule)

        result = RuleSnooze.objects.get_snoozed_for_all_detector_ids({detector.id})
        assert result == {detector.id}

    def test_excludes_user_specific_snooze(self):
        alert_rule = self.create_alert_rule(organization=self.organization, projects=[self.project])
        detector = self.create_detector(project=self.project)
        self.create_alert_rule_detector(alert_rule_id=alert_rule.id, detector=detector)
        self.snooze_rule(user_id=self.user.id, alert_rule=alert_rule)

        result = RuleSnooze.objects.get_snoozed_for_all_detector_ids({detector.id})
        assert result == set()

    def test_excludes_unsnoozed_detector(self):
        alert_rule = self.create_alert_rule(organization=self.organization, projects=[self.project])
        detector = self.create_detector(project=self.project)
        self.create_alert_rule_detector(alert_rule_id=alert_rule.id, detector=detector)

        result = RuleSnooze.objects.get_snoozed_for_all_detector_ids({detector.id})
        assert result == set()

    def test_empty_input(self):
        result = RuleSnooze.objects.get_snoozed_for_all_detector_ids(set())
        assert result == set()

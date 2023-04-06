from datetime import datetime, timedelta

import pytz

from sentry import audit_log
from sentry.models import AuditLogEntry, Rule, RuleSnooze
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class RuleSnoozeTest(APITestCase):
    endpoint = "sentry-api-0-rule-snooze"
    method = "post"

    def setUp(self):
        self.issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=self.team.actor
        )
        self.metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        self.until = datetime.now(pytz.UTC) + timedelta(days=10)
        self.login_as(user=self.user)

    def test_mute_issue_alert_user_forever(self):
        """Test that a user can mute an issue alert rule for themselves forever"""
        data = {"userId": self.user.id, "rule": True}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == self.user.id
        assert response.data["ruleId"] == self.issue_alert_rule.id
        assert response.data["alertRuleId"] is None
        assert response.data["until"] == "forever"

    def test_mute_issue_alert_user_until(self):
        """Test that a user can mute an issue alert rule for themselves a period of time"""
        data = {"userId": self.user.id, "rule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == self.user.id
        assert response.data["ruleId"] == self.issue_alert_rule.id
        assert response.data["alertRuleId"] is None
        assert response.data["until"] == self.until

    def test_mute_issue_alert_everyone_forever(self):
        """Test that an issue alert rule can be ignored for everyone forever"""
        data = {"rule": True}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == "everyone"
        assert response.data["ruleId"] == self.issue_alert_rule.id
        assert response.data["alertRuleId"] is None
        assert response.data["until"] == "forever"
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("RULE_SNOOZE"),
            organization_id=self.organization.id,
            actor=self.user,
            target_object=self.issue_alert_rule.id,
        )

    def test_mute_issue_alert_everyone_until(self):
        """Test that an issue alert rule can be ignored for everyone for a period of time"""
        data = {"rule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == "everyone"
        assert response.data["ruleId"] == self.issue_alert_rule.id
        assert response.data["alertRuleId"] is None
        assert response.data["until"] == self.until
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("RULE_SNOOZE"),
            organization_id=self.organization.id,
            actor=self.user,
            target_object=self.issue_alert_rule.id,
        )

    def test_mute_issue_alert_user_then_everyone(self):
        """Test that a user can mute an issue alert for themselves and then the same alert can be muted for everyone"""
        data = {"userId": self.user.id, "rule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 200

        everyone_until = datetime.now(pytz.UTC) + timedelta(days=1)
        data = {"rule": True, "until": everyone_until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 200

    def test_mute_issue_alert_everyone_then_user(self):
        """Test that an issue alert can be muted for everyone and then a user can mute the same alert for themselves"""
        everyone_until = datetime.now(pytz.UTC) + timedelta(days=1)
        data = {"rule": True, "until": everyone_until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 200

        data = {"userId": self.user.id, "rule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 200

    def test_edit_issue_alert_mute(self):
        """Test that we throw an error if a rule has already been muted by a user"""
        data = {"userId": self.user.id, "rule": True}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 200

        data = {"userId": self.user.id, "rule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert len(RuleSnooze.objects.all()) == 1
        assert response.status_code == 409
        assert "RuleSnooze already exists for this rule and scope." in response.data["detail"]

    def test_mute_metric_alert_user_forever(self):
        """Test that a user can mute a metric alert rule for themselves forever"""
        data = {"userId": self.user.id, "alertRule": True}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == self.user.id
        assert response.data["ruleId"] is None
        assert response.data["alertRuleId"] == self.metric_alert_rule.id
        assert response.data["until"] == "forever"

    def test_mute_metric_alert_user_until(self):
        """Test that a user can mute a metric alert rule for themselves a period of time"""
        data = {"userId": self.user.id, "alertRule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == self.user.id
        assert response.data["ruleId"] is None
        assert response.data["alertRuleId"] == self.metric_alert_rule.id
        assert response.data["until"] == self.until

    def test_mute_metric_alert_everyone_forever(self):
        """Test that a metric alert rule can be ignored for everyone forever"""
        data = {"alertRule": True}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == "everyone"
        assert response.data["ruleId"] is None
        assert response.data["alertRuleId"] == self.metric_alert_rule.id
        assert response.data["until"] == "forever"
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("ALERT_RULE_SNOOZE"),
            organization_id=self.organization.id,
            actor=self.user,
            target_object=self.metric_alert_rule.id,
        )

    def test_mute_metric_alert_everyone_until(self):
        """Test that a metric alert rule can be ignored for everyone for a period of time"""
        data = {"alertRule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == "everyone"
        assert response.data["ruleId"] is None
        assert response.data["alertRuleId"] == self.metric_alert_rule.id
        assert response.data["until"] == self.until
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("ALERT_RULE_SNOOZE"),
            organization_id=self.organization.id,
            actor=self.user,
            target_object=self.metric_alert_rule.id,
        )

    def test_mute_metric_alert_user_then_everyone(self):
        """Test that a user can mute a metric alert for themselves and then the same alert can be muted for everyone"""
        data = {"userId": self.user.id, "alertRule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 200

        everyone_until = datetime.now(pytz.UTC) + timedelta(days=1)
        data = {"alertRule": True, "until": everyone_until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 200

    def test_mute_metric_alert_everyone_then_user(self):
        """Test that a metric alert can be muted for everyone and then a user can mute the same alert for themselves"""
        everyone_until = datetime.now(pytz.UTC) + timedelta(days=1)
        data = {"alertRule": True, "until": everyone_until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 200

        data = {"userId": self.user.id, "alertRule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 200

    def test_edit_metric_alert_mute(self):
        """Test that we throw an error if a metric alert rule has already been muted by a user"""
        data = {"userId": self.user.id, "alertRule": True}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 200

        data = {"userId": self.user.id, "alertRule": True, "until": self.until}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert len(RuleSnooze.objects.all()) == 1
        assert response.status_code == 409
        assert "RuleSnooze already exists for this rule and scope." in response.data["detail"]

    def test_no_issue_alert(self):
        """Test that we throw an error when an issue alert rule doesn't exist"""
        data = {"userId": self.user.id, "rule": True}
        response = self.get_response(self.organization.slug, self.project.slug, 777, **data)
        assert not RuleSnooze.objects.filter(alert_rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Rule does not exist" in response.data

    def test_no_metric_alert(self):
        """Test that we throw an error when a metric alert rule doesn't exist"""
        data = {"userId": self.user.id, "alertRule": True}
        response = self.get_response(self.organization.slug, self.project.slug, 777, **data)
        assert not RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Rule does not exist" in response.data

    def test_invalid_data_issue_alert(self):
        """Test that we throw an error when passed invalid data"""
        data = {"userId": self.user.id, "rule": self.issue_alert_rule.id}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
        )
        assert not RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Must be a valid boolean" in response.data["rule"][0]

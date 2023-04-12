from datetime import datetime, timedelta

import pytz

from sentry import audit_log
from sentry.models import AuditLogEntry, Rule, RuleSnooze
from sentry.models.actor import ActorTuple
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
        data = {"target": "me", "rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 201
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == self.user.id
        assert response.data["ruleId"] == self.issue_alert_rule.id
        assert response.data["alertRuleId"] is None
        assert response.data["until"] == "forever"

    def test_mute_issue_alert_user_until(self):
        """Test that a user can mute an issue alert rule for themselves a period of time"""
        data = {"target": "me", "rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 201
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == self.user.id
        assert response.data["ruleId"] == self.issue_alert_rule.id
        assert response.data["alertRuleId"] is None
        assert response.data["until"] == self.until

    def test_mute_issue_alert_everyone_forever(self):
        """Test that an issue alert rule can be muted for everyone forever"""
        data = {"target": "everyone", "rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 201
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
        """Test that an issue alert rule can be muted for everyone for a period of time"""
        data = {"target": "everyone", "rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 201
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
        data = {"target": "me", "rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 201

        everyone_until = datetime.now(pytz.UTC) + timedelta(days=1)
        data = {"target": "everyone", "rule": True, "until": everyone_until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 201

    def test_mute_issue_alert_everyone_then_user(self):
        """Test that an issue alert can be muted for everyone and then a user can mute the same alert for themselves"""
        everyone_until = datetime.now(pytz.UTC) + timedelta(days=1)
        data = {"target": "everyone", "rule": True, "until": everyone_until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 201

        data = {"target": "me", "rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 201

    def test_edit_issue_alert_mute(self):
        """Test that we throw an error if an issue alert rule has already been muted by a user"""
        data = {"target": "me", "rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 201

        data = {"target": "me", "rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
            )
        assert len(RuleSnooze.objects.all()) == 1
        assert response.status_code == 410
        assert "RuleSnooze already exists for this rule and scope." in response.data["detail"]

    def test_user_cant_mute_issue_alert_for_everyone(self):
        """Test that if a user doesn't belong to the team that can edit an issue alert rule, we throw an error when they try to mute it for everyone."""
        other_team = self.create_team()
        other_issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=other_team.actor
        )
        data = {"target": "everyone", "rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, other_issue_alert_rule.id, **data
            )
        assert not RuleSnooze.objects.filter(rule=other_issue_alert_rule.id).exists()
        assert response.status_code == 401
        assert "Requesting user cannot mute this rule" in response.data["detail"]

    def test_user_can_mute_issue_alert_for_self(self):
        """Test that if a user doesn't belong to the team that can edit an issue alert rule, they can still mute it for just themselves."""
        other_team = self.create_team()
        other_issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=other_team.actor
        )
        data = {"target": "me", "rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, other_issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(rule=other_issue_alert_rule.id).exists()
        assert response.status_code == 201

    def test_user_can_mute_unassigned_issue_alert(self):
        """Test that if an issue alert rule's owner is unassigned, the user can mute it."""
        other_issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=None
        )
        data = {"target": "me", "rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, other_issue_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(rule=other_issue_alert_rule.id).exists()
        assert response.status_code == 201

    def test_mute_metric_alert_user_forever(self):
        """Test that a user can mute a metric alert rule for themselves forever"""
        data = {"target": "me", "alert_rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 201
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == self.user.id
        assert response.data["ruleId"] is None
        assert response.data["alertRuleId"] == self.metric_alert_rule.id
        assert response.data["until"] == "forever"

    def test_mute_metric_alert_user_until(self):
        """Test that a user can mute a metric alert rule for themselves a period of time"""
        data = {"target": "me", "alert_rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 201
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == self.user.id
        assert response.data["ruleId"] is None
        assert response.data["alertRuleId"] == self.metric_alert_rule.id
        assert response.data["until"] == self.until

    def test_mute_metric_alert_everyone_forever(self):
        """Test that a metric alert rule can be muted for everyone forever"""
        data = {"target": "everyone", "alert_rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 201
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
        """Test that a metric alert rule can be muted for everyone for a period of time"""
        data = {"target": "everyone", "alert_rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 201
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
        data = {"target": "me", "alert_rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 201

        everyone_until = datetime.now(pytz.UTC) + timedelta(days=1)
        data = {"target": "everyone", "alert_rule": True, "until": everyone_until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 201

    def test_mute_metric_alert_everyone_then_user(self):
        """Test that a metric alert can be muted for everyone and then a user can mute the same alert for themselves"""
        everyone_until = datetime.now(pytz.UTC) + timedelta(days=1)
        data = {"target": "everyone", "alert_rule": True, "until": everyone_until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 201

        data = {"target": "me", "alert_rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 201

    def test_edit_metric_alert_mute(self):
        """Test that we throw an error if a metric alert rule has already been muted by a user"""
        data = {"target": "me", "alert_rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 201

        data = {"target": "me", "alert_rule": True, "until": self.until}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert len(RuleSnooze.objects.all()) == 1
        assert response.status_code == 410
        assert "RuleSnooze already exists for this rule and scope." in response.data["detail"]

    def test_user_cant_snooze_metric_alert_for_everyone(self):
        """Test that if a user doesn't belong to the team that can edit a metric alert rule, we throw an error when they try to mute it for everyone"""
        other_team = self.create_team()
        other_metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization,
            projects=[self.project],
            owner=ActorTuple.from_actor_identifier(f"team:{other_team.id}"),
        )
        data = {"target": "everyone", "alertRule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, other_metric_alert_rule.id, **data
            )
        assert not RuleSnooze.objects.filter(alert_rule=other_metric_alert_rule).exists()
        assert response.status_code == 401
        assert "Requesting user cannot mute this rule" in response.data["detail"]

    def test_user_can_snooze_metric_alert_for_self(self):
        """Test that if a user doesn't belong to the team that can edit a metric alert rule, they are able to mute it for just themselves."""
        other_team = self.create_team()
        other_metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization,
            projects=[self.project],
            owner=ActorTuple.from_actor_identifier(f"team:{other_team.id}"),
        )
        data = {"target": "me", "alertRule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, other_metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(alert_rule=other_metric_alert_rule).exists()
        assert response.status_code == 201

    def test_user_can_mute_unassigned_metric_alert(self):
        """Test that if a metric alert rule's owner is unassigned, the user can mute it."""
        other_metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project], owner=None
        )
        data = {"target": "me", "alertRule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, other_metric_alert_rule.id, **data
            )
        assert RuleSnooze.objects.filter(alert_rule=other_metric_alert_rule.id).exists()
        assert response.status_code == 201

    def test_no_issue_alert(self):
        """Test that we throw an error when an issue alert rule doesn't exist"""
        data = {"target": "me", "rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(self.organization.slug, self.project.slug, 777, **data)
        assert not RuleSnooze.objects.filter(alert_rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Rule does not exist" in response.data

    def test_no_metric_alert(self):
        """Test that we throw an error when a metric alert rule doesn't exist"""
        data = {"target": "me", "alert_rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(self.organization.slug, self.project.slug, 777, **data)
        assert not RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Rule does not exist" in response.data

    def test_invalid_data_issue_alert(self):
        """Test that we throw an error when passed invalid data"""
        data = {"target": "me", "rule": self.issue_alert_rule.id}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert not RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Must be a valid boolean" in response.data["rule"][0]

    def test_rule_and_alert_rule(self):
        """Test that we throw an error if both rule and alert rule are passed"""
        data = {"target": "me", "rule": True, "alert_rule": True}
        with self.feature({"organizations:mute-alerts": True}):
            response = self.get_response(
                self.organization.slug, self.project.slug, self.metric_alert_rule.id, **data
            )
        assert not RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Pass either rule or alert rule, not both." in response.data

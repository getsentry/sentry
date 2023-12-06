from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sentry import audit_log
from sentry.models.actor import ActorTuple
from sentry.models.rule import Rule
from sentry.models.rulesnooze import RuleSnooze
from sentry.services.hybrid_cloud.log.service import log_rpc_service
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test


class BaseRuleSnoozeTest(APITestCase):
    def setUp(self):
        self.issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=self.team.actor
        )
        self.metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        self.until = datetime.now(timezone.utc) + timedelta(days=10)
        self.login_as(user=self.user)


@region_silo_test
class PostRuleSnoozeTest(BaseRuleSnoozeTest):
    endpoint = "sentry-api-0-rule-snooze"
    method = "post"

    def test_mute_issue_alert_user_forever(self):
        """Test that a user can mute an issue alert rule for themselves forever"""
        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
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
        data = {"target": "me", "until": self.until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
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
        data = {"target": "everyone"}
        with outbox_runner():
            response = self.get_response(
                self.organization.slug,
                self.project.slug,
                self.issue_alert_rule.id,
                **data,
            )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 201
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == "everyone"
        assert response.data["ruleId"] == self.issue_alert_rule.id
        assert response.data["alertRuleId"] is None
        assert response.data["until"] == "forever"
        event = log_rpc_service.find_last_log(
            event=audit_log.get_event_id("RULE_SNOOZE"),
            organization_id=self.organization.id,
            target_object_id=self.issue_alert_rule.id,
        )
        assert event is not None
        assert event.actor_user_id == self.user.id

    def test_mute_issue_alert_everyone_until(self):
        """Test that an issue alert rule can be muted for everyone for a period of time"""
        data = {"target": "everyone", "until": self.until}
        with outbox_runner():
            response = self.get_response(
                self.organization.slug,
                self.project.slug,
                self.issue_alert_rule.id,
                **data,
            )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 201
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == "everyone"
        assert response.data["ruleId"] == self.issue_alert_rule.id
        assert response.data["alertRuleId"] is None
        assert response.data["until"] == self.until
        event = log_rpc_service.find_last_log(
            event=audit_log.get_event_id("RULE_SNOOZE"),
            organization_id=self.organization.id,
            target_object_id=self.issue_alert_rule.id,
        )
        assert event is not None
        assert event.actor_user_id == self.user.id

    def test_mute_issue_alert_user_then_everyone(self):
        """Test that a user can mute an issue alert for themselves and then the same alert can be muted for everyone"""
        data = {"target": "me", "until": self.until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 201

        everyone_until = datetime.now(timezone.utc) + timedelta(days=1)
        data = {"target": "everyone", "until": everyone_until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 201

    def test_mute_issue_alert_everyone_then_user(self):
        """Test that an issue alert can be muted for everyone and then a user can mute the same alert for themselves"""
        everyone_until = datetime.now(timezone.utc) + timedelta(days=1)
        data = {"target": "everyone", "until": everyone_until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 201

        data = {"target": "me", "until": self.until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 201

    def test_edit_issue_alert_mute(self):
        """Test that we throw an error if an issue alert rule has already been muted by a user"""
        data: dict[str, Any] = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 201

        data = {"target": "me", "until": self.until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert len(RuleSnooze.objects.all()) == 1
        assert response.status_code == 410
        assert "RuleSnooze already exists for this rule and scope." in response.data["detail"]

    def test_mute_issue_alert_without_alert_write(self):
        """Test that a user without alerts:write cannot mute an issue alert rule"""
        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(member_user)

        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert not RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 403

    def test_user_can_mute_issue_alert_for_self(self):
        """Test that if a user doesn't belong to the team that can edit an issue alert rule, they can still mute it for just themselves."""
        other_team = self.create_team()
        other_issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=other_team.actor
        )
        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            other_issue_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(rule=other_issue_alert_rule.id).exists()
        assert response.status_code == 201

    def test_user_can_mute_unassigned_issue_alert(self):
        """Test that if an issue alert rule's owner is unassigned, the user can mute it."""
        other_issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=None
        )
        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            other_issue_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(rule=other_issue_alert_rule.id).exists()
        assert response.status_code == 201

    def test_no_issue_alert(self):
        """Test that we throw an error when an issue alert rule doesn't exist"""
        data = {"target": "me"}
        response = self.get_response(self.organization.slug, self.project.slug, 777, **data)
        assert not RuleSnooze.objects.filter(alert_rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Rule does not exist" in response.data

    def test_invalid_data_issue_alert(self):
        """Test that we throw an error when passed invalid data"""
        data = {"target": "me", "until": 123}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert not RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Datetime has wrong format." in response.data["until"][0]


@region_silo_test
class DeleteRuleSnoozeTest(BaseRuleSnoozeTest):
    endpoint = "sentry-api-0-rule-snooze"
    method = "delete"

    def test_delete_issue_alert_rule_mute_myself(self):
        """Test that a user can unsnooze a rule they've snoozed for just themselves"""
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=self.issue_alert_rule)
        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert not RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id
        ).exists()
        assert response.status_code == 204

    def test_delete_issue_alert_rule_mute_everyone(self):
        """Test that a user can unsnooze a rule they've snoozed for everyone"""
        self.snooze_rule(owner_id=self.user.id, rule=self.issue_alert_rule)
        data = {"target": "everyone"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert not RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id
        ).exists()
        assert response.status_code == 204

    def test_delete_issue_alert_rule_without_alert_write(self):
        """Test that a user without alerts:write access cannot unmute an issue alert rule"""
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=self.issue_alert_rule)

        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(member_user)

        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.issue_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            rule=self.issue_alert_rule.id, user_id=self.user.id
        ).exists()
        assert response.status_code == 403


@region_silo_test
class PostMetricRuleSnoozeTest(BaseRuleSnoozeTest):
    endpoint = "sentry-api-0-metric-rule-snooze"
    method = "post"

    def test_mute_metric_alert_user_forever(self):
        """Test that a user can mute a metric alert rule for themselves forever"""
        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
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
        data = {"target": "me", "until": self.until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
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
        data = {"target": "everyone"}
        with outbox_runner():
            response = self.get_response(
                self.organization.slug,
                self.project.slug,
                self.metric_alert_rule.id,
                **data,
            )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 201
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == "everyone"
        assert response.data["ruleId"] is None
        assert response.data["alertRuleId"] == self.metric_alert_rule.id
        assert response.data["until"] == "forever"
        event = log_rpc_service.find_last_log(
            event=audit_log.get_event_id("ALERT_RULE_SNOOZE"),
            organization_id=self.organization.id,
            target_object_id=self.metric_alert_rule.id,
        )
        assert event is not None
        assert event.actor_user_id == self.user.id

    def test_mute_metric_alert_everyone_until(self):
        """Test that a metric alert rule can be muted for everyone for a period of time"""
        data = {"target": "everyone", "until": self.until}
        with outbox_runner():
            response = self.get_response(
                self.organization.slug,
                self.project.slug,
                self.metric_alert_rule.id,
                **data,
            )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 201
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
        assert response.data["userId"] == "everyone"
        assert response.data["ruleId"] is None
        assert response.data["alertRuleId"] == self.metric_alert_rule.id
        assert response.data["until"] == self.until
        event = log_rpc_service.find_last_log(
            event=audit_log.get_event_id("ALERT_RULE_SNOOZE"),
            organization_id=self.organization.id,
            target_object_id=self.metric_alert_rule.id,
        )
        assert event is not None
        assert event.actor_user_id == self.user.id

    def test_mute_metric_alert_user_then_everyone(self):
        """Test that a user can mute a metric alert for themselves and then the same alert can be muted for everyone"""
        data = {"target": "me", "until": self.until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 201

        everyone_until = datetime.now(timezone.utc) + timedelta(days=1)
        data = {"target": "everyone", "until": everyone_until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 201

    def test_mute_metric_alert_everyone_then_user(self):
        """Test that a metric alert can be muted for everyone and then a user can mute the same alert for themselves"""
        everyone_until = datetime.now(timezone.utc) + timedelta(days=1)
        data = {"target": "everyone", "until": everyone_until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=None, until=everyone_until
        ).exists()
        assert response.status_code == 201

        data = {"target": "me", "until": self.until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id, until=self.until
        ).exists()
        assert response.status_code == 201

    def test_edit_metric_alert_mute(self):
        """Test that we throw an error if a metric alert rule has already been muted by a user"""
        data: dict[str, Any] = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 201

        data = {"target": "me", "until": self.until}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert len(RuleSnooze.objects.all()) == 1
        assert response.status_code == 410
        assert "RuleSnooze already exists for this rule and scope." in response.data["detail"]

    def test_mute_metric_alert_without_alert_write(self):
        """Test that a user without alerts:write access cannot mute an metric alert rule"""
        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(member_user)

        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert not RuleSnooze.objects.filter(rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 403

    def test_user_can_snooze_metric_alert_for_self(self):
        """Test that if a user doesn't belong to the team that can edit a metric alert rule, they are able to mute it for just themselves."""
        other_team = self.create_team()
        other_metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization,
            projects=[self.project],
            owner=ActorTuple.from_actor_identifier(f"team:{other_team.id}"),
        )
        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            other_metric_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(alert_rule=other_metric_alert_rule).exists()
        assert response.status_code == 201

    def test_user_can_mute_unassigned_metric_alert(self):
        """Test that if a metric alert rule's owner is unassigned, the user can mute it."""
        other_metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project], owner=None
        )
        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            other_metric_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(alert_rule=other_metric_alert_rule.id).exists()
        assert response.status_code == 201

    def test_no_metric_alert(self):
        """Test that we throw an error when a metric alert rule doesn't exist"""
        data = {"target": "me"}
        response = self.get_response(self.organization.slug, self.project.slug, 777, **data)
        assert not RuleSnooze.objects.filter(alert_rule=self.metric_alert_rule.id).exists()
        assert response.status_code == 400
        assert "Rule does not exist" in response.data


@region_silo_test
class DeleteMetricRuleSnoozeTest(BaseRuleSnoozeTest):
    endpoint = "sentry-api-0-metric-rule-snooze"
    method = "delete"

    def test_delete_metric_alert_rule_mute_myself(self):
        """Test that a user can unsnooze a metric alert rule they've snoozed for just themselves"""
        self.snooze_rule(
            user_id=self.user.id, owner_id=self.user.id, alert_rule=self.metric_alert_rule
        )
        response = self.get_response(
            self.organization.slug, self.project.slug, self.metric_alert_rule.id
        )
        assert not RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id
        ).exists()
        assert response.status_code == 204

    def test_delete_metric_alert_rule_mute_everyone(self):
        """Test that a user can unsnooze a metric rule they've snoozed for everyone"""
        self.snooze_rule(owner_id=self.user.id, alert_rule=self.metric_alert_rule)
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
        )
        assert not RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id
        ).exists()
        assert response.status_code == 204

    def test_delete_metric_alert_rule_without_alert_write(self):
        """Test that a user without alerts:write access cannot unmute a metric alert rule"""
        self.snooze_rule(
            user_id=self.user.id, owner_id=self.user.id, alert_rule=self.metric_alert_rule
        )

        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(member_user)

        data = {"target": "me"}
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            self.metric_alert_rule.id,
            **data,
        )
        assert RuleSnooze.objects.filter(
            alert_rule=self.metric_alert_rule.id, user_id=self.user.id
        ).exists()
        assert response.status_code == 403

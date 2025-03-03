from unittest.mock import patch

from rest_framework import status

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.rule import Rule
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class ProjectRuleEnableTestCase(APITestCase):
    endpoint = "sentry-api-0-project-rule-enable"
    method = "PUT"

    def setUp(self):
        self.rule = self.create_project_rule(project=self.project)
        self.login_as(user=self.user)

    @patch("sentry.analytics.record")
    def test_simple(self, record_analytics):
        self.rule.status = ObjectStatus.DISABLED
        self.rule.save()
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.rule.id,
                status_code=status.HTTP_202_ACCEPTED,
            )
        assert Rule.objects.filter(id=self.rule.id, status=ObjectStatus.ACTIVE).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
                target_object=self.rule.id,
                event=audit_log.get_event_id("RULE_EDIT"),
            ).exists()
        assert self.analytics_called_with_args(
            record_analytics,
            "rule_reenable.explicit",
            rule_id=self.rule.id,
            user_id=self.user.id,
            organization_id=self.organization.id,
        )

    def test_rule_enabled(self):
        """Test that we do not accept an enabled rule"""
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.rule.id,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert response.data["detail"] == "Rule is not disabled."

    def test_duplicate_rule(self):
        """Test that we do not allow enabling a rule that is an exact duplicate of another rule in the same project"""
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        actions = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
            }
        ]
        rule = self.create_project_rule(
            project=self.project, action_data=actions, condition_data=conditions
        )

        rule2 = self.create_project_rule(
            project=self.project, action_data=actions, condition_data=conditions
        )
        rule2.status = ObjectStatus.DISABLED
        rule2.save()

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            rule2.id,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            response.data["detail"]
            == f"This rule is an exact duplicate of '{rule.label}' in this project and may not be enabled unless it's edited."
        )

    def test_duplicate_rule_diff_env(self):
        """Test that we do allow enabling a rule that's the exact duplicate of another
        rule in the same project EXCEPT that the environment is different"""
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        actions = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
            }
        ]
        dev_env = self.create_environment(self.project, name="dev", organization=self.organization)
        prod_env = self.create_environment(
            self.project, name="prod", organization=self.organization
        )
        self.create_project_rule(
            project=self.project,
            action_data=actions,
            condition_data=conditions,
            environment_id=dev_env.id,
        )

        rule2 = self.create_project_rule(
            project=self.project,
            action_data=actions,
            condition_data=conditions,
            environment_id=prod_env.id,
        )
        rule2.status = ObjectStatus.DISABLED
        rule2.save()

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule2.id,
            status_code=status.HTTP_202_ACCEPTED,
        )

    def test_duplicate_rule_one_env_one_not(self):
        """Test that we do allow enabling a rule that's the exact duplicate of another
        rule in the same project EXCEPT that the environment is set for only one"""
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        actions = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
            }
        ]
        dev_env = self.create_environment(self.project, name="dev", organization=self.organization)
        self.create_project_rule(
            project=self.project,
            action_data=actions,
            condition_data=conditions,
            environment_id=dev_env.id,
        )

        rule2 = self.create_project_rule(
            project=self.project,
            action_data=actions,
            condition_data=conditions,
        )
        rule2.status = ObjectStatus.DISABLED
        rule2.save()

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            rule2.id,
            status_code=status.HTTP_202_ACCEPTED,
        )

    def test_no_action_rule(self):
        """Test that we do not allow enabling a rule that has no action(s)"""
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        rule = Rule.objects.create(
            project=self.project,
            data={"conditions": conditions, "action_match": "all"},
        )
        rule.status = ObjectStatus.DISABLED
        rule.save()

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            rule.id,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert response.data["detail"] == "Cannot enable a rule with no action."

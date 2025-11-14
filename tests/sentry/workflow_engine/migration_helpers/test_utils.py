from typing import int
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_alert_rule
from sentry.workflow_engine.models import AlertRuleWorkflow, Workflow

OPSGENIE_METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


class WorkflowNameTest(APITestCase):
    def setUp(self) -> None:
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        assert self.rpc_user
        self.og_team = self.create_team(organization=self.organization)
        self.og_team_table = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        self.metric_alert = self.create_alert_rule(resolve_threshold=2)
        self.alert_rule_trigger_critical = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_critical,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.rpc_user.id),
        )
        self.slack_integration = install_slack(self.organization)
        self.opsgenie_integration = self.create_provider_integration(
            provider="opsgenie",
            name="hello-world",
            external_id="hello-world",
            metadata=OPSGENIE_METADATA,
        )
        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
        )
        self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.rpc_user
        )
        with assume_test_silo_mode_of(Integration, OrganizationIntegration):
            self.slack_integration.add_organization(self.organization, self.rpc_user)
            self.org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.slack_integration.id
            )
            self.org_integration.config = {"team_table": [self.og_team_table]}
            self.org_integration.save()

            self.opsgenie_integration.add_organization(self.organization, self.rpc_user)
            self.org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.opsgenie_integration.id
            )
            self.org_integration.config = {"team_table": [self.og_team_table]}
            self.org_integration.save()

    def test_simple(self) -> None:
        """
        Test that the action text is what we expect when we migrate an alert rule with only a critical trigger
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.metric_alert.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert self.rpc_user
        assert workflow.name == f"Email {self.rpc_user.email}"

    def test_warning_and_critical(self) -> None:
        """
        Test that the action text is what we expect when we have both a critical and warning trigger
        """
        self.alert_rule_trigger_warning = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning"
        )
        assert self.rpc_user
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_warning,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.rpc_user.id),
        )
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.metric_alert.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert (
            workflow.name
            == f"Critical - Email {self.rpc_user.email}, Warning - Email {self.rpc_user.email}"
        )

    def test_many_actions(self) -> None:
        """
        Test that if we have more than 3 actions we format the name as expected
        """
        user2 = self.create_user(email="meow@woof.com")
        user3 = self.create_user(email="bark@meow.com")
        user4 = self.create_user(email="idk@lol.com")
        self.create_member(user=user2, organization=self.organization, role="admin", teams=[])
        self.create_member(user=user3, organization=self.organization, role="admin", teams=[])
        self.create_member(user=user4, organization=self.organization, role="admin", teams=[])

        self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_critical,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(user2.id),
        )
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_critical,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(user3.id),
        )
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_critical,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(user4.id),
        )
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.metric_alert.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert self.rpc_user
        assert (
            workflow.name
            == f"Email {self.rpc_user.email}, Email {user2.email}, Email {user3.email}...(+1)"
        )

    def test_with_integrations(self) -> None:
        """
        Test that we receive the text we expect for actions of various integration types
        """
        self.alert_rule_trigger_warning = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning"
        )
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_warning,
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(self.og_team.id),
        )
        self.create_alert_rule_trigger_action(
            target_identifier=self.og_team_table["id"],
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.opsgenie_integration,
            alert_rule_trigger=self.alert_rule_trigger_critical,
        )

        self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            alert_rule_trigger=self.alert_rule_trigger_warning,
        )
        # we create this directly to avoid the api calls to slack for channel verification
        slack_channel_name = "myChannel"
        AlertRuleTriggerAction.objects.create(
            alert_rule_trigger=self.alert_rule_trigger_warning,
            target_identifier="123",
            target_display=slack_channel_name,
            type=AlertRuleTriggerAction.Type.SLACK,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration_id=self.slack_integration.id,
        )
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.metric_alert.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert self.rpc_user
        assert (
            workflow.name
            == f"Critical - Email {self.rpc_user.email}, Notify {self.og_team_table["team"]} via {self.opsgenie_integration.provider.title()}, Warning - Email #{self.og_team.slug}...(+2)"
        )

    def test_missing_org_member(self) -> None:
        user = self.create_user()
        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, target_identifier=str(user.id)
        )

        migrate_alert_rule(alert_rule, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=alert_rule.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert workflow.name == "Email [removed]"

    def test_missing_team(self) -> None:
        team = self.create_team(organization=self.organization)
        alert_rule = self.create_alert_rule(organization=self.organization)
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger,
            target_identifier=str(team.id),
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
        )
        team.delete()

        migrate_alert_rule(alert_rule, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=alert_rule.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert workflow.name == "Email [removed]"

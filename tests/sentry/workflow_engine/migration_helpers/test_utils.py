from unittest import mock

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.testutils.cases import APITestCase
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_alert_rule
from sentry.workflow_engine.models import AlertRuleWorkflow, Workflow


class WorkflowNameTest(APITestCase):
    def setUp(self):
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        self.metric_alert = self.create_alert_rule(resolve_threshold=2)
        self.alert_rule_trigger_critical = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_critical,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )

    def test_simple(self):
        """
        Test that the action text is what we expect when we migrate an alert rule with only a critical trigger
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.metric_alert)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert workflow.name == f"Email {self.rpc_user.email}"

    def test_warning_and_critical(self):
        """
        Test that the action text is what we expect when we have both a critical and warning trigger
        """
        self.alert_rule_trigger_warning = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning"
        )
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_warning,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.metric_alert)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert (
            workflow.name
            == f"Critical - Email {self.rpc_user.email}, Warning - Email {self.rpc_user.email}"
        )

    @mock.patch("sentry.workflow_engine.migration_helpers.utils.MAX_CHARS", 50)
    def test_many_actions(self):
        """
        Test that if we have so many actions we exceed the char limit we format the name as expected
        """
        user2 = self.create_user(email="meow@woof.com")
        user3 = self.create_user(email="bark@meow.com")
        user4 = self.create_user(email="idk@lol.com")

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
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.metric_alert)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert workflow.name == f"Email {self.rpc_user.email}, Email {user2.email}...(+2)"

    def test_every_integration(self):
        """
        Test that we receive the text we expect for actions of every integration type
        """
        pass

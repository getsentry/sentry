from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.alert_rule_trigger_action import (
    AlertRuleTriggerActionSerializer,
)
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import Action, ActionAlertRuleTriggerAction


@freeze_time("2018-12-11 03:21:34")
class TestActionSerializer(TestCase):
    def setUp(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.trigger_action = self.create_alert_rule_trigger_action(alert_rule_trigger=self.trigger)

        self.action = self.create_action(
            type=Action.Type.EMAIL.value,
            target_type=ActionTarget.USER,
            target_identifier=self.user.id,
        )
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.action.id,
            alert_rule_trigger_action_id=self.trigger_action.id,
        )

    def test_simple(self) -> None:
        serialized_action = serialize(self.action, self.user, WorkflowEngineActionSerializer())
        assert serialized_action["type"] == "email"
        assert serialized_action["targetType"] == "user"
        assert serialized_action["targetIdentifier"] == str(self.user.id)

        serialized_alert_rule_trigger_action = serialize(
            self.trigger_action, self.user, AlertRuleTriggerActionSerializer()
        )
        assert serialized_action == serialized_alert_rule_trigger_action

    def test_sentry_app_action(self) -> None:
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.sentry_app_trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        self.sentry_app_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.sentry_app_trigger,
            target_identifier=sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=sentry_app,
            sentry_app_config=[
                {"name": "title", "value": "An alert"},
                {"summary": "Something happened here..."},
                {"name": "points", "value": "3"},
                {"name": "assignee", "value": "Hellboy"},
            ],
        )
        self.sentry_app_action = self.create_action(
            type=Action.Type.SENTRY_APP.value,
            target_type=ActionTarget.SENTRY_APP,
            target_identifier=sentry_app.id,
            target_display=sentry_app.name,
            data={
                "sentry_app_config": self.sentry_app_trigger_action.sentry_app_config,
                "sentry_app_id": sentry_app.id,
            },
        )
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.sentry_app_action.id,
            alert_rule_trigger_action_id=self.sentry_app_trigger_action.id,
        )

        serialized_action = serialize(
            self.sentry_app_action, self.user, WorkflowEngineActionSerializer()
        )
        assert serialized_action["type"] == "sentry_app"
        assert serialized_action["alertRuleTriggerId"] == str(self.sentry_app_trigger.id)
        assert serialized_action["targetType"] == "sentry_app"
        assert serialized_action["targetIdentifier"] == sentry_app.id
        assert serialized_action["sentryAppId"] == sentry_app.id
        assert serialized_action["settings"] == self.sentry_app_action.data["sentry_app_config"]

        serialized_alert_rule_trigger_action = serialize(
            self.sentry_app_trigger_action, self.user, AlertRuleTriggerActionSerializer()
        )
        assert serialized_action == serialized_alert_rule_trigger_action

    def test_slack_action(self) -> None:
        self.integration = self.create_slack_integration(
            self.organization,
            external_id="TXXXXXXX1",
            user=self.user,
        )
        self.slack_trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.slack_trigger_action = AlertRuleTriggerAction.objects.create(
            alert_rule_trigger=self.slack_trigger,
            target_identifier="123",
            target_display="myChannel",
            type=AlertRuleTriggerAction.Type.SLACK,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration_id=self.integration.id,
        )
        self.slack_action = self.create_action(
            type=Action.Type.SLACK.value,
            target_type=ActionTarget.SPECIFIC,
            target_identifier=self.slack_trigger_action.target_identifier,
            target_display=self.slack_trigger_action.target_display,
            integration_id=self.integration.id,
        )
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.slack_action.id,
            alert_rule_trigger_action_id=self.slack_trigger_action.id,
        )

        serialized_action = serialize(
            self.slack_action, self.user, WorkflowEngineActionSerializer()
        )
        serialized_alert_rule_trigger_action = serialize(
            self.slack_trigger_action, self.user, AlertRuleTriggerActionSerializer()
        )
        assert serialized_action == serialized_alert_rule_trigger_action

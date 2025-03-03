from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.alert_rule_trigger_action import (
    AlertRuleTriggerActionSerializer,
)
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Action, ActionAlertRuleTriggerAction


class TestActionSerializer(TestCase):
    def setUp(self):
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.trigger_action = self.create_alert_rule_trigger_action(alert_rule_trigger=self.trigger)

        self.action = self.create_action()
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.action.id,
            alert_rule_trigger_action_id=self.trigger_action.id,
        )

    def test_simple(self):
        serialized_action = serialize(self.action, self.user, WorkflowEngineActionSerializer())
        assert serialized_action["type"] == "email"
        assert serialized_action["targetType"] == "user"
        assert serialized_action["targetIdentifier"] == str(self.user.id)

        serialized_alert_rule_trigger_action = serialize(
            self.trigger_action, self.user, AlertRuleTriggerActionSerializer()
        )
        assert serialized_action == serialized_alert_rule_trigger_action

    def test_sentry_app_config(self):
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.trigger2 = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        self.sentry_app_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.trigger2,
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
            type=Action.Type.SENTRY_APP,
            data={"settings": self.sentry_app_trigger_action.sentry_app_config},
            target_identifier=sentry_app.id,
        )
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.sentry_app_action.id,
            alert_rule_trigger_action_id=self.sentry_app_trigger_action.id,
        )

        serialized_action = serialize(
            self.sentry_app_action, self.user, WorkflowEngineActionSerializer()
        )
        assert serialized_action["type"] == "sentry_app"
        assert serialized_action["alertRuleTriggerId"] == str(self.sentry_app_trigger_action.id)
        assert serialized_action["targetType"] == "sentry_app"
        assert serialized_action["targetIdentifier"] == self.user.id
        assert serialized_action["settings"] == self.sentry_app_action.data["settings"]

        serialized_alert_rule_trigger_action = serialize(
            self.sentry_app_trigger_action, self.user, AlertRuleTriggerActionSerializer()
        )
        assert serialized_action == serialized_alert_rule_trigger_action

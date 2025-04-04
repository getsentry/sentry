from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
)
from sentry.workflow_engine.models import Action


@freeze_time("2018-12-11 03:21:34")
class TestActionSerializer(TestCase):
    def setUp(self) -> None:
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        self.alert_rule = self.create_alert_rule()
        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="critical"
        )
        self.critical_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )
        (
            self.data_source,
            self.data_condition_group,
            self.workflow,
            self.detector,
            self.detector_state,
            self.alert_rule_detector,
            self.alert_rule_workflow,
            self.detector_workflow,
        ) = migrate_alert_rule(self.alert_rule)
        self.detector_trigger, self.action_filter = migrate_metric_data_conditions(
            self.critical_trigger
        )
        self.action, self.dcga, self.action_alert_rule_trigger_action = migrate_metric_action(
            self.critical_trigger_action
        )

    def test_simple(self) -> None:
        serialized_action = serialize(self.action, self.user, WorkflowEngineActionSerializer())
        assert serialized_action["id"] == str(self.critical_trigger_action.id)
        assert serialized_action["alertRuleTriggerId"] == str(self.critical_trigger.id)
        assert serialized_action["type"] == "email"
        assert serialized_action["targetType"] == "user"
        assert serialized_action["targetIdentifier"] == str(self.user.id)
        assert serialized_action["inputChannelId"] is None
        assert serialized_action["integrationId"] is None
        assert serialized_action["sentryAppId"] is None
        assert serialized_action["dateCreated"] == self.action.date_added
        assert serialized_action["desc"] == f"Send a notification to {self.user.email}"
        assert serialized_action["priority"] == self.action.data.get("priority")

    def test_sentry_app_action(self) -> None:
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.sentry_app_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="warning"
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        self.sentry_app_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.sentry_app_trigger,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_identifier=sentry_app.id,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=sentry_app,
            sentry_app_config=[
                {"name": "title", "value": "An alert"},
                # {"summary": "Something happened here..."},
                # {"name": "points", "value": "3"},
                # {"name": "assignee", "value": "Hellboy"},
            ],
        )
        migrate_metric_data_conditions(self.sentry_app_trigger)
        self.sentry_app_action, _, _ = migrate_metric_action(self.sentry_app_trigger_action)

        serialized_action = serialize(
            self.sentry_app_action, self.rpc_user, WorkflowEngineActionSerializer()
        )
        assert serialized_action["type"] == "sentry_app"
        assert serialized_action["id"] == str(self.sentry_app_trigger.id)
        assert serialized_action["alertRuleTriggerId"] == str(self.sentry_app_trigger.id)
        assert serialized_action["targetType"] == "sentry_app"
        assert serialized_action["targetIdentifier"] == sentry_app.id
        assert serialized_action["sentryAppId"] == sentry_app.id
        assert serialized_action["settings"] == self.sentry_app_action.data["settings"]

    def test_slack_action(self) -> None:
        self.integration = self.create_slack_integration(
            self.organization,
            external_id="TXXXXXXX1",
            user=self.user,
        )
        self.slack_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="warning"
        )
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
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": self.slack_trigger_action.target_identifier,
                "target_display": self.slack_trigger_action.target_display,
            },
        )
        migrate_metric_data_conditions(self.slack_trigger)
        self.slack_action, _, _ = migrate_metric_action(self.slack_trigger_action)

        serialized_action = serialize(
            self.slack_action, self.user, WorkflowEngineActionSerializer()
        )
        assert serialized_action["type"] == self.integration.provider
        assert serialized_action["id"] == str(self.slack_trigger.id)
        assert serialized_action["alertRuleTriggerId"] == str(self.slack_trigger.id)
        assert serialized_action["targetType"] == "specific"
        assert serialized_action["targetIdentifier"] == self.slack_trigger_action.target_display
        assert serialized_action["integrationId"] == self.integration.id
        assert (
            serialized_action["desc"]
            == f"Send a Slack notification to {self.slack_trigger_action.target_display}"
        )

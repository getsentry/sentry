from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import (
    Action,
    ActionAlertRuleTriggerAction,
    DataConditionAlertRuleTrigger,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier


@freeze_time("2018-12-11 03:21:34")
class TestActionSerializer(TestCase):
    def setUp(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="critical"
        )
        self.critical_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )

        # create ACI stuff
        self.action = self.create_action(
            type=Action.Type.EMAIL.value,
            config={
                "target_type": ActionTarget.USER,
                "target_identifier": str(self.user.id),
            },
        )
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.action.id,
            alert_rule_trigger_action_id=self.critical_trigger_action.id,
        )

        self.detector_data_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id
        )
        self.detector = self.create_detector(
            name=self.alert_rule.name,
            project=self.project,
            workflow_condition_group=self.detector_data_condition_group,
            owner_user_id=self.alert_rule.user_id,
        )
        self.workflow = self.create_workflow(
            name=self.alert_rule.name,
            organization_id=self.organization.id,
            owner_user_id=self.alert_rule.user_id,
        )
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow)

        self.data_condition_group = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition_group_action(
            action=self.action, condition_group=self.data_condition_group
        )
        self.action_filter_data_condition = self.create_data_condition(
            comparison=DetectorPriorityLevel.HIGH,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_EQUALS,
            condition_group=self.data_condition_group,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=self.workflow, condition_group=self.data_condition_group
        )

        self.critical_detector_trigger_data_condition = self.create_data_condition(
            condition_group=self.detector.workflow_condition_group,
            condition_result=self.action_filter_data_condition.comparison,
            comparison=self.critical_trigger.alert_threshold,
        )
        DataConditionAlertRuleTrigger.objects.create(
            data_condition=self.critical_detector_trigger_data_condition,
            alert_rule_trigger_id=self.critical_trigger.id,
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
                {"summary": "Something happened here..."},
                {"name": "points", "value": "3"},
                {"name": "assignee", "value": "Hellboy"},
            ],
        )
        self.sentry_app_action = self.create_action(
            type=Action.Type.SENTRY_APP.value,
            config={
                "target_type": ActionTarget.SENTRY_APP,
                "target_identifier": str(sentry_app.id),
                "target_display": sentry_app.name,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            },
            data={
                "settings": self.sentry_app_trigger_action.sentry_app_config,
            },
        )
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.sentry_app_action.id,
            alert_rule_trigger_action_id=self.sentry_app_trigger_action.id,
        )
        self.create_data_condition_group_action(
            condition_group=self.data_condition_group,
            action=self.sentry_app_action,
        )
        self.sentry_app_action_filter_data_condition = self.create_data_condition(
            comparison=DetectorPriorityLevel.MEDIUM,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_EQUALS,
            condition_group=self.data_condition_group,
        )
        self.sentry_app_detector_trigger_data_condition = self.create_data_condition(
            condition_group=self.detector.workflow_condition_group,
            condition_result=self.sentry_app_action_filter_data_condition.comparison,
            comparison=self.sentry_app_trigger.alert_threshold,
        )
        DataConditionAlertRuleTrigger.objects.create(
            data_condition=self.sentry_app_detector_trigger_data_condition,
            alert_rule_trigger_id=self.sentry_app_trigger.id,
        )

        serialized_action = serialize(
            self.sentry_app_action, self.user, WorkflowEngineActionSerializer()
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
        ActionAlertRuleTriggerAction.objects.create(
            action_id=self.slack_action.id,
            alert_rule_trigger_action_id=self.slack_trigger_action.id,
        )
        self.create_data_condition_group_action(
            condition_group=self.data_condition_group,
            action=self.slack_action,
        )

        serialized_action = serialize(
            self.slack_action, self.user, WorkflowEngineActionSerializer()
        )
        assert serialized_action["type"] == self.integration.provider
        assert serialized_action["targetType"] == "specific"
        assert serialized_action["targetIdentifier"] == self.slack_trigger_action.target_display
        assert serialized_action["integrationId"] == self.integration.id
        assert (
            serialized_action["desc"]
            == f"Send a Slack notification to {self.slack_trigger_action.target_display}"
        )

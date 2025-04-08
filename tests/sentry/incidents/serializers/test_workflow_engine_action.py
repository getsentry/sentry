from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
)


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
        migrate_alert_rule(self.alert_rule)
        migrate_metric_data_conditions(self.critical_trigger)
        self.action, _, _ = migrate_metric_action(self.critical_trigger_action)

        self.expected = {
            "id": str(self.critical_trigger_action.id),
            "alertRuleTriggerId": str(self.critical_trigger.id),
            "type": "email",
            "targetType": "user",
            "targetIdentifier": str(self.user.id),
            "inputChannelId": None,
            "integrationId": None,
            "sentryAppId": None,
            "dateCreated": self.action.date_added,
            "desc": f"Send a notification to {self.user.email}",
            "priority": self.action.data.get("priority"),
        }

    def test_simple(self) -> None:
        serialized_action = serialize(self.action, self.user, WorkflowEngineActionSerializer())
        assert serialized_action == self.expected

    def test_warning_trigger(self) -> None:
        """
        Test that we can differentiate between critical and warning triggers
        """
        self.og_team = self.create_team(organization=self.organization)
        self.warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="warning"
        )
        self.warning_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.warning_trigger,
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(self.og_team.id),
        )
        migrate_metric_data_conditions(self.warning_trigger)
        self.warning_action, _, _ = migrate_metric_action(self.warning_trigger_action)

        serialized_action = serialize(
            self.warning_action, self.user, WorkflowEngineActionSerializer()
        )
        warning_expected = self.expected.copy()
        warning_expected["id"] = str(self.warning_trigger_action.id)
        warning_expected["alertRuleTriggerId"] = str(self.warning_trigger.id)
        warning_expected["targetType"] = "team"
        warning_expected["targetIdentifier"] = str(self.og_team.id)
        warning_expected["dateCreated"] = self.warning_action.date_added
        warning_expected["desc"] = f"Send an email to members of #{self.og_team.slug}"
        warning_expected["priority"] = self.warning_action.data.get("priority")
        assert serialized_action == warning_expected

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
            ],
        )
        migrate_metric_data_conditions(self.sentry_app_trigger)
        self.sentry_app_action, _, _ = migrate_metric_action(self.sentry_app_trigger_action)

        serialized_action = serialize(
            self.sentry_app_action, self.user, WorkflowEngineActionSerializer()
        )
        sentry_app_expected = self.expected.copy()
        sentry_app_expected["type"] = "sentry_app"
        sentry_app_expected["id"] = str(self.sentry_app_trigger_action.id)
        sentry_app_expected["alertRuleTriggerId"] = str(self.sentry_app_trigger.id)
        sentry_app_expected["targetType"] = "sentry_app"
        sentry_app_expected["targetIdentifier"] = sentry_app.id
        sentry_app_expected["sentryAppId"] = sentry_app.id
        sentry_app_expected["settings"] = self.sentry_app_action.data["settings"]
        sentry_app_expected["desc"] = f"Send a notification via {sentry_app.name}"
        assert serialized_action == sentry_app_expected

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
        migrate_metric_data_conditions(self.slack_trigger)
        self.slack_action, _, _ = migrate_metric_action(self.slack_trigger_action)

        serialized_action = serialize(
            self.slack_action, self.user, WorkflowEngineActionSerializer()
        )
        slack_expected = self.expected.copy()
        slack_expected["type"] = self.integration.provider
        slack_expected["id"] = str(self.slack_trigger_action.id)
        slack_expected["alertRuleTriggerId"] = str(self.slack_trigger.id)
        slack_expected["targetType"] = "specific"
        slack_expected["targetIdentifier"] = self.slack_trigger_action.target_display
        slack_expected["inputChannelId"] = "123"
        slack_expected["integrationId"] = self.integration.id
        slack_expected["desc"] = (
            f"Send a Slack notification to {self.slack_trigger_action.target_display}"
        )
        assert serialized_action == slack_expected

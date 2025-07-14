from unittest.mock import patch

import orjson
import responses
from urllib3.response import HTTPResponse

from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.discord.client import CHANNEL_URL, DISCORD_BASE_URL
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers import with_feature
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import dual_write_alert_rule
from sentry.workflow_engine.migration_helpers.utils import get_workflow_name
from sentry.workflow_engine.models import (
    Action,
    ActionAlertRuleTriggerAction,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionAlertRuleTrigger,
    DataConditionGroup,
    DataConditionGroupAction,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class MigrateAnomalyDetectionAlertsTest(TestMigrations):
    migrate_from = "0069_rename_error_detectors"
    migrate_to = "0070_migrate_remaining_anomaly_detection_alerts"
    app = "workflow_engine"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def create_dynamic_alert(self, mock_seer_request):
        seer_return_value = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        dynamic_rule = self.create_alert_rule(
            detection_type=AlertRuleDetectionType.DYNAMIC,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            threshold_type=AlertRuleThresholdType.ABOVE_AND_BELOW,
            time_window=60,
        )
        return dynamic_rule

    @responses.activate
    def setup_initial_state(self):
        self.valid_rule = self.create_dynamic_alert()
        self.valid_trigger = self.create_alert_rule_trigger(
            alert_rule=self.valid_rule, label="critical", alert_threshold=0
        )
        self.email_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.valid_trigger
        )

        # advanced
        self.rule_with_incident = self.create_dynamic_alert()
        self.create_alert_rule_trigger(alert_rule=self.rule_with_incident, alert_threshold=0)
        self.create_incident(
            alert_rule=self.rule_with_incident, status=IncidentStatus.CRITICAL.value
        )

        self.snoozed_rule = self.create_dynamic_alert()
        self.create_alert_rule_trigger(alert_rule=self.snoozed_rule, alert_threshold=0)
        self.snooze_rule(alert_rule=self.snoozed_rule)

        self.skipped_rule = self.create_dynamic_alert()
        self.skipped_trigger = self.create_alert_rule_trigger(
            alert_rule=self.skipped_rule, alert_threshold=0
        )
        self.sentry_app = self.create_sentry_app(
            name="oolong",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
        )
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.rpc_user
        )
        self.bad_action = self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            alert_rule_trigger=self.skipped_trigger,
            sentry_app_config=[{"favorite_tea": "strawberry matcha latte with oat milk"}],
        )

        # dual written rule
        self.dual_written_rule = self.create_dynamic_alert()
        self.dual_written_trigger = self.create_alert_rule_trigger(
            alert_rule=self.dual_written_rule, label="critical", alert_threshold=0
        )
        dual_write_alert_rule(self.dual_written_rule)

        # discord action
        self.guild_id = "guild-id"
        self.channel_id = "12345678910"
        self.discord_user_id = "user1234"

        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}{CHANNEL_URL.format(channel_id=self.channel_id)}",
            json={"type": 0, "guild_id": self.guild_id},
            status=200,
        )

        self.discord_integration = self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=self.guild_id,
            organization=self.organization,
        )
        self.provider = self.create_identity_provider(integration=self.discord_integration)
        self.identity = self.create_identity(
            user=self.user, identity_provider=self.provider, external_id=self.discord_user_id
        )

        self.discord_rule = self.create_dynamic_alert()
        self.discord_trigger = self.create_alert_rule_trigger(
            alert_rule=self.discord_rule, alert_threshold=0
        )
        self.discord_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.discord_trigger,
            target_identifier=self.channel_id,
            type=AlertRuleTriggerAction.Type.DISCORD,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.discord_integration,
        )

    def test_valid_rule(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.valid_rule.id)
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=self.valid_rule.id)

        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        assert workflow.name == get_workflow_name(self.valid_rule)
        assert workflow.organization_id == self.valid_rule.organization.id
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        assert detector.name == self.valid_rule.name
        assert detector.project_id == self.project.id
        assert detector.enabled is True
        assert detector.description == self.valid_rule.description
        assert detector.owner_user_id == self.valid_rule.user_id
        assert detector.owner_team == self.valid_rule.team
        assert detector.type == "metric_issue"
        assert detector.config == {
            "threshold_period": self.valid_rule.threshold_period,
            "sensitivity": AlertRuleSensitivity.HIGH,
            "seasonality": AlertRuleSeasonality.AUTO,
            "comparison_delta": None,
            "detection_type": "dynamic",
        }

        detector_workflow = DetectorWorkflow.objects.get(detector=detector)
        assert detector_workflow.workflow == workflow

        assert workflow.when_condition_group is None

        query_subscription = QuerySubscription.objects.get(
            snuba_query=self.valid_rule.snuba_query.id
        )
        data_source = DataSource.objects.get(
            organization_id=self.valid_rule.organization_id, source_id=str(query_subscription.id)
        )
        assert data_source.type == "snuba_query_subscription"
        detector_state = DetectorState.objects.get(detector=detector)
        assert detector_state.is_triggered is False
        assert detector_state.state == str(0)

        data_source_detector = DataSourceDetector.objects.get(data_source=data_source)
        assert data_source_detector.detector == detector

    def test_valid_trigger(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.valid_rule.id)
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=self.valid_rule.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)

        # detector trigger
        detector_trigger = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        assert detector_trigger.comparison == {
            "sensitivity": self.valid_rule.sensitivity,
            "seasonality": self.valid_rule.seasonality,
            "threshold_type": self.valid_rule.threshold_type,
        }
        assert detector_trigger.type == Condition.ANOMALY_DETECTION
        assert DataConditionAlertRuleTrigger.objects.filter(
            data_condition=detector_trigger, alert_rule_trigger_id=self.valid_trigger.id
        ).exists()

        # action filters
        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        fire_action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.HIGH,
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
        )
        assert fire_action_filter.condition_result is True

        resolve_action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.HIGH,
            type=Condition.ISSUE_PRIORITY_DEESCALATING,
        )
        assert resolve_action_filter.condition_result is True

    def test_skip_correctly_dual_written_rule(self):
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=self.dual_written_rule.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)

        assert DataCondition.objects.filter(
            condition_group=detector.workflow_condition_group, type=Condition.ANOMALY_DETECTION
        ).exists()
        assert not DataCondition.objects.filter(
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.OK,
        ).exists()

    def test_simple_trigger_action(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.valid_rule.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.HIGH,
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
        )

        aarta = ActionAlertRuleTriggerAction.objects.get(
            alert_rule_trigger_action_id=self.email_action.id
        )
        action = aarta.action
        DataConditionGroupAction.objects.get(
            condition_group_id=action_filter.condition_group.id,
            action=action.id,
        )
        assert action.type == Action.Type.EMAIL
        assert action.data == {}
        assert action.integration_id is None
        assert action.config.get("target_display") is None
        assert action.config.get("target_identifier") == self.email_action.target_identifier
        assert action.config.get("target_type") == self.email_action.target_type

    def test_discord_action(self):
        aarta = ActionAlertRuleTriggerAction.objects.get(
            alert_rule_trigger_action_id=self.discord_action.id
        )
        action = aarta.action

        assert action.type == Action.Type.DISCORD

    def test_create_with_incident(self):
        alert_rule_detector = AlertRuleDetector.objects.get(
            alert_rule_id=self.rule_with_incident.id
        )

        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        detector_state = DetectorState.objects.get(detector=detector)
        assert detector_state.is_triggered is True
        assert detector_state.state == str(DetectorPriorityLevel.HIGH)

    def test_create_snoozed(self):
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=self.snoozed_rule.id)

        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        assert not detector.enabled

    def test_create_error(self):
        """
        Test that none of the ACI objects are written to the DB if an exception occurs, and test that
        an exception doesn't crash the migration.
        """
        assert not AlertRuleDetector.objects.filter(alert_rule_id=self.skipped_rule.id).exists()

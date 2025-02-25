from unittest.mock import patch

import orjson
from urllib3.response import HTTPResponse

from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import (
    Action,
    ActionAlertRuleTriggerAction,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class MigrateMetricAlertTest(TestMigrations):
    migrate_from = "0032_remove_data_source_query_id"
    migrate_to = "0033_migrate_metric_alerts"
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
            time_window=60,
        )
        return dynamic_rule

    def setup_initial_state(self):
        self.valid_rule = self.create_alert_rule(name="hojicha")
        self.valid_trigger = self.create_alert_rule_trigger(alert_rule=self.valid_rule)
        self.email_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.valid_trigger
        )

        METADATA = {
            "api_key": "1234-ABCD",
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "test-app.app.opsgenie.com",
        }
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        self.og_team = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        self.integration = self.create_provider_integration(
            provider="opsgenie", name="matcha", external_id="matcha", metadata=METADATA
        )
        self.sentry_app = self.create_sentry_app(
            name="oolong",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
        )
        self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.rpc_user
        )
        with assume_test_silo_mode_of(Integration, OrganizationIntegration):
            self.integration.add_organization(self.organization, self.user)
            self.org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.integration.id
            )
            self.org_integration.config = {"team_table": [self.og_team]}
            self.org_integration.save()

        self.integration_action = self.create_alert_rule_trigger_action(
            target_identifier=self.og_team["id"],
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
            alert_rule_trigger=self.valid_trigger,
        )

        self.sentry_app_action = self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            alert_rule_trigger=self.valid_trigger,
            sentry_app_config=[{"name": "assignee", "value": "michelle"}],
        )

        # advanced
        self.dynamic_rule = self.create_dynamic_alert()

        self.rule_with_incident = self.create_alert_rule()
        self.create_alert_rule_trigger(alert_rule=self.rule_with_incident)
        self.create_incident(
            alert_rule=self.rule_with_incident, status=IncidentStatus.CRITICAL.value
        )

        self.snoozed_rule = self.create_alert_rule()
        self.create_alert_rule_trigger(alert_rule=self.snoozed_rule)
        self.snooze_rule(alert_rule=self.snoozed_rule)

        self.skipped_rule = self.create_alert_rule()
        self.skipped_trigger = self.create_alert_rule_trigger(alert_rule=self.skipped_rule)
        self.bad_action = self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            alert_rule_trigger=self.skipped_trigger,
            sentry_app_config=[{"favorite_tea": "strawberry matcha latte with oat milk"}],
        )

    def test_simple_rule(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.valid_rule)
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.valid_rule)

        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        assert workflow.name == self.valid_rule.name
        assert workflow.organization_id == self.valid_rule.organization.id
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        assert detector.name == self.valid_rule.name
        assert detector.project_id == self.project.id
        assert detector.enabled is True
        assert detector.description == self.valid_rule.description
        assert detector.owner_user_id == self.valid_rule.user_id
        assert detector.owner_team == self.valid_rule.team
        assert detector.type == "metric_alert_fire"
        assert detector.config == {
            "threshold_period": self.valid_rule.threshold_period,
            "sensitivity": None,
            "seasonality": None,
            "comparison_delta": None,
            "detection_type": "static",
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
        assert detector_state.active is False
        assert detector_state.state == str(0)

        data_source_detector = DataSourceDetector.objects.get(data_source=data_source)
        assert data_source_detector.detector == detector

    def test_simple_trigger(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.valid_rule)
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.valid_rule)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)

        detector_trigger = DataCondition.objects.get(
            comparison=self.valid_trigger.alert_threshold,
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        assert detector_trigger.type == Condition.GREATER

        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.HIGH,
        )

        assert action_filter.condition_result is True
        assert action_filter.type == Condition.ISSUE_PRIORITY_EQUALS

        assert WorkflowDataConditionGroup.objects.filter(
            condition_group=action_filter.condition_group
        ).exists()

    def test_simple_resolve(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.valid_rule)
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.valid_rule)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)

        detector_trigger = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.OK,
        )

        assert detector_trigger.comparison == self.valid_trigger.alert_threshold
        assert detector_trigger.type == Condition.LESS_OR_EQUAL

        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.OK,
        )

        assert action_filter.condition_result is True
        assert action_filter.type == Condition.ISSUE_PRIORITY_EQUALS

        assert WorkflowDataConditionGroup.objects.filter(
            condition_group=action_filter.condition_group
        ).exists()

    def test_simple_trigger_action(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.valid_rule)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.HIGH,
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
        assert action.data == {
            "type": self.email_action.type,
            "sentry_app_id": self.email_action.sentry_app_id,
            "sentry_app_config": self.email_action.sentry_app_config,
        }
        assert action.integration_id is None
        assert action.target_display is None
        assert action.target_identifier == self.email_action.target_identifier
        assert action.target_type == self.email_action.target_type

    def test_on_call_trigger_action(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.valid_rule)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.HIGH,
        )

        aarta = ActionAlertRuleTriggerAction.objects.get(
            alert_rule_trigger_action_id=self.integration_action.id
        )
        action = aarta.action
        DataConditionGroupAction.objects.get(
            condition_group_id=action_filter.condition_group.id,
            action=action.id,
        )

        assert action.type == Action.Type.OPSGENIE
        assert action.data == {"priority": OPSGENIE_DEFAULT_PRIORITY}
        assert action.integration_id == self.integration_action.integration_id
        assert action.target_display == self.integration_action.target_display
        assert action.target_identifier == self.integration_action.target_identifier
        assert action.target_type == self.integration_action.target_type

    def test_sentry_app_trigger_action(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.valid_rule)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.HIGH,
        )

        aarta = ActionAlertRuleTriggerAction.objects.get(
            alert_rule_trigger_action_id=self.sentry_app_action.id
        )
        action = aarta.action
        DataConditionGroupAction.objects.get(
            condition_group_id=action_filter.condition_group.id,
            action=action.id,
        )

        assert action.type == Action.Type.SENTRY_APP
        assert action.data == {
            "settings": self.sentry_app_action.sentry_app_config,
        }
        assert action.integration_id is None
        assert action.target_display == self.sentry_app_action.target_display
        assert action.target_identifier == self.sentry_app_action.target_identifier
        assert action.target_type == self.sentry_app_action.target_type

    def test_skip_dynamic_rule(self):
        assert not AlertRuleDetector.objects.filter(alert_rule=self.dynamic_rule).exists()

    def test_create_with_incident(self):
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.rule_with_incident)

        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        detector_state = DetectorState.objects.get(detector=detector)
        assert detector_state.active is True
        assert detector_state.state == str(DetectorPriorityLevel.HIGH)

    def test_create_snoozed(self):
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.snoozed_rule)

        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        assert not detector.enabled

    def test_create_error(self):
        """
        Test that none of the ACI objects are written to the DB if an exception occurs, and test that
        an exception doesn't crash the migration.
        """
        assert not AlertRuleDetector.objects.filter(alert_rule=self.skipped_rule).exists()

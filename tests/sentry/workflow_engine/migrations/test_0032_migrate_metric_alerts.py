from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import (  # WorkflowDataConditionGroup,
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
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class MigrateMetricAlertTest(TestMigrations):
    migrate_from = "0031_make_detector_project_non_nullable"
    migrate_to = "0032_migrate_metric_alerts"
    app = "workflow_engine"

    def setUp(self):
        return super().setUp()

    def setup_initial_state(self):
        self.valid_rule = self.create_alert_rule(name="hojicha")
        self.valid_trigger = self.create_alert_rule_trigger(alert_rule=self.valid_rule)
        self.email_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.valid_trigger
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
            alert_rule_trigger_action_id=self.valid_trigger.id
        )
        action = aarta.action
        DataConditionGroupAction.objects.get(
            condition_group_id=action_filter.condition_group.id,
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

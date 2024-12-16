from unittest import mock

from sentry.incidents.grouptype import MetricAlertFire
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import APITestCase
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import (
    create_data_condition_group,
    create_data_source,
    create_detector,
    create_workflow,
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_condition,
)
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    AlertRuleTriggerDataCondition,
    AlertRuleWorkflow,
    DataCondition,
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
from sentry.workflow_engine.types import DataSourceType, DetectorPriorityLevel


class AlertRuleMigrationHelpersTest(APITestCase):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=self.metric_alert)
        self.alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger
        )
        self.rpc_user = user_service.get_user(user_id=self.user.id)

    def test_create_metric_alert(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for an alert rule
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)

        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.metric_alert)
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert)

        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        assert workflow.name == self.metric_alert.name
        assert self.metric_alert.organization
        assert workflow.organization_id == self.metric_alert.organization.id
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        assert detector.name == self.metric_alert.name
        assert detector.project_id == self.project.id
        assert detector.enabled is True
        assert detector.description == self.metric_alert.description
        assert detector.owner_user_id == self.metric_alert.user_id
        assert detector.owner_team == self.metric_alert.team
        assert detector.type == MetricAlertFire.slug
        assert detector.config == {
            "threshold_period": self.metric_alert.threshold_period,
            "sensitivity": None,
            "seasonality": None,
            "comparison_delta": None,
        }

        detector_workflow = DetectorWorkflow.objects.get(detector=detector)
        assert detector_workflow.workflow == workflow

        workflow_data_condition_group = WorkflowDataConditionGroup.objects.get(workflow=workflow)
        assert workflow_data_condition_group.condition_group == workflow.when_condition_group

        assert self.metric_alert.snuba_query
        query_subscription = QuerySubscription.objects.get(
            snuba_query=self.metric_alert.snuba_query.id
        )
        data_source = DataSource.objects.get(
            organization_id=self.metric_alert.organization_id, query_id=query_subscription.id
        )
        assert data_source.type == DataSourceType.SNUBA_QUERY_SUBSCRIPTION
        detector_state = DetectorState.objects.get(detector=detector)
        assert detector_state.active is False
        assert detector_state.state == str(DetectorPriorityLevel.OK.value)

        data_source_detector = DataSourceDetector.objects.get(data_source=data_source)
        assert data_source_detector.detector == detector

    def test_create_metric_alert_trigger(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for an alert rule trigger
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_condition(self.alert_rule_trigger)
        alert_rule_trigger_data_condition = AlertRuleTriggerDataCondition.objects.get(
            alert_rule_trigger=self.alert_rule_trigger
        )
        data_condition_group_id = (
            alert_rule_trigger_data_condition.data_condition.condition_group.id
        )
        data_condition = DataCondition.objects.get(condition_group=data_condition_group_id)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.metric_alert)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        data_condition_group = workflow.when_condition_group

        assert data_condition.condition == Condition.GREATER
        assert data_condition.comparison == self.alert_rule_trigger.alert_threshold
        assert data_condition.condition_result == DetectorPriorityLevel.HIGH
        assert data_condition.condition_group == data_condition_group

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_create_metric_alert_trigger_no_alert_rule_detector(self, mock_logger):
        create_data_source(self.organization.id, self.metric_alert.snuba_query)
        data_condition_group = create_data_condition_group(self.organization.id)
        create_workflow(
            self.metric_alert.name, self.organization.id, data_condition_group, self.rpc_user
        )
        create_detector(self.metric_alert, self.project.id, data_condition_group, self.rpc_user)
        # skip creating lookup tables
        migrate_metric_data_condition(self.alert_rule_trigger)
        mock_logger.exception.assert_called_with(
            "AlertRuleDetector does not exist",
            extra={
                "alert_rule_id": self.alert_rule_trigger.alert_rule.id,
            },
        )

    def test_create_metric_alert_trigger_action(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for an alert rule trigger action
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_condition(self.alert_rule_trigger)
        migrate_metric_action(self.alert_rule_trigger_action)
        alert_rule_trigger_data_condition = AlertRuleTriggerDataCondition.objects.get(
            alert_rule_trigger=self.alert_rule_trigger
        )
        data_condition_group_id = (
            alert_rule_trigger_data_condition.data_condition.condition_group.id
        )
        data_condition_group_action = DataConditionGroupAction.objects.get(
            condition_group_id=data_condition_group_id
        )
        assert Action.objects.filter(id=data_condition_group_action.action.id).exists()

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_create_metric_alert_trigger_action_no_alert_rule_trigger_data_condition(
        self, mock_logger
    ):
        other_metric_alert = self.create_alert_rule()
        other_alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=other_metric_alert)

        migrate_alert_rule(other_metric_alert, self.rpc_user)
        migrate_metric_data_condition(other_alert_rule_trigger)
        migrate_metric_action(self.alert_rule_trigger_action)
        mock_logger.exception.assert_called_with(
            "AlertRuleTriggerDataCondition does not exist",
            extra={
                "alert_rule_trigger_id": self.alert_rule_trigger.id,
            },
        )

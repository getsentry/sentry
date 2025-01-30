from unittest import mock

import pytest

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import (
    MissingDataConditionGroup,
    dual_delete_migrated_alert_rule,
    dual_delete_migrated_alert_rule_trigger,
    dual_delete_migrated_alert_rule_trigger_action,
    dual_update_migrated_alert_rule,
    get_action_filter,
    get_detector_trigger,
    get_resolve_threshold,
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_conditions,
)
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
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


def assert_alert_rule_migrated(alert_rule, project_id):
    alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
    alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)

    workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
    assert workflow.name == alert_rule.name
    assert workflow.organization_id == alert_rule.organization.id
    detector = Detector.objects.get(id=alert_rule_detector.detector.id)
    assert detector.name == alert_rule.name
    assert detector.project_id == project_id
    assert detector.enabled is True
    assert detector.description == alert_rule.description
    assert detector.owner_user_id == alert_rule.user_id
    assert detector.owner_team == alert_rule.team
    assert detector.type == MetricAlertFire.slug
    assert detector.config == {
        "threshold_period": alert_rule.threshold_period,
        "sensitivity": None,
        "seasonality": None,
        "comparison_delta": None,
        "detection_type": AlertRuleDetectionType.STATIC,
    }

    detector_workflow = DetectorWorkflow.objects.get(detector=detector)
    assert detector_workflow.workflow == workflow

    assert workflow.when_condition_group is None

    query_subscription = QuerySubscription.objects.get(snuba_query=alert_rule.snuba_query.id)
    data_source = DataSource.objects.get(
        organization_id=alert_rule.organization_id, query_id=query_subscription.id
    )
    assert data_source.type == "snuba_query_subscription"
    detector_state = DetectorState.objects.get(detector=detector)
    assert detector_state.active is False
    assert detector_state.state == str(DetectorPriorityLevel.OK.value)

    data_source_detector = DataSourceDetector.objects.get(data_source=data_source)
    assert data_source_detector.detector == detector


def assert_alert_rule_resolve_trigger_migrated(alert_rule):
    detector_trigger = DataCondition.objects.get(
        comparison=alert_rule.resolve_threshold,
        condition_result=DetectorPriorityLevel.OK,
        type=Condition.LESS_OR_EQUAL,
    )
    detector = AlertRuleDetector.objects.get(alert_rule=alert_rule).detector

    assert detector_trigger.type == Condition.LESS_OR_EQUAL
    assert detector_trigger.condition_result == DetectorPriorityLevel.OK
    assert detector_trigger.condition_group == detector.workflow_condition_group

    data_condition = DataCondition.objects.get(comparison=DetectorPriorityLevel.OK)

    assert data_condition.type == Condition.ISSUE_PRIORITY_EQUALS
    assert data_condition.comparison == DetectorPriorityLevel.OK
    assert data_condition.condition_result is True
    assert WorkflowDataConditionGroup.objects.filter(
        condition_group=data_condition.condition_group
    ).exists()


def assert_alert_rule_trigger_migrated(alert_rule_trigger):
    condition_result = (
        DetectorPriorityLevel.MEDIUM
        if alert_rule_trigger.label == "warning"
        else DetectorPriorityLevel.HIGH
    )
    detector_trigger = DataCondition.objects.get(
        comparison=alert_rule_trigger.alert_threshold,
        condition_result=condition_result,
    )

    assert (
        detector_trigger.type == Condition.GREATER
        if alert_rule_trigger.alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
        else Condition.LESS
    )
    assert detector_trigger.condition_result == condition_result

    data_condition = DataCondition.objects.get(comparison=condition_result, condition_result=True)
    assert data_condition.type == Condition.ISSUE_PRIORITY_EQUALS
    assert data_condition.condition_result is True
    assert WorkflowDataConditionGroup.objects.filter(
        condition_group=data_condition.condition_group
    ).exists()


def assert_alert_rule_trigger_action_migrated(alert_rule_trigger_action, action_type):
    aarta = ActionAlertRuleTriggerAction.objects.get(
        alert_rule_trigger_action=alert_rule_trigger_action
    )
    action = Action.objects.get(id=aarta.action_id, type=action_type)
    assert DataConditionGroupAction.objects.filter(
        action_id=action.id,
    ).exists()


class DualWriteAlertRuleTest(APITestCase):
    def setUp(self):
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        self.metric_alert = self.create_alert_rule(resolve_threshold=2)

    def test_dual_write_metric_alert(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for an alert rule
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        assert_alert_rule_migrated(self.metric_alert, self.project.id)


class BaseMetricAlertMigrationTest(APITestCase, BaseWorkflowTest):
    """
    Base class with helper methods for the ACI metric alert migration.
    """

    def create_metric_alert_lookup_tables(
        self, alert_rule: AlertRule, detector: Detector, workflow: Workflow
    ) -> tuple[AlertRuleDetector, AlertRuleWorkflow]:
        alert_rule_detector = self.create_alert_rule_detector(alert_rule, detector)
        alert_rule_workflow = self.create_alert_rule_workflow(alert_rule, workflow)
        return (
            alert_rule_detector,
            alert_rule_workflow,
        )

    def set_up_migrated_metric_alert_objects(self, metric_alert: AlertRule) -> tuple[
        DataSource,
        DataConditionGroup,
        Workflow,
        Detector,
        DetectorState,
        AlertRuleDetector,
        AlertRuleWorkflow,
        DetectorWorkflow,
        DataSourceDetector,
    ]:
        """
        Set up all the necessary ACI objects for a dual written metric alert. The data is not one to one with
        what we'd expect for a dual written alert, but the types of models are.
        """
        query_subscription = QuerySubscription.objects.get(snuba_query=metric_alert.snuba_query)
        data_source = self.create_data_source(
            organization=self.organization,
            query_id=query_subscription.id,
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        detector_data_condition_group = self.create_data_condition_group(
            organization=self.organization
        )
        (
            workflow,
            detector,
            detector_workflow,
            _,  # the workflow trigger group for a migrated metric alert rule is None
        ) = self.create_detector_and_workflow(workflow_triggers=None)
        detector.update(workflow_condition_group=detector_data_condition_group)
        detector_state = self.create_detector_state(
            detector=detector,
            active=False,
            state=DetectorPriorityLevel.OK,
        )
        data_source_detector = self.create_data_source_detector(data_source, detector)
        (
            alert_rule_detector,
            alert_rule_workflow,
        ) = self.create_metric_alert_lookup_tables(metric_alert, detector, workflow)

        return (
            data_source,
            detector_data_condition_group,
            workflow,
            detector,
            detector_state,
            alert_rule_detector,
            alert_rule_workflow,
            detector_workflow,
            data_source_detector,
        )


class DualDeleteAlertRuleTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        (
            self.data_source,
            self.detector_data_condition_group,
            self.workflow,
            self.detector,
            self.detector_state,
            self.alert_rule_detector,
            self.alert_rule_workflow,
            self.detector_workflow,
            self.data_source_detector,
        ) = self.set_up_migrated_metric_alert_objects(self.metric_alert)

    def test_dual_delete_metric_alert(self):
        dual_delete_migrated_alert_rule(self.metric_alert)
        with self.tasks():
            run_scheduled_deletions()

        # check workflow-related tables
        assert not Workflow.objects.filter(id=self.workflow.id).exists()
        assert not AlertRuleWorkflow.objects.filter(id=self.alert_rule_workflow.id).exists()

        # check detector-related tables
        assert not Detector.objects.filter(id=self.detector.id).exists()
        assert not AlertRuleDetector.objects.filter(id=self.alert_rule_detector.id).exists()
        assert not DetectorWorkflow.objects.filter(id=self.detector_workflow.id).exists()
        assert not DetectorState.objects.filter(id=self.detector_state.id).exists()
        assert not DataSourceDetector.objects.filter(id=self.data_source_detector.id).exists()

        # check data condition groups
        assert not DataConditionGroup.objects.filter(
            id=self.detector_data_condition_group.id
        ).exists()

        # check data source
        assert not DataSource.objects.filter(id=self.data_source.id).exists()


class DualUpdateAlertRuleTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        (
            self.data_source,
            self.detector_data_condition_group,
            self.workflow,
            self.detector,
            self.detector_state,
            self.alert_rule_detector,
            self.alert_rule_workflow,
            self.detector_workflow,
            self.data_source_detector,
        ) = self.set_up_migrated_metric_alert_objects(self.metric_alert)

    def test_dual_update_metric_alert(self):
        detector = self.detector
        detector_state = self.detector_state
        detector_state.update(active=True, state=DetectorPriorityLevel.HIGH)
        updated_fields = {
            "name": "hojicha",
            "description": "a Japanese green tea roasted over charcoal",
        }

        dual_update_migrated_alert_rule(self.metric_alert, updated_fields)
        detector.refresh_from_db()
        detector_state.refresh_from_db()

        assert detector.name == "hojicha"
        assert detector.description == "a Japanese green tea roasted over charcoal"

        assert detector_state.state == str(DetectorPriorityLevel.OK.value)
        assert detector_state.active is False

    def test_dual_update_metric_alert_owner(self):
        detector = self.detector
        updated_fields = {
            "user_id": self.user.id,
            "team_id": None,
        }

        dual_update_migrated_alert_rule(self.metric_alert, updated_fields)
        detector.refresh_from_db()

        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None

    def test_update_metric_alert_config(self):
        detector = self.detector
        updated_fields = {
            "detection_type": "percent",
            "threshold_period": 1,
            "sensitivity": None,
            "seasonality": None,
            "comparison_delta": 3600,
        }

        dual_update_migrated_alert_rule(self.metric_alert, updated_fields)
        detector.refresh_from_db()

        assert detector.config == updated_fields


class DualWriteAlertRuleTriggerTest(APITestCase, BaseWorkflowTest):
    pass

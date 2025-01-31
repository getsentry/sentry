from unittest import mock

import pytest

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.silo.base import SiloMode
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.testutils.silo import assume_test_silo_mode
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
    data_condition_group,
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

    def set_up_migrated_metric_alert_rule_trigger_objects(
        self, alert_rule_trigger: AlertRuleTrigger
    ) -> tuple[DataCondition, DataCondition]:
        """
        Set up all the necessary ACI objects for a dual written metric alert trigger.
        """
        # look up the necessary migrated alert rule objects first
        alert_rule = alert_rule_trigger.alert_rule
        detector = AlertRuleDetector.objects.get(alert_rule=alert_rule).detector
        detector_dcg = detector.workflow_condition_group
        assert detector_dcg  # to appease mypy
        workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule).workflow

        # just hardcode values (we can change them later if necessary)
        detector_trigger = self.create_data_condition(
            comparison=200,
            condition_result=DetectorPriorityLevel.HIGH,
            type=Condition.GREATER,
            condition_group=detector_dcg,
        )
        data_condition_group = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(
            condition_group=data_condition_group, workflow=workflow
        )
        action_filter = self.create_data_condition(
            comparison=DetectorPriorityLevel.HIGH,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_EQUALS,
            condition_group=data_condition_group,
        )

        return detector_trigger, action_filter

    def set_up_migrated_metric_alert_rule_resolve_objects(
        self, alert_rule: AlertRule
    ) -> tuple[DataCondition, DataCondition]:
        """
        Set up all the necessary ACI objects for a dual written metric alert resolution threshold.
        """
        detector = AlertRuleDetector.objects.get(alert_rule=alert_rule).detector
        detector_dcg = detector.workflow_condition_group
        assert detector_dcg  # to appease mypy
        workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule).workflow
        resolve_threshold = (
            alert_rule.resolve_threshold if alert_rule.resolve_threshold is not None else 200
        )  # same as the critical trigger

        # just hardcode values (we can change them later if necessary)
        detector_trigger = self.create_data_condition(
            comparison=resolve_threshold,
            condition_result=DetectorPriorityLevel.OK,
            type=Condition.LESS_OR_EQUAL,
            condition_group=detector_dcg,
        )
        data_condition_group = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(
            condition_group=data_condition_group, workflow=workflow
        )
        action_filter = self.create_data_condition(
            comparison=DetectorPriorityLevel.OK,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_EQUALS,
            condition_group=data_condition_group,
        )

        return detector_trigger, action_filter

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_alert_rule_detector(alert_rule: AlertRule, detector: Detector) -> AlertRuleDetector:
        return AlertRuleDetector.objects.create(alert_rule=alert_rule, detector=detector)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_alert_rule_workflow(alert_rule: AlertRule, workflow: Workflow) -> AlertRuleWorkflow:
        return AlertRuleWorkflow.objects.create(alert_rule=alert_rule, workflow=workflow)


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

    def test_dual_delete_metric_alert_workflow(self):
        dual_delete_migrated_alert_rule(self.metric_alert)
        with self.tasks():
            run_scheduled_deletions()

        # check workflow-related tables
        assert not Workflow.objects.filter(id=self.workflow.id).exists()
        assert not AlertRuleWorkflow.objects.filter(id=self.alert_rule_workflow.id).exists()

    def test_dual_delete_metric_alert_detector(self):
        dual_delete_migrated_alert_rule(self.metric_alert)
        with self.tasks():
            run_scheduled_deletions()

        # check detector-related tables
        assert not Detector.objects.filter(id=self.detector.id).exists()
        assert not AlertRuleDetector.objects.filter(id=self.alert_rule_detector.id).exists()
        assert not DetectorWorkflow.objects.filter(id=self.detector_workflow.id).exists()
        assert not DetectorState.objects.filter(id=self.detector_state.id).exists()
        assert not DataSourceDetector.objects.filter(id=self.data_source_detector.id).exists()
        assert not DataConditionGroup.objects.filter(
            id=self.detector_data_condition_group.id
        ).exists()

    def test_dual_delete_metric_alert_data_source(self):
        dual_delete_migrated_alert_rule(self.metric_alert)
        with self.tasks():
            run_scheduled_deletions()

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
        detector_state = self.detector_state
        detector_state.update(active=True, state=DetectorPriorityLevel.HIGH)
        updated_fields = {
            "name": "hojicha",
            "description": "a Japanese green tea roasted over charcoal",
        }

        dual_update_migrated_alert_rule(self.metric_alert, updated_fields)
        self.detector.refresh_from_db()
        detector_state.refresh_from_db()

        assert self.detector.name == "hojicha"
        assert self.detector.description == "a Japanese green tea roasted over charcoal"

        assert detector_state.state == str(DetectorPriorityLevel.OK.value)
        assert detector_state.active is False

    def test_dual_update_metric_alert_owner(self):
        updated_fields = {
            "user_id": self.user.id,
            "team_id": None,
        }

        dual_update_migrated_alert_rule(self.metric_alert, updated_fields)
        self.detector.refresh_from_db()

        assert self.detector.owner_user_id == self.user.id
        assert self.detector.owner_team_id is None

    def test_update_metric_alert_config(self):
        updated_fields = {
            "detection_type": "percent",
            "threshold_period": 1,
            "sensitivity": None,
            "seasonality": None,
            "comparison_delta": 3600,
        }

        dual_update_migrated_alert_rule(self.metric_alert, updated_fields)
        self.detector.refresh_from_db()

        assert self.detector.config == updated_fields


class DualWriteAlertRuleTriggerTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        self.metric_alert = self.create_alert_rule(resolve_threshold=2)
        self.metric_alert_no_resolve = self.create_alert_rule()
        self.set_up_migrated_metric_alert_objects(self.metric_alert)

        self.alert_rule_trigger_warning = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning"
        )
        self.alert_rule_trigger_critical = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )

    def test_dual_write_metric_alert_trigger(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for an alert rule trigger
        """
        migrate_metric_data_conditions(self.alert_rule_trigger_warning)
        migrate_metric_data_conditions(self.alert_rule_trigger_critical)
        migrate_resolve_threshold_data_conditions(self.metric_alert)

        assert_alert_rule_trigger_migrated(self.alert_rule_trigger_warning)
        assert_alert_rule_trigger_migrated(self.alert_rule_trigger_critical)
        assert_alert_rule_resolve_trigger_migrated(self.metric_alert)


class DualDeleteAlertRuleTriggerTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.set_up_migrated_metric_alert_objects(self.metric_alert)
        self.detector_trigger, self.action_filter = (
            self.set_up_migrated_metric_alert_rule_trigger_objects(self.alert_rule_trigger)
        )

    def test_dual_delete_migrated_alert_rule_trigger(self):
        dual_delete_migrated_alert_rule_trigger(self.alert_rule_trigger)
        assert not DataCondition.objects.filter(id=self.detector_trigger.id).exists()
        assert not DataCondition.objects.filter(id=self.action_filter.id).exists()

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_dual_delete_unmigrated_alert_rule_trigger(self, mock_logger):
        """
        Test that nothing weird happens if we try to dual delete a trigger whose alert rule was
        never dual written.
        """
        metric_alert = self.create_alert_rule()
        unmigrated_trigger = self.create_alert_rule_trigger(alert_rule=metric_alert)
        assert not AlertRuleDetector.objects.filter(alert_rule_id=metric_alert.id).exists()
        dual_delete_migrated_alert_rule_trigger(unmigrated_trigger)
        mock_logger.info.assert_called_with(
            "alert rule was not dual written, returning early",
            extra={"alert_rule": metric_alert},
        )


class DualUpdateAlertRuleTriggerTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical", alert_threshold=200
        )
        self.set_up_migrated_metric_alert_objects(self.metric_alert)
        self.critical_detector_trigger, self.critical_action_filter = (
            self.set_up_migrated_metric_alert_rule_trigger_objects(self.alert_rule_trigger)
        )
        self.resolve_detector_trigger, self.resolve_action_filter = (
            self.set_up_migrated_metric_alert_rule_resolve_objects(self.metric_alert)
        )

    def test_dual_update_metric_alert_threshold_type(self):
        # This field affects the data conditions, but it lives on the alert rule.
        updated_fields = {"threshold_type": AlertRuleThresholdType.BELOW}
        dual_update_migrated_alert_rule(self.metric_alert, updated_fields)

        self.critical_detector_trigger.refresh_from_db()
        self.resolve_detector_trigger.refresh_from_db()

        assert self.critical_detector_trigger.type == Condition.LESS
        assert self.resolve_detector_trigger.type == Condition.GREATER_OR_EQUAL

    def test_dual_update_metric_alert_resolve_threshold(self):
        # This field affects the data conditions, but it lives on the alert rule.
        updated_fields = {"resolve_threshold": 10}
        dual_update_migrated_alert_rule(self.metric_alert, updated_fields)
        self.resolve_detector_trigger.refresh_from_db()

        assert self.resolve_detector_trigger.comparison == 10

    # TODO (mifu67): remaining trigger update tests once those changes land

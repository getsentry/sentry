from unittest import mock

import pytest
from django.forms import ValidationError

from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.logic import update_alert_rule_trigger_action
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.integrations.pagerduty.client import PAGERDUTY_DEFAULT_SEVERITY
from sentry.models.rulesnooze import RuleSnooze
from sentry.notifications.models.notificationaction import ActionService, ActionTarget
from sentry.silo.base import SiloMode
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import (
    PRIORITY_MAP,
    MissingDataConditionGroup,
    dual_delete_migrated_alert_rule,
    dual_delete_migrated_alert_rule_trigger,
    dual_delete_migrated_alert_rule_trigger_action,
    dual_update_migrated_alert_rule,
    dual_update_migrated_alert_rule_trigger,
    dual_update_migrated_alert_rule_trigger_action,
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
        organization_id=alert_rule.organization_id, source_id=str(query_subscription.id)
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


def assert_dual_written_resolution_threshold_equals(alert_rule, threshold):
    # assert that a detector trigger exists with the correct threshold
    assert DataCondition.objects.filter(
        comparison=threshold,
        condition_result=DetectorPriorityLevel.OK,
        type=(
            Condition.LESS_OR_EQUAL
            if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
            else Condition.GREATER_OR_EQUAL
        ),
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


def build_sentry_app_compare_blob(
    sentry_app_config: list[dict[str, str]]
) -> list[dict[str, str | None]]:
    """
    Add the label to the config
    """
    return [{**config, "label": config.get("label", None)} for config in sentry_app_config]


def assert_alert_rule_trigger_action_migrated(alert_rule_trigger_action, action_type):
    aarta = ActionAlertRuleTriggerAction.objects.get(
        alert_rule_trigger_action=alert_rule_trigger_action
    )
    action = Action.objects.get(id=aarta.action_id, type=action_type)
    assert DataConditionGroupAction.objects.filter(
        action_id=action.id,
    ).exists()

    # Additional checks for Sentry app actions
    if action_type == Action.Type.SENTRY_APP:
        # Verify target_identifier is the string representation of sentry_app_id
        assert action.target_identifier == str(alert_rule_trigger_action.sentry_app_id)

        # Verify data blob has correct structure for Sentry apps
        if not alert_rule_trigger_action.sentry_app_config:
            assert action.data == {}
        else:
            assert action.data == {
                "settings": build_sentry_app_compare_blob(
                    alert_rule_trigger_action.sentry_app_config
                ),
            }

    if action_type == Action.Type.OPSGENIE:
        if not alert_rule_trigger_action.sentry_app_config:
            assert action.data == {
                "priority": OPSGENIE_DEFAULT_PRIORITY,
            }
        else:
            assert action.data == {
                "priority": alert_rule_trigger_action.sentry_app_config["priority"],
            }

    if action_type == Action.Type.PAGERDUTY:
        if not alert_rule_trigger_action.sentry_app_config:
            assert action.data == {
                "priority": PAGERDUTY_DEFAULT_SEVERITY,
            }
        else:
            assert action.data == {
                "priority": alert_rule_trigger_action.sentry_app_config["priority"],
            }


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

    def create_migrated_metric_alert_objects(
        self, metric_alert: AlertRule, name="hojicha"
    ) -> tuple[
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
            source_id=str(query_subscription.id),
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
        ) = self.create_detector_and_workflow(workflow_triggers=None, name_prefix=name)
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

    def create_migrated_metric_alert_rule_trigger_objects(
        self,
        alert_rule_trigger: AlertRuleTrigger,
        priority: DetectorPriorityLevel,
        detector_trigger_type: Condition,
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

        detector_trigger = self.create_data_condition(
            comparison=alert_rule_trigger.alert_threshold,
            condition_result=priority,
            type=detector_trigger_type,
            condition_group=detector_dcg,
        )
        data_condition_group = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(
            condition_group=data_condition_group, workflow=workflow
        )
        action_filter = self.create_data_condition(
            comparison=priority,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_EQUALS,
            condition_group=data_condition_group,
        )

        return detector_trigger, action_filter

    def create_migrated_metric_alert_rule_resolve_objects(
        self, alert_rule: AlertRule, resolve_threshold, detector_trigger_type: Condition
    ) -> tuple[DataCondition, DataCondition]:
        """
        Set up all the necessary ACI objects for a dual written metric alert resolution threshold.
        """
        detector = AlertRuleDetector.objects.get(alert_rule=alert_rule).detector
        detector_dcg = detector.workflow_condition_group
        assert detector_dcg  # to appease mypy
        workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule).workflow

        detector_trigger = self.create_data_condition(
            comparison=resolve_threshold,
            condition_result=DetectorPriorityLevel.OK,
            type=detector_trigger_type,
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

    def create_migrated_metric_alert_rule_action_objects(
        self, alert_rule_trigger_action: AlertRuleTriggerAction
    ) -> tuple[Action, DataConditionGroupAction, ActionAlertRuleTriggerAction]:
        """
        Set up all the necessary ACI objects for a dual written metric alert action. The data is not one to one with
        what we'd expect for a dual written legacy action, but the types of models are.
        """
        alert_rule_trigger = alert_rule_trigger_action.alert_rule_trigger
        priority = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)
        action_filter = get_action_filter(alert_rule_trigger, priority)

        action = self.create_action()
        data_condition_group_action = self.create_data_condition_group_action(
            action, action_filter.condition_group
        )
        action_alert_rule_trigger_action = ActionAlertRuleTriggerAction.objects.create(
            action_id=action.id,
            alert_rule_trigger_action_id=alert_rule_trigger_action.id,
        )
        return action, data_condition_group_action, action_alert_rule_trigger_action

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_alert_rule_detector(alert_rule: AlertRule, detector: Detector) -> AlertRuleDetector:
        return AlertRuleDetector.objects.create(alert_rule=alert_rule, detector=detector)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_alert_rule_workflow(alert_rule: AlertRule, workflow: Workflow) -> AlertRuleWorkflow:
        return AlertRuleWorkflow.objects.create(alert_rule=alert_rule, workflow=workflow)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_action_alert_rule_trigger_action(
        action: Action, alert_rule_trigger_action: AlertRuleTriggerAction
    ) -> ActionAlertRuleTriggerAction:
        return ActionAlertRuleTriggerAction.objects.create(
            action=action, alert_rule_trigger_action=alert_rule_trigger_action
        )


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

    def test_dual_write_metric_alert_open_incident(self):
        """
        Test that the detector_state object is correctly created when the alert has an active incident
        """
        self.create_incident(alert_rule=self.metric_alert, status=IncidentStatus.CRITICAL.value)
        aci_objects = migrate_alert_rule(self.metric_alert, self.rpc_user)
        detector_state = aci_objects[4]
        assert detector_state.state == DetectorPriorityLevel.HIGH

    def test_rule_snooze_updates_detector(self):
        aci_objects = migrate_alert_rule(self.metric_alert, self.rpc_user)
        rule_snooze = RuleSnooze.objects.create(alert_rule=self.metric_alert)

        metric_detector = aci_objects[3]
        metric_detector.refresh_from_db()

        assert metric_detector.enabled is False

        rule_snooze.delete()

        metric_detector.refresh_from_db()
        assert metric_detector.enabled is True

    def test_ignores_per_user_rule_snooze(self):
        aci_objects = migrate_alert_rule(self.metric_alert, self.rpc_user)
        RuleSnooze.objects.create(alert_rule=self.metric_alert, user_id=self.user.id)

        metric_detector = aci_objects[3]
        metric_detector.refresh_from_db()
        assert metric_detector.enabled is True


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
        ) = self.create_migrated_metric_alert_objects(self.metric_alert)
        # we need to set up the resolve conditions here, because the dual delete helper expects them
        # their contents don't matter, they just need to exist
        self.resolve_detector_trigger, self.resolve_action_filter = (
            self.create_migrated_metric_alert_rule_resolve_objects(
                self.metric_alert, 67, Condition.LESS_OR_EQUAL
            )
        )

    def test_dual_delete_metric_alert_workflow(self):
        dual_delete_migrated_alert_rule(self.metric_alert)

        # check workflow-related tables
        assert not Workflow.objects.filter(id=self.workflow.id).exists()
        assert not AlertRuleWorkflow.objects.filter(id=self.alert_rule_workflow.id).exists()

    def test_dual_delete_metric_alert_detector(self):
        dual_delete_migrated_alert_rule(self.metric_alert)

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

        # check data source
        assert not DataSource.objects.filter(id=self.data_source.id).exists()

    def test_dual_delete_comprehensive(self):
        """
        If we dual delete an alert rule, the associated ACI objects for its triggers and trigger actions
        also need to be deleted.
        """
        alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical", alert_threshold=200
        )
        alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=alert_rule_trigger
        )

        detector_trigger, action_filter = self.create_migrated_metric_alert_rule_trigger_objects(
            alert_rule_trigger, DetectorPriorityLevel.HIGH, Condition.GREATER
        )
        action_filter_dcg = action_filter.condition_group
        resolve_action_filter_dcg = self.resolve_action_filter.condition_group
        action, data_condition_group_action, aarta = (
            self.create_migrated_metric_alert_rule_action_objects(alert_rule_trigger_action)
        )

        dual_delete_migrated_alert_rule(self.metric_alert)

        # check trigger action objects
        assert not Action.objects.filter(id=action.id).exists()
        assert not DataConditionGroupAction.objects.filter(
            id=data_condition_group_action.id
        ).exists()
        assert not ActionAlertRuleTriggerAction.objects.filter(id=aarta.id).exists()

        # check resolution objects
        assert not DataConditionGroup.objects.filter(id=resolve_action_filter_dcg.id).exists()
        assert not DataCondition.objects.filter(id=self.resolve_detector_trigger.id).exists()
        assert not DataCondition.objects.filter(id=self.resolve_action_filter.id).exists()

        # check trigger objects
        assert not DataConditionGroup.objects.filter(id=action_filter_dcg.id).exists()
        assert not DataCondition.objects.filter(id=detector_trigger.id).exists()
        assert not DataCondition.objects.filter(id=action_filter.id).exists()

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_dual_delete_twice(self, mock_logger):
        """
        Test that nothing happens if dual delete is run twice. We should just quit early the
        second time.
        """
        dual_delete_migrated_alert_rule(self.metric_alert)
        assert not Detector.objects.filter(id=self.detector.id).exists()

        dual_delete_migrated_alert_rule(self.metric_alert)
        mock_logger.info.assert_called_with(
            "alert rule was not dual written or objects were already deleted, returning early",
            extra={"alert_rule_id": self.metric_alert.id},
        )


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
        ) = self.create_migrated_metric_alert_objects(self.metric_alert)

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
        self.create_migrated_metric_alert_objects(self.metric_alert)
        self.create_migrated_metric_alert_objects(self.metric_alert_no_resolve, name="matcha")

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

    def test_dual_write_metric_alert_trigger_auto_resolve(self):
        """
        Test that we create the correct resolution DataConditions when an AlertRule has no explicit resolve threshold
        """
        critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert_no_resolve, label="critical", alert_threshold=500
        )

        migrate_metric_data_conditions(critical_trigger)
        migrate_resolve_threshold_data_conditions(self.metric_alert_no_resolve)

        detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert_no_resolve).detector

        resolve_detector_trigger = DataCondition.objects.get(
            condition_result=DetectorPriorityLevel.OK
        )

        assert resolve_detector_trigger.type == Condition.LESS_OR_EQUAL
        assert resolve_detector_trigger.comparison == critical_trigger.alert_threshold
        assert resolve_detector_trigger.condition_result == DetectorPriorityLevel.OK
        assert resolve_detector_trigger.condition_group == detector.workflow_condition_group

        resolve_data_condition = DataCondition.objects.get(comparison=DetectorPriorityLevel.OK)

        assert resolve_data_condition.type == Condition.ISSUE_PRIORITY_EQUALS
        assert resolve_data_condition.condition_result is True
        assert resolve_data_condition.condition_group == resolve_data_condition.condition_group
        assert WorkflowDataConditionGroup.objects.filter(
            condition_group=resolve_data_condition.condition_group
        ).exists()

    def test_create_metric_alert_trigger_auto_resolve_less_than(self):
        """
        Test that we assign the resolve detector trigger the correct type if the threshold type is BELOW
        """
        self.metric_alert_no_resolve.update(threshold_type=AlertRuleThresholdType.BELOW.value)
        critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert_no_resolve, label="critical", alert_threshold=500
        )

        migrate_metric_data_conditions(critical_trigger)
        migrate_resolve_threshold_data_conditions(self.metric_alert_no_resolve)

        detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert_no_resolve).detector

        resolve_detector_trigger = DataCondition.objects.get(
            condition_result=DetectorPriorityLevel.OK
        )

        assert resolve_detector_trigger.type == Condition.GREATER_OR_EQUAL
        assert resolve_detector_trigger.comparison == critical_trigger.alert_threshold
        assert resolve_detector_trigger.condition_result == DetectorPriorityLevel.OK
        assert resolve_detector_trigger.condition_group == detector.workflow_condition_group


class DualDeleteAlertRuleTriggerTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.create_migrated_metric_alert_objects(self.metric_alert)
        self.detector_trigger, self.action_filter = (
            self.create_migrated_metric_alert_rule_trigger_objects(
                self.alert_rule_trigger, DetectorPriorityLevel.HIGH, Condition.GREATER
            )
        )

    def test_dual_delete_migrated_alert_rule_trigger(self):
        dual_delete_migrated_alert_rule_trigger(self.alert_rule_trigger)
        assert not DataCondition.objects.filter(id=self.detector_trigger.id).exists()
        assert not DataCondition.objects.filter(id=self.action_filter.id).exists()
        assert not DataConditionGroup.objects.filter(
            id=self.action_filter.condition_group.id
        ).exists()

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

    def test_dual_delete_comprehensive(self):
        """
        If we dual delete an alert rule trigger, the associated ACI objects for its trigger actions also need
        to be deleted.
        """
        alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger
        )
        action, data_condition_group_action, aarta = (
            self.create_migrated_metric_alert_rule_action_objects(alert_rule_trigger_action)
        )
        dual_delete_migrated_alert_rule_trigger(self.alert_rule_trigger)

        assert not Action.objects.filter(id=action.id).exists()
        assert not DataConditionGroupAction.objects.filter(
            id=data_condition_group_action.id
        ).exists()
        assert not ActionAlertRuleTriggerAction.objects.filter(id=aarta.id).exists()


class DualUpdateAlertRuleTriggerTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical", alert_threshold=200
        )
        self.create_migrated_metric_alert_objects(self.metric_alert)
        self.critical_detector_trigger, self.critical_action_filter = (
            self.create_migrated_metric_alert_rule_trigger_objects(
                self.alert_rule_trigger, DetectorPriorityLevel.HIGH, Condition.GREATER
            )
        )
        self.resolve_detector_trigger, self.resolve_action_filter = (
            self.create_migrated_metric_alert_rule_resolve_objects(
                self.metric_alert, 200, Condition.LESS_OR_EQUAL
            )
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

    def test_dual_update_trigger_label(self):
        updated_fields = {"label": "warning"}
        dual_update_migrated_alert_rule_trigger(self.alert_rule_trigger, updated_fields)
        # these are now the *warning* dataconditions
        self.critical_detector_trigger.refresh_from_db()
        self.critical_action_filter.refresh_from_db()

        assert self.critical_detector_trigger.condition_result == PRIORITY_MAP["warning"]
        assert self.critical_action_filter.comparison == PRIORITY_MAP["warning"]

    def test_dual_update_trigger_threshold(self):
        updated_fields = {"alert_threshold": 314}
        dual_update_migrated_alert_rule_trigger(self.alert_rule_trigger, updated_fields)
        self.critical_detector_trigger.refresh_from_db()

        assert self.critical_detector_trigger.comparison == 314


class DualWriteAlertRuleTriggerActionTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        # set up legacy objects
        METADATA = {
            "api_key": "1234-ABCD",
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "test-app.app.opsgenie.com",
        }
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        self.og_team = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        self.integration = self.create_provider_integration(
            provider="opsgenie", name="hello-world", external_id="hello-world", metadata=METADATA
        )
        self.sentry_app = self.create_sentry_app(
            name="foo",
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
        self.metric_alert = self.create_alert_rule()
        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical", alert_threshold=200
        )
        self.warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning", alert_threshold=100
        )
        self.alert_rule_trigger_action_email = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.warning_trigger
        )
        self.alert_rule_trigger_action_integration = self.create_alert_rule_trigger_action(
            target_identifier=self.og_team["id"],
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
            alert_rule_trigger=self.critical_trigger,
        )

        self.alert_rule_trigger_action_sentry_app = self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            alert_rule_trigger=self.critical_trigger,
        )
        # set up ACI objects
        self.create_migrated_metric_alert_objects(self.metric_alert)
        self.create_migrated_metric_alert_rule_trigger_objects(
            self.critical_trigger, DetectorPriorityLevel.HIGH, Condition.GREATER
        )
        self.create_migrated_metric_alert_rule_trigger_objects(
            self.warning_trigger, DetectorPriorityLevel.MEDIUM, Condition.GREATER
        )

    def test_dual_write_metric_alert_trigger_action(self):
        migrate_metric_action(self.alert_rule_trigger_action_email)
        migrate_metric_action(self.alert_rule_trigger_action_integration)
        migrate_metric_action(self.alert_rule_trigger_action_sentry_app)

        assert_alert_rule_trigger_action_migrated(
            self.alert_rule_trigger_action_email, Action.Type.EMAIL
        )
        assert_alert_rule_trigger_action_migrated(
            self.alert_rule_trigger_action_integration, Action.Type.OPSGENIE
        )
        assert_alert_rule_trigger_action_migrated(
            self.alert_rule_trigger_action_sentry_app, Action.Type.SENTRY_APP
        )

        # add some additional checks for sentry app and opsgenie actions to test with config
        aarta_sentry_app_with_config = self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            alert_rule_trigger=self.critical_trigger,
            sentry_app_config=[
                {
                    "name": "foo",
                    "value": "bar",
                },
                {
                    "name": "bufo",
                    "value": "bot",
                },
            ],
        )

        aarta_opsgenie_with_config = self.create_alert_rule_trigger_action(
            target_identifier=self.og_team["id"],
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
            alert_rule_trigger=self.critical_trigger,
            sentry_app_config={
                "priority": "p2",
            },
        )

        migrate_metric_action(aarta_sentry_app_with_config)
        migrate_metric_action(aarta_opsgenie_with_config)

        assert_alert_rule_trigger_action_migrated(
            aarta_sentry_app_with_config, Action.Type.SENTRY_APP
        )
        assert_alert_rule_trigger_action_migrated(aarta_opsgenie_with_config, Action.Type.OPSGENIE)

        # broken config, should raise an error
        aarta_sentry_app_with_config.sentry_app_config = {
            "priority": "p2",
        }
        with pytest.raises(ValueError):
            migrate_metric_action(aarta_sentry_app_with_config)

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_dual_write_metric_alert_trigger_action_no_type(self, mock_logger):
        """
        Test that if for some reason we don't find a match for Action.Type for the integration provider we return None and log.
        """
        self.alert_rule_trigger_action_integration.type = 8
        with pytest.raises(ValidationError):
            migrate_metric_action(self.alert_rule_trigger_action_integration)
        mock_logger.warning.assert_called_with(
            "Could not find a matching Action.Type for the trigger action",
            extra={
                "alert_rule_trigger_action_id": self.alert_rule_trigger_action_integration.id,
            },
        )


class DualDeleteAlertRuleTriggerActionTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger
        )

        self.create_migrated_metric_alert_objects(self.metric_alert)
        self.create_migrated_metric_alert_rule_trigger_objects(
            self.alert_rule_trigger, DetectorPriorityLevel.HIGH, Condition.GREATER
        )
        self.action, self.data_condition_group_action, self.aarta = (
            self.create_migrated_metric_alert_rule_action_objects(self.alert_rule_trigger_action)
        )

    def test_dual_delete_migrated_alert_rule_trigger_action(self):
        dual_delete_migrated_alert_rule_trigger_action(self.alert_rule_trigger_action)
        assert not Action.objects.filter(id=self.action.id).exists()
        assert not ActionAlertRuleTriggerAction.objects.filter(id=self.aarta.id).exists()
        assert not DataConditionGroupAction.objects.filter(
            id=self.data_condition_group_action.id
        ).exists()

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_dual_delete_unmigrated_alert_rule_trigger_action(self, mock_logger):
        """
        Test that nothing weird happens if we try to dual delete a trigger action whose alert
        rule was never dual written.
        """
        unmigrated_trigger_action = self.create_alert_rule_trigger_action()
        metric_alert = unmigrated_trigger_action.alert_rule_trigger.alert_rule
        dual_delete_migrated_alert_rule_trigger_action(unmigrated_trigger_action)
        mock_logger.info.assert_called_with(
            "alert rule was not dual written, returning early",
            extra={"alert_rule": metric_alert},
        )

    def test_dual_delete_action_missing_aarta(self):
        """
        Test that we raise an exception if the aarta entry for a migrated trigger action is missing
        """
        self.aarta.delete()
        with pytest.raises(ActionAlertRuleTriggerAction.DoesNotExist):
            dual_delete_migrated_alert_rule_trigger_action(self.alert_rule_trigger_action)


class DualUpdateAlertRuleTriggerActionTest(BaseMetricAlertMigrationTest):
    def setUp(self):
        METADATA = {
            "api_key": "1234-ABCD",
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "test-app.app.opsgenie.com",
        }
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        self.og_team = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        self.integration = self.create_provider_integration(
            provider="opsgenie", name="hello-world", external_id="hello-world", metadata=METADATA
        )
        with assume_test_silo_mode_of(Integration, OrganizationIntegration):
            self.integration.add_organization(self.organization, self.user)
            self.org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.integration.id
            )
            self.org_integration.config = {"team_table": [self.og_team]}
            self.org_integration.save()

        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical", alert_threshold=200
        )
        self.alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger
        )

        self.create_migrated_metric_alert_objects(self.metric_alert)
        self.create_migrated_metric_alert_rule_trigger_objects(
            self.alert_rule_trigger, DetectorPriorityLevel.HIGH, Condition.GREATER
        )
        self.action, self.data_condition_group_action, self.aarta = (
            self.create_migrated_metric_alert_rule_action_objects(self.alert_rule_trigger_action)
        )

    def test_dual_update_trigger_action_type(self):
        rpc_user = user_service.get_user(user_id=self.user.id)
        sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=rpc_user
        )
        self.alert_rule_trigger_action.update(
            target_identifier=sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app_id=sentry_app.id,
        )
        dual_update_migrated_alert_rule_trigger_action(
            self.alert_rule_trigger_action, updated_fields={}
        )  # don't care about updated fields in this test

        self.action.refresh_from_db()
        assert self.action.type == Action.Type.SENTRY_APP

    def test_dual_update_trigger_action_type_invalid(self):
        self.alert_rule_trigger_action.update(type=12345)
        with pytest.raises(ValidationError):
            dual_update_migrated_alert_rule_trigger_action(
                self.alert_rule_trigger_action, updated_fields={}
            )  # don't care about updated fields in this test

    def test_dual_update_trigger_action_legacy_fields(self):
        updated_fields = {
            "integration_id": self.integration.id,
            "target_display": "cool-team",
            "target_identifier": "123-id",
            "target_type": ActionTarget.USER,
        }
        # XXX: This is a bit of a hack, but we update the action's data blob based on the
        # updated trigger action. So we need to update the trigger action first.
        update_alert_rule_trigger_action(
            self.alert_rule_trigger_action,
            type=ActionService.OPSGENIE,
            integration_id=self.integration.id,
            target_identifier="123-id",
            target_type=ActionTarget.USER,
        )
        dual_update_migrated_alert_rule_trigger_action(
            self.alert_rule_trigger_action, updated_fields
        )

        self.action.refresh_from_db()
        assert self.action.integration_id == self.integration.id
        assert self.action.target_display == "cool-team"
        assert self.action.target_identifier == "123-id"
        assert self.action.target_type == ActionTarget.USER

    def test_dual_update_trigger_action_data(self):
        """
        Test that we update the data blob correctly when changing action type
        """
        updated_fields = {
            "integration_id": self.integration.id,
            "target_display": "cool-team",
            "target_identifier": "123-id",
            "target_type": ActionTarget.USER,
        }
        # XXX: This is a bit of a hack, but we update the action's data blob based on the
        # updated trigger action. So we need to update the trigger action first.
        update_alert_rule_trigger_action(
            self.alert_rule_trigger_action,
            type=ActionService.OPSGENIE,
            integration_id=self.integration.id,
            target_identifier="123-id",
            target_type=ActionTarget.USER,
        )
        dual_update_migrated_alert_rule_trigger_action(
            self.alert_rule_trigger_action, updated_fields
        )

        self.action.refresh_from_db()
        assert self.action.data == {"priority": "P3"}
        assert self.action.type == Action.Type.OPSGENIE

    def test_dual_update_trigger_action_data_sentry_app(self):
        sentry_app = self.create_sentry_app(
            name="oolong",
            organization=self.organization,
            is_alertable=True,
            verify_install=False,
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.rpc_user
        )
        sentry_app_trigger_action = self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=sentry_app,
            alert_rule_trigger=self.alert_rule_trigger,
        )
        action, _, _ = migrate_metric_action(sentry_app_trigger_action)
        updated_fields = {
            "sentry_app_config": [
                {
                    "name": "mifu",
                    "value": "matcha",
                },
            ],
            "target_display": "oolong",
            "target_identifier": str(sentry_app.id),
            "target_type": ActionTarget.SENTRY_APP,
        }

        # XXX: This is a bit of a hack, but we update the action's data blob based on the
        # updated trigger action. So we need to update the trigger action first.
        update_alert_rule_trigger_action(
            sentry_app_trigger_action,
            sentry_app_config=[
                {
                    "name": "mifu",
                    "value": "matcha",
                },
            ],
        )
        dual_update_migrated_alert_rule_trigger_action(sentry_app_trigger_action, updated_fields)

        action.refresh_from_db()
        assert action.data["settings"] == [
            {
                "name": "mifu",
                "value": "matcha",
                "label": None,
            },
        ]
        assert action.target_display == "oolong"
        assert action.target_identifier == str(sentry_app.id)
        assert action.target_type == ActionTarget.SENTRY_APP


class CalculateResolveThresholdHelperTest(BaseMetricAlertMigrationTest):
    """
    Tests for get_resolve_threshold(), which calculates the resolution threshold for an alert rule
    if none is explicitly specified.
    """

    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.create_migrated_metric_alert_objects(self.metric_alert)
        self.create_migrated_metric_alert_rule_trigger_objects(
            self.alert_rule_trigger, DetectorPriorityLevel.HIGH, Condition.GREATER
        )

    def test_calculate_resolve_threshold_critical_only(self):
        detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert).detector
        detector_dcg = detector.workflow_condition_group
        assert detector_dcg  # to appease mypy
        resolve_threshold = get_resolve_threshold(detector_dcg)
        assert resolve_threshold == self.alert_rule_trigger.alert_threshold

    def test_calculate_resolve_threshold_with_warning(self):
        warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning", alert_threshold=50
        )
        self.create_migrated_metric_alert_rule_trigger_objects(
            warning_trigger, DetectorPriorityLevel.MEDIUM, Condition.GREATER
        )

        detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert).detector
        detector_dcg = detector.workflow_condition_group
        assert detector_dcg  # to appease mypy
        resolve_threshold = get_resolve_threshold(detector_dcg)
        assert resolve_threshold == warning_trigger.alert_threshold


class DataConditionLookupHelpersTest(BaseMetricAlertMigrationTest):
    """
    Tests for get_detector_trigger() and get_action_filter(), which are used to fetch the ACI
    objects corresponding to an AlertRuleTrigger.
    """

    def setUp(self):
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.create_migrated_metric_alert_objects(self.metric_alert)
        self.detector_trigger, self.action_filter = (
            self.create_migrated_metric_alert_rule_trigger_objects(
                self.alert_rule_trigger, DetectorPriorityLevel.HIGH, Condition.GREATER
            )
        )

    def test_get_detector_trigger(self):
        detector_trigger = get_detector_trigger(self.alert_rule_trigger, DetectorPriorityLevel.HIGH)
        assert detector_trigger == self.detector_trigger

    def test_get_action_filter(self):
        action_filter = get_action_filter(self.alert_rule_trigger, DetectorPriorityLevel.HIGH)
        assert action_filter == self.action_filter

    def test_get_detector_trigger_no_detector_condition_group(self):
        """
        Test that we raise an exception if the corresponding detector for an
        alert rule trigger is missing its workflow condition group.
        """
        detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert).detector
        detector.update(workflow_condition_group=None)

        with pytest.raises(MissingDataConditionGroup):
            get_detector_trigger(self.alert_rule_trigger, DetectorPriorityLevel.HIGH)

    def test_get_detector_trigger_no_detector_trigger(self):
        """
        Test that we raise an exception if the corresponding detector trigger
        for an alert rule trigger is missing.
        """
        self.detector_trigger.delete()
        with pytest.raises(DataCondition.DoesNotExist):
            get_detector_trigger(self.alert_rule_trigger, DetectorPriorityLevel.HIGH)

    def test_get_action_filter_no_workflow(self):
        """
        Test that we raise an exception if the corresponding workflow for an
        alert rule trigger action does not exist.
        """
        workflow = AlertRuleWorkflow.objects.get(alert_rule=self.metric_alert).workflow
        workflow.delete()

        with pytest.raises(AlertRuleWorkflow.DoesNotExist):
            get_action_filter(self.alert_rule_trigger, DetectorPriorityLevel.HIGH)

    def test_get_action_filter_no_action_filter(self):
        """
        Test that we raise an exception if the corresponding action filter for an
        alert rule trigger action does not exist.
        """
        self.action_filter.delete()

        with pytest.raises(DataCondition.DoesNotExist):
            get_action_filter(self.alert_rule_trigger, DetectorPriorityLevel.HIGH)

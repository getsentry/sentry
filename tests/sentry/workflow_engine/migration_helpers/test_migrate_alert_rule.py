from unittest import mock

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import (
    dual_delete_migrated_alert_rule,
    dual_delete_migrated_alert_rule_trigger,
    get_resolve_threshold,
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_conditions,
    update_migrated_alert_rule,
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


def assert_alert_rule_migrated(alert_rule, project_id):
    alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
    alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)

    workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
    assert workflow.name == alert_rule.name
    assert alert_rule.organization
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

    assert alert_rule.snuba_query
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
        type=(
            Condition.LESS_OR_EQUAL
            if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
            else Condition.GREATER_OR_EQUAL
        ),
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
    assert AlertRuleTriggerDataCondition.objects.filter(
        alert_rule_trigger=alert_rule_trigger
    ).exists()

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


class AlertRuleMigrationHelpersTest(APITestCase):
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

        self.metric_alert = self.create_alert_rule(resolve_threshold=2)
        self.alert_rule_trigger_warning = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning"
        )
        self.alert_rule_trigger_critical = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.alert_rule_trigger_action_email = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger_warning
        )
        self.alert_rule_trigger_action_integration = self.create_alert_rule_trigger_action(
            target_identifier=self.og_team["id"],
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
            alert_rule_trigger=self.alert_rule_trigger_critical,
        )

        self.alert_rule_trigger_action_sentry_app = self.create_alert_rule_trigger_action(
            target_identifier=self.sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            alert_rule_trigger=self.alert_rule_trigger_critical,
        )

    def test_create_metric_alert(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for an alert rule
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        assert_alert_rule_migrated(self.metric_alert, self.project.id)

    def test_create_metric_alert_no_data_source(self):
        """
        Test that when we return None and don't create any ACI models if the data source can't be created
        """
        self.metric_alert.update(snuba_query=None)
        migrated = migrate_alert_rule(self.metric_alert, self.rpc_user)
        assert migrated is None
        assert len(DataSource.objects.all()) == 0
        assert not AlertRuleWorkflow.objects.filter(alert_rule=self.metric_alert).exists()
        assert not AlertRuleDetector.objects.filter(alert_rule=self.metric_alert).exists()

    def test_delete_metric_alert(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.metric_alert)
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        detector_workflow = DetectorWorkflow.objects.get(detector=detector)
        data_condition_group = detector.workflow_condition_group
        assert data_condition_group is not None
        assert self.metric_alert.snuba_query
        query_subscription = QuerySubscription.objects.get(
            snuba_query=self.metric_alert.snuba_query.id
        )
        data_source = DataSource.objects.get(
            organization_id=self.metric_alert.organization_id, query_id=query_subscription.id
        )
        detector_state = DetectorState.objects.get(detector=detector)
        data_source_detector = DataSourceDetector.objects.get(data_source=data_source)

        dual_delete_migrated_alert_rule(self.metric_alert)
        with self.tasks():
            run_scheduled_deletions()

        # check workflow-related tables
        assert not Workflow.objects.filter(id=workflow.id).exists()
        assert not AlertRuleWorkflow.objects.filter(id=alert_rule_workflow.id).exists()

        # check detector-related tables
        assert not Detector.objects.filter(id=detector.id).exists()
        assert not DetectorWorkflow.objects.filter(id=detector_workflow.id).exists()
        assert not DetectorState.objects.filter(id=detector_state.id).exists()
        assert not DataSourceDetector.objects.filter(id=data_source_detector.id).exists()

        # check data condition group
        assert not DataConditionGroup.objects.filter(id=data_condition_group.id).exists()

        # check data source
        assert not DataSource.objects.filter(id=data_source.id).exists()

    def test_create_metric_alert_trigger(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for alert rule triggers
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_conditions(self.alert_rule_trigger_warning)
        migrate_metric_data_conditions(self.alert_rule_trigger_critical)
        migrate_resolve_threshold_data_conditions(self.metric_alert)

        assert_alert_rule_trigger_migrated(self.alert_rule_trigger_warning)
        assert_alert_rule_trigger_migrated(self.alert_rule_trigger_critical)
        assert_alert_rule_resolve_trigger_migrated(self.metric_alert)

    def test_calculate_resolve_threshold_critical_only(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_conditions(self.alert_rule_trigger_critical)

        detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert).detector
        detector_dcg = detector.workflow_condition_group
        assert detector_dcg
        resolve_threshold = get_resolve_threshold(detector_dcg)
        assert resolve_threshold == self.alert_rule_trigger_critical.alert_threshold

    def test_calculate_resolve_threshold_with_warning(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_conditions(self.alert_rule_trigger_warning)
        migrate_metric_data_conditions(self.alert_rule_trigger_critical)

        detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert).detector
        detector_dcg = detector.workflow_condition_group
        assert detector_dcg
        resolve_threshold = get_resolve_threshold(detector_dcg)
        assert resolve_threshold == self.alert_rule_trigger_warning.alert_threshold

    def test_create_metric_alert_trigger_auto_resolve(self):
        """
        Test that we create the correct resolution DataConditions when an AlertRule has no explicit resolve threshold
        """
        metric_alert = self.create_alert_rule()
        critical_trigger = self.create_alert_rule_trigger(alert_rule=metric_alert, label="critical")

        migrate_alert_rule(metric_alert, self.rpc_user)
        migrate_metric_data_conditions(critical_trigger)
        migrate_resolve_threshold_data_conditions(metric_alert)

        detector = AlertRuleDetector.objects.get(alert_rule=metric_alert).detector

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
        metric_alert = self.create_alert_rule(threshold_type=AlertRuleThresholdType.BELOW)
        critical_trigger = self.create_alert_rule_trigger(alert_rule=metric_alert, label="critical")

        migrate_alert_rule(metric_alert, self.rpc_user)
        migrate_metric_data_conditions(critical_trigger)
        migrate_resolve_threshold_data_conditions(metric_alert)

        detector = AlertRuleDetector.objects.get(alert_rule=metric_alert).detector

        resolve_detector_trigger = DataCondition.objects.get(
            condition_result=DetectorPriorityLevel.OK
        )

        assert resolve_detector_trigger.type == Condition.GREATER_OR_EQUAL
        assert resolve_detector_trigger.comparison == critical_trigger.alert_threshold
        assert resolve_detector_trigger.condition_result == DetectorPriorityLevel.OK
        assert resolve_detector_trigger.condition_group == detector.workflow_condition_group

    def test_create_metric_alert_trigger_action(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for alert rule trigger actions
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)

        migrate_metric_data_conditions(self.alert_rule_trigger_warning)
        migrate_metric_data_conditions(self.alert_rule_trigger_critical)

        migrate_metric_action(self.alert_rule_trigger_action_email)
        migrate_metric_action(self.alert_rule_trigger_action_integration)
        migrate_metric_action(self.alert_rule_trigger_action_sentry_app)

        # we can cheat a bit, because only one alert rule's triggers have been migrated
        action_filters = DataCondition.objects.filter(
            comparison__in=[
                DetectorPriorityLevel.MEDIUM,
                DetectorPriorityLevel.HIGH,
            ]
        )
        data_condition_group_actions = DataConditionGroupAction.objects.filter(
            condition_group_id__in=[
                action_filter.condition_group.id for action_filter in action_filters
            ]
        )
        actions = Action.objects.filter(
            id__in=[item.action.id for item in data_condition_group_actions]
        )
        assert len(actions) == 3

        assert actions[0].type.lower() == Action.Type.EMAIL
        assert actions[1].type.lower() == Action.Type.OPSGENIE
        assert actions[2].type.lower() == Action.Type.SENTRY_APP

        aartas = ActionAlertRuleTriggerAction.objects.filter(
            id__in=[item.action.id for item in data_condition_group_actions]
        )
        assert len(aartas) == 3

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_create_metric_alert_trigger_action_no_type(self, mock_logger):
        """
        Test that if for some reason we don't find a match for Action.Type for the integration provider we return None and log.
        """
        with assume_test_silo_mode_of(Integration, OrganizationIntegration):
            self.integration.update(provider="hellboy")
            self.integration.save()

        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_conditions(self.alert_rule_trigger_critical)
        migrated = migrate_metric_action(self.alert_rule_trigger_action_integration)
        assert migrated is None
        mock_logger.warning.assert_called_with(
            "Could not find a matching Action.Type for the trigger action",
            extra={
                "alert_rule_trigger_action_id": self.alert_rule_trigger_action_integration.id,
            },
        )

    def test_update_metric_alert(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        updated_fields = {
            "name": "hojicha",
            "description": "a Japanese green tea roasted over charcoal",
        }

        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert)
        detector = alert_rule_detector.detector
        assert detector.name == self.metric_alert.name
        assert detector.description == self.metric_alert.description
        detector_state = DetectorState.objects.get(detector=detector)
        detector_state.update(
            active=True, state=DetectorPriorityLevel.HIGH
        )  # so we can confirm that our update actually changes things
        assert detector_state.active

        update_migrated_alert_rule(self.metric_alert, updated_fields)
        detector.refresh_from_db()
        detector_state.refresh_from_db()

        assert detector.name == "hojicha"
        assert detector.description == "a Japanese green tea roasted over charcoal"

        assert detector_state.state == str(DetectorPriorityLevel.OK.value)
        assert detector_state.active is False

    def test_update_metric_alert_owner(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        updated_fields = {
            "user_id": self.user.id,
            "team_id": None,
        }
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert)
        detector = alert_rule_detector.detector
        assert detector.owner_user_id == self.metric_alert.user_id
        assert detector.owner_team_id == self.metric_alert.team_id

        update_migrated_alert_rule(self.metric_alert, updated_fields)
        detector.refresh_from_db()

        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None

    def test_update_metric_alert_config(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        updated_fields = {
            "detection_type": "percent",
            "threshold_period": 1,
            "sensitivity": None,
            "seasonality": None,
            "comparison_delta": 3600,
        }
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.metric_alert)
        detector = alert_rule_detector.detector
        config = detector.config
        assert config == {
            "detection_type": "static",
            "threshold_period": 1,
            "sensitivity": None,
            "seasonality": None,
            "comparison_delta": None,
        }

        update_migrated_alert_rule(self.metric_alert, updated_fields)
        detector.refresh_from_db()

        assert detector.config == updated_fields

    def test_update_metric_alert_threshold_type(self):
        metric_alert = self.create_alert_rule()
        critical_trigger = self.create_alert_rule_trigger(alert_rule=metric_alert, label="critical")

        migrate_alert_rule(metric_alert, self.rpc_user)
        migrate_metric_data_conditions(critical_trigger)
        migrate_resolve_threshold_data_conditions(metric_alert)
        # because there are only two objects in the DB
        critical_detector_trigger = DataCondition.objects.get(
            condition_result=DetectorPriorityLevel.HIGH
        )
        resolve_detector_trigger = DataCondition.objects.get(
            condition_result=DetectorPriorityLevel.OK
        )

        assert critical_detector_trigger.type == Condition.GREATER
        assert resolve_detector_trigger.type == Condition.LESS_OR_EQUAL

        updated_fields = {"threshold_type": AlertRuleThresholdType.BELOW}
        update_migrated_alert_rule(metric_alert, updated_fields)

        critical_detector_trigger.refresh_from_db()
        resolve_detector_trigger.refresh_from_db()

        assert critical_detector_trigger.type == Condition.LESS
        assert resolve_detector_trigger.type == Condition.GREATER_OR_EQUAL

    def test_update_metric_alert_resolve_threshold(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_conditions(self.alert_rule_trigger_critical)
        migrate_resolve_threshold_data_conditions(self.metric_alert)

        resolve_detector_trigger = DataCondition.objects.get(
            condition_result=DetectorPriorityLevel.OK
        )
        assert resolve_detector_trigger.comparison == 2

        updated_fields = {"resolve_threshold": 10}
        update_migrated_alert_rule(self.metric_alert, updated_fields)
        resolve_detector_trigger.refresh_from_db()

        assert resolve_detector_trigger.comparison == 10

    def test_dual_delete_migrated_alert_rule_trigger(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        data_conditions = migrate_metric_data_conditions(self.alert_rule_trigger_critical)
        assert data_conditions is not None
        detector_trigger, action_filter = data_conditions

        detector_trigger_id = detector_trigger.id
        action_filter_id = action_filter.id
        dual_delete_migrated_alert_rule_trigger(self.alert_rule_trigger_critical)
        assert not DataCondition.objects.filter(id=detector_trigger_id).exists()
        assert not DataCondition.objects.filter(id=action_filter_id).exists()

    def test_dual_delete_migrated_alert_rule_trigger_action(self):
        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_conditions(self.alert_rule_trigger_critical)
        migrate_metric_action(self.alert_rule_trigger_action_email)

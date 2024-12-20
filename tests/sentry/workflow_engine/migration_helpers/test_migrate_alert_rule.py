from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from unittest import mock

from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import (
    dual_delete_migrated_alert_rule,
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
    DataConditionGroup,
    DataCondition,
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

        self.metric_alert = self.create_alert_rule()
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

        assert workflow.when_condition_group is None

        assert self.metric_alert.snuba_query
        query_subscription = QuerySubscription.objects.get(
            snuba_query=self.metric_alert.snuba_query.id
        )
        data_source = DataSource.objects.get(
            organization_id=self.metric_alert.organization_id, query_id=query_subscription.id
        )
        assert data_source.type == "snuba_query_subscription"
        detector_state = DetectorState.objects.get(detector=detector)
        assert detector_state.active is False
        assert detector_state.state == str(DetectorPriorityLevel.OK.value)

        data_source_detector = DataSourceDetector.objects.get(data_source=data_source)
        assert data_source_detector.detector == detector

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
        migrate_metric_data_condition(self.alert_rule_trigger_warning)
        migrate_metric_data_condition(self.alert_rule_trigger_critical)

        alert_rule_trigger_data_conditions = AlertRuleTriggerDataCondition.objects.filter(
            alert_rule_trigger__in=[
                self.alert_rule_trigger_critical,
                self.alert_rule_trigger_warning,
            ]
        )
        assert len(alert_rule_trigger_data_conditions) == 2
        data_condition_group_id = alert_rule_trigger_data_conditions[
            0
        ].data_condition.condition_group.id
        data_conditions = DataCondition.objects.filter(condition_group=data_condition_group_id)
        assert len(data_conditions) == 2
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=self.metric_alert)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        data_condition_group = workflow.when_condition_group

        assert data_conditions[0].type == Condition.GREATER
        assert data_conditions[0].comparison == self.alert_rule_trigger_warning.alert_threshold
        assert data_conditions[0].condition_result == DetectorPriorityLevel.MEDIUM
        assert data_conditions[0].condition_group == data_condition_group

        assert data_conditions[1].type == Condition.GREATER
        assert data_conditions[1].comparison == self.alert_rule_trigger_critical.alert_threshold
        assert data_conditions[1].condition_result == DetectorPriorityLevel.HIGH
        assert data_conditions[1].condition_group == data_condition_group

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_create_metric_alert_trigger_no_alert_rule_detector(self, mock_logger):
        create_data_source(self.organization.id, self.metric_alert.snuba_query)
        data_condition_group = create_data_condition_group(self.organization.id)
        create_workflow(
            self.metric_alert.name, self.organization.id, data_condition_group, self.rpc_user
        )
        create_detector(self.metric_alert, self.project.id, data_condition_group, self.rpc_user)
        # skip creating lookup tables
        migrate_metric_data_condition(self.alert_rule_trigger_critical)
        mock_logger.exception.assert_called_with(
            "AlertRuleDetector does not exist",
            extra={
                "alert_rule_id": self.alert_rule_trigger_critical.alert_rule.id,
            },
        )

    def test_create_metric_alert_trigger_action(self):
        """
        Test that when we call the helper methods we create all the ACI models correctly for alert rule trigger actions
        """
        migrate_alert_rule(self.metric_alert, self.rpc_user)

        migrate_metric_data_condition(self.alert_rule_trigger_warning)
        migrate_metric_data_condition(self.alert_rule_trigger_critical)

        migrate_metric_action(self.alert_rule_trigger_action_email)
        migrate_metric_action(self.alert_rule_trigger_action_integration)
        migrate_metric_action(self.alert_rule_trigger_action_sentry_app)

        alert_rule_trigger_data_condition = AlertRuleTriggerDataCondition.objects.filter(
            alert_rule_trigger__in=[
                self.alert_rule_trigger_warning,
                self.alert_rule_trigger_critical,
            ]
        )
        data_condition_group_id = alert_rule_trigger_data_condition[
            0
        ].data_condition.condition_group.id
        data_condition_group_actions = DataConditionGroupAction.objects.filter(
            condition_group_id=data_condition_group_id
        )
        action = Action.objects.filter(
            id__in=[item.action.id for item in data_condition_group_actions]
        )
        assert len(action) == 3

        assert action[0].type.lower() == Action.Type.EMAIL
        assert action[1].type.lower() == Action.Type.OPSGENIE
        assert action[2].type.lower() == Action.Type.SENTRY_APP

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_create_metric_alert_trigger_action_no_alert_rule_trigger_data_condition(
        self, mock_logger
    ):
        """
        Test that if the AlertRuleTriggerDataCondition doesn't exist we return None and log.
        """
        other_metric_alert = self.create_alert_rule()
        other_alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=other_metric_alert)

        migrate_alert_rule(other_metric_alert, self.rpc_user)
        migrate_metric_data_condition(other_alert_rule_trigger)
        migrated_action = migrate_metric_action(self.alert_rule_trigger_action_email)
        assert migrated_action is None
        mock_logger.exception.assert_called_with(
            "AlertRuleTriggerDataCondition does not exist",
            extra={
                "alert_rule_trigger_id": self.alert_rule_trigger_warning.id,
            },
        )

    @mock.patch("sentry.workflow_engine.migration_helpers.alert_rule.logger")
    def test_create_metric_alert_trigger_action_no_type(self, mock_logger):
        """
        Test that if for some reason we don't find a match for Action.Type for the integration provider we return None and log.
        """
        with assume_test_silo_mode_of(Integration, OrganizationIntegration):
            self.integration.update(provider="hellboy")
            self.integration.save()

        migrate_alert_rule(self.metric_alert, self.rpc_user)
        migrate_metric_data_condition(self.alert_rule_trigger_critical)
        migrated = migrate_metric_action(self.alert_rule_trigger_action_integration)
        assert migrated is None
        mock_logger.warning.assert_called_with(
            "Could not find a matching Action.Type for the trigger action",
            extra={
                "alert_rule_trigger_action_id": self.alert_rule_trigger_action_integration.id,
            },
        )

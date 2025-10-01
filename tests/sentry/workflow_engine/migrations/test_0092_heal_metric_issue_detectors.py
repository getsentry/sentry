from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleThresholdType, AlertRuleTriggerAction
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.services.user.service import user_service
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
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestHealMetricIssueDetectors(TestMigrations):
    migrate_from = "0091_fix_email_notification_names"
    migrate_to = "0092_heal_metric_issue_detectors"
    app = "workflow_engine"

    def create_detector_and_state(self, rule):
        """
        The detector and detector_state objects already exist and are correct
        for these rules. Replicate the filtering conditions for the detectors,
        but the other data doesn't matter.
        """
        detector = self.create_detector(type=MetricIssue.slug, workflow_condition_group=None)
        self.create_alert_rule_detector(detector=detector, alert_rule_id=rule.id)
        self.create_detector_state(detector=detector)
        return detector

    def setup_initial_state(self):
        self.valid_rule = self.create_alert_rule(name="hojicha")
        self.valid_detector = self.create_detector_and_state(self.valid_rule)
        self.valid_trigger = self.create_alert_rule_trigger(
            alert_rule=self.valid_rule, label="critical", alert_threshold=250
        )
        self.valid_warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.valid_rule, label="warning", alert_threshold=100
        )
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
        self.rule_with_resolve = self.create_alert_rule(resolve_threshold=50)
        self.create_alert_rule_trigger(alert_rule=self.rule_with_resolve)
        self.create_detector_and_state(self.rule_with_resolve)

        self.rule_lt = self.create_alert_rule(
            threshold_type=AlertRuleThresholdType.BELOW
        )  # rule with threshold type == less than
        self.create_alert_rule_trigger(alert_rule=self.rule_lt)
        self.create_detector_and_state(self.rule_lt)

        self.skipped_rule = self.create_alert_rule()
        self.create_detector_and_state(self.skipped_rule)
        self.skipped_trigger = self.create_alert_rule_trigger(alert_rule=self.skipped_rule)
        self.bad_action = self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            alert_rule_trigger=self.skipped_trigger,
            sentry_app_config=[{"favorite_tea": "strawberry matcha latte with oat milk"}],
        )

        super().setup_initial_state()

    def test_simple(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.valid_rule.id)

        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        assert workflow.name == get_workflow_name(self.valid_rule)
        assert workflow.organization_id == self.valid_rule.organization.id

        detector_workflow = DetectorWorkflow.objects.get(detector=self.valid_detector)
        assert detector_workflow.workflow == workflow

        assert workflow.when_condition_group is None

        query_subscription = QuerySubscription.objects.get(
            snuba_query=self.valid_rule.snuba_query.id
        )
        data_source = DataSource.objects.get(
            organization_id=self.valid_rule.organization_id, source_id=str(query_subscription.id)
        )
        assert data_source.type == "snuba_query_subscription"

        data_source_detector = DataSourceDetector.objects.get(data_source=data_source)
        assert data_source_detector.detector == self.valid_detector

    def test_simple_trigger(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.valid_rule.id)
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=self.valid_rule.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)

        # critical trigger
        detector_trigger = DataCondition.objects.get(
            comparison=self.valid_trigger.alert_threshold,
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        assert detector_trigger.type == Condition.GREATER

        assert DataConditionAlertRuleTrigger.objects.filter(
            data_condition=detector_trigger, alert_rule_trigger_id=self.valid_trigger.id
        ).exists()

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

        # warning trigger
        detector_trigger = DataCondition.objects.get(
            comparison=self.valid_warning_trigger.alert_threshold,
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.MEDIUM,
        )

        assert detector_trigger.type == Condition.GREATER

        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        fire_action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.MEDIUM,
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
        )
        assert fire_action_filter.condition_result is True

        resolve_action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.MEDIUM,
            type=Condition.ISSUE_PRIORITY_DEESCALATING,
        )
        assert resolve_action_filter.condition_result is True

    def test_flipped_trigger(self):
        """
        Test that we handle AlertRuleThresholdType.BELOW appropriately
        """
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=self.rule_lt.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)

        detector_trigger = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        assert detector_trigger.type == Condition.LESS

        resolve_detector_trigger = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.OK,
        )

        assert resolve_detector_trigger.comparison == detector_trigger.comparison
        assert resolve_detector_trigger.type == Condition.GREATER_OR_EQUAL

    def test_simple_resolve(self):
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=self.valid_rule.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)

        detector_trigger = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.OK,
        )

        assert detector_trigger.comparison == self.valid_warning_trigger.alert_threshold
        assert detector_trigger.type == Condition.LESS_OR_EQUAL

    def test_explicit_resolve(self):
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=self.rule_with_resolve.id)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)

        detector_trigger = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.OK,
        )

        assert detector_trigger.comparison == self.rule_with_resolve.resolve_threshold
        assert detector_trigger.type == Condition.LESS_OR_EQUAL

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

    def test_on_call_trigger_action(self):
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
        assert action.config.get("target_display") == self.integration_action.target_display
        assert action.config.get("target_identifier") == self.integration_action.target_identifier
        assert action.config.get("target_type") == self.integration_action.target_type

    def test_sentry_app_trigger_action(self):
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
            alert_rule_trigger_action_id=self.sentry_app_action.id
        )
        action = aarta.action
        DataConditionGroupAction.objects.get(
            condition_group_id=action_filter.condition_group.id,
            action=action.id,
        )

        assert action.type == Action.Type.SENTRY_APP
        assert action.data == {
            "settings": [{"label": None, "name": "assignee", "value": "michelle"}]
        }
        assert action.integration_id is None
        assert action.config.get("target_display") == self.sentry_app_action.target_display
        assert action.config.get("target_identifier") == self.sentry_app_action.target_identifier
        assert action.config.get("target_type") == self.sentry_app_action.target_type
        assert action.config.get("sentry_app_identifier") == "sentry_app_id"

    def test_create_error(self):
        """
        Test that none of the ACI objects are written to the DB if an exception occurs, and test that
        an exception doesn't crash the migration.
        """
        assert not AlertRuleDetector.objects.filter(alert_rule_id=self.skipped_rule.id).exists()

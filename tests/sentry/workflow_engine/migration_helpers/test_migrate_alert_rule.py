from sentry.incidents.grouptype import MetricAlertFire
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import APITestCase
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_alert_rule
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


class AlertRuleMigrationHelpersTest(APITestCase):
    def setUp(self):
        self.metric_alert = self.create_alert_rule()
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

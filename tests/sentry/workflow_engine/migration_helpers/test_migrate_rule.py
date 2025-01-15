from sentry.grouping.grouptype import ErrorGroupType
from sentry.rules.age import AgeComparisonType
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.testutils.cases import APITestCase
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.rule import migrate_issue_alert
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition


class RuleMigrationHelpersTest(APITestCase):
    def setUp(self):
        conditions = [
            {"id": ReappearedEventCondition.id},
            {"id": RegressionEventCondition.id},
            {
                "id": AgeComparisonFilter.id,
                "comparison_type": AgeComparisonType.OLDER,
                "value": "10",
                "time": "hour",
            },
        ]
        self.issue_alert = self.create_project_rule(
            name="test", condition_data=conditions, action_match="any", filter_match="any"
        )
        self.rpc_user = user_service.get_user(user_id=self.user.id)

    def test_create_issue_alert(self):
        # TODO(cathy): update after filters have condition handlers and the action registry is merged
        pass

    def test_create_issue_alert_no_actions(self):
        migrate_issue_alert(self.issue_alert, self.rpc_user)

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        issue_alert_detector = AlertRuleDetector.objects.get(rule=self.issue_alert)

        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        assert workflow.name == self.issue_alert.label
        assert self.issue_alert.project
        assert workflow.organization_id == self.issue_alert.project.organization.id
        assert workflow.config == {"frequency": 30}

        detector = Detector.objects.get(id=issue_alert_detector.detector.id)
        assert detector.name == "Error Detector"
        assert detector.project_id == self.project.id
        assert detector.enabled is True
        assert detector.owner_user_id is None
        assert detector.owner_team is None
        assert detector.type == ErrorGroupType.slug
        assert detector.config == {}

        detector_workflow = DetectorWorkflow.objects.get(detector=detector)
        assert detector_workflow.workflow == workflow

        assert workflow.when_condition_group
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 2
        assert conditions.filter(
            type=Condition.REAPPEARED_EVENT, comparison=True, condition_result=True
        ).exists()
        assert conditions.filter(
            type=Condition.REGRESSION_EVENT, comparison=True, condition_result=True
        ).exists()

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert if_dcg.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        filters = DataCondition.objects.filter(condition_group=if_dcg)
        assert filters.count() == 1
        assert filters.filter(
            type=Condition.AGE_COMPARISON,
            comparison={
                "comparison_type": AgeComparisonType.OLDER,
                "value": 10,
                "time": "hour",
            },
            condition_result=True,
        ).exists()
        assert DataConditionGroupAction.objects.filter(condition_group=if_dcg).count() == 0

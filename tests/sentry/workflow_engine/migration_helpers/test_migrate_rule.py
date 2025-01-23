from sentry.grouping.grouptype import ErrorGroupType
from sentry.rules.age import AgeComparisonType
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.rules.filters.latest_release import LatestReleaseFilter
from sentry.testutils.cases import APITestCase
from sentry.types.actor import Actor
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.rule import (
    UpdatedIssueAlertData,
    delete_migrated_issue_alert,
    migrate_issue_alert,
    update_migrated_issue_alert,
)
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

    def test_update_issue_alert(self):
        # TODO: update after action registry is merged
        pass

    def test_update_issue_alert_no_actions(self):
        migrate_issue_alert(self.issue_alert, self.rpc_user)
        conditions_payload = [
            {
                "id": FirstSeenEventCondition.id,
            },
            {
                "id": LatestReleaseFilter.id,
            },
        ]
        payload: UpdatedIssueAlertData = {
            "name": "hello world",
            "owner": Actor.from_id(user_id=self.user.id),
            "environment": self.environment.id,
            "action_match": "none",
            "filter_match": "all",
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "conditions": conditions_payload,
            "frequency": 60,
        }
        update_migrated_issue_alert(self.issue_alert, payload)

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        assert workflow.name == payload["name"]
        assert self.issue_alert.project
        assert workflow.organization_id == self.issue_alert.project.organization.id
        assert workflow.config == {"frequency": 60}
        assert workflow.owner_user_id == self.user.id
        assert workflow.owner_team_id is None

        assert workflow.when_condition_group
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.NONE

        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 1
        assert conditions.filter(
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        ).exists()

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert if_dcg.logic_type == DataConditionGroup.Type.ALL
        filters = DataCondition.objects.filter(condition_group=if_dcg)
        assert filters.count() == 1
        assert filters.filter(
            type=Condition.LATEST_RELEASE,
            comparison=True,
            condition_result=True,
        ).exists()

        assert DataConditionGroupAction.objects.filter(condition_group=if_dcg).count() == 0

    def test_required_fields_only(self):
        migrate_issue_alert(self.issue_alert, self.rpc_user)
        payload: UpdatedIssueAlertData = {
            "name": "hello world",
            "owner": None,
            "environment": None,
            "conditions": [],
            "action_match": "none",
            "filter_match": None,
            "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            "frequency": None,
        }
        update_migrated_issue_alert(self.issue_alert, payload)

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        assert workflow.environment is None
        assert workflow.owner_user_id is None
        assert workflow.owner_team_id is None
        assert workflow.config == {"frequency": workflow.DEFAULT_FREQUENCY}

        assert workflow.when_condition_group
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.NONE

        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 0

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert if_dcg.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        filters = DataCondition.objects.filter(condition_group=if_dcg)
        assert filters.count() == 0

    def test_delete_issue_alert(self):
        # TODO: update after action registry is merged
        pass

    def test_delete_issue_alert_no_actions(self):
        migrate_issue_alert(self.issue_alert, self.rpc_user)

        alert_rule_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        workflow = alert_rule_workflow.workflow
        when_dcg = workflow.when_condition_group
        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group

        assert when_dcg is not None
        assert if_dcg is not None

        conditions = DataCondition.objects.filter(condition_group=when_dcg)
        assert conditions.count() == 2
        filters = DataCondition.objects.filter(condition_group=if_dcg)
        assert filters.count() == 1

        delete_migrated_issue_alert(self.issue_alert)

        assert not AlertRuleWorkflow.objects.filter(rule=self.issue_alert).exists()
        assert not Workflow.objects.filter(id=workflow.id).exists()
        assert not DataConditionGroup.objects.filter(id=when_dcg.id).exists()
        assert not DataConditionGroup.objects.filter(id=if_dcg.id).exists()
        assert not DataCondition.objects.filter(condition_group=when_dcg).exists()
        assert not DataCondition.objects.filter(condition_group=if_dcg).exists()

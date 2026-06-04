from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.rule import RuleSource
from sentry.projects.project_rules.creator import ProjectRuleCreator
from sentry.testutils.cases import TestCase
from sentry.types.actor import Actor
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataConditionGroupAction,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class TestProjectRuleCreator(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.org = self.create_organization(name="bloop", owner=self.user)
        self.project = self.create_project(
            teams=[self.create_team()], name="foo", fire_project_created=True
        )

        self.creator = ProjectRuleCreator(
            name="New Cool Rule",
            owner=Actor.from_id(user_id=self.user.id),
            project=self.project,
            action_match="any",
            filter_match="all",
            conditions=[
                {
                    "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                    "key": "foo",
                    "match": "eq",
                    "value": "bar",
                },
                {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": "foo",
                    "match": "is",
                },
            ],
            actions=[
                {
                    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                    "name": "Send a notification (for all legacy integrations)",
                }
            ],
            environment=self.environment.id,
            frequency=5,
            source=RuleSource.ISSUE,
        )

    def test_create_rule_and_workflow(self) -> None:
        rule = self.creator.run()

        rule_id = rule.id
        alert_rule_detector = AlertRuleDetector.objects.get(rule_id=rule_id)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(rule_id=rule_id)

        detector = alert_rule_detector.detector
        assert detector.project_id == self.project.id
        assert detector.type == ErrorGroupType.slug

        assert Detector.objects.get(project=self.project, type=IssueStreamGroupType.slug)

        workflow = alert_rule_workflow.workflow
        assert workflow.config["frequency"] == 5
        assert workflow.owner_user_id == self.user.id
        assert workflow.owner_team_id is None
        assert workflow.environment_id == self.environment.id

        when_dcg = workflow.when_condition_group
        assert when_dcg
        assert when_dcg.logic_type == "any-short"
        assert len(when_dcg.conditions.all()) == 1

        data_condition = list(when_dcg.conditions.all())[0]
        assert data_condition.type == Condition.FIRST_SEEN_EVENT

        action_filter = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert action_filter.logic_type == "all"

        assert len(action_filter.conditions.all()) == 1
        data_condition = list(action_filter.conditions.all())[0]
        assert data_condition.type == Condition.TAGGED_EVENT
        assert data_condition.comparison == {"key": "foo", "match": "is"}

        action = DataConditionGroupAction.objects.get(condition_group=action_filter).action
        assert action.type == Action.Type.PLUGIN

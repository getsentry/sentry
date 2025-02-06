from sentry.grouping.grouptype import ErrorGroupType
from sentry.projects.project_rules.updater import ProjectRuleUpdater
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.types.actor import Actor
from sentry.users.models.user import User
from sentry.workflow_engine.migration_helpers.rule import migrate_issue_alert
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataConditionGroupAction,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition


class TestUpdater(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(name="bloop", owner=self.user)
        self.project = self.create_project(
            teams=[self.create_team()], name="foo", fire_project_created=True
        )
        self.rule = self.project.rule_set.all()[0]
        self.updater = ProjectRuleUpdater(rule=self.rule, project=self.project)

    def test_update_name(self):
        self.updater.name = "Cool New Rule"
        self.updater.run()
        assert self.rule.label == "Cool New Rule"

    def test_update_owner(self):
        self.updater.owner = Actor.from_id(user_id=self.user.id)
        self.updater.run()
        with assume_test_silo_mode_of(User):
            self.user = User.objects.get(id=self.user.id)

        assert (self.rule.owner_user_id, self.rule.owner_team_id) == (self.user.id, None)

        team = self.create_team()
        self.updater.owner = Actor.from_id(team_id=team.id)
        self.updater.run()

        assert (self.rule.owner_user_id, self.rule.owner_team_id) == (None, team.id)

        self.updater.owner = None
        self.updater.run()
        assert self.rule.owner_team_id is None
        assert self.rule.owner_user_id is None

    def test_update_environment(self):
        self.updater.environment = 3
        self.updater.run()
        assert self.rule.environment_id == 3

    def test_update_environment_when_none(self):
        self.rule.environment_id = 3
        self.rule.save()
        assert self.rule.environment_id == 3
        self.updater.run()
        assert self.rule.environment_id is None

    def test_update_project(self):
        project2 = self.create_project(organization=self.org)
        self.updater.project = project2
        self.updater.run()
        assert self.rule.project == project2

    def test_update_actions(self):
        self.updater.actions = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification (for all legacy integrations)",
            }
        ]
        self.updater.run()
        assert self.rule.data["actions"] == [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
            }
        ]

    def test_update_action_match(self):
        self.updater.action_match = "any"
        self.updater.run()
        assert self.rule.data["action_match"] == "any"

    def test_update_filter_match(self):
        self.updater.filter_match = "any"
        self.updater.run()
        assert self.rule.data["filter_match"] == "any"

    def test_update_conditions(self):
        self.updater.conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]
        self.updater.run()
        assert self.rule.data["conditions"] == [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "key": "foo",
                "match": "eq",
                "value": "bar",
            }
        ]

    def test_update_frequency(self):
        self.updater.frequency = 5
        self.updater.run()
        assert self.rule.data["frequency"] == 5

    @with_feature("organizations:workflow-engine-issue-alert-dual-write")
    def test_dual_create_workflow_engine(self):
        migrate_issue_alert(self.rule, user_id=self.user.id)

        conditions = [
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
        ]
        new_user_id = self.create_user().id

        ProjectRuleUpdater(
            rule=self.rule,
            name="Updated Rule",
            owner=Actor.from_id(new_user_id),
            project=self.project,
            action_match="all",
            filter_match="any",
            conditions=conditions,
            environment=None,
            actions=[
                {
                    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                    "name": "Send a notification (for all legacy integrations)",
                }
            ],
            frequency=5,
        ).run()

        alert_rule_detector = AlertRuleDetector.objects.get(rule_id=self.rule.id)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(rule_id=self.rule.id)

        detector = alert_rule_detector.detector
        assert detector.project_id == self.project.id
        assert detector.type == ErrorGroupType.slug

        workflow = alert_rule_workflow.workflow
        assert workflow.config["frequency"] == 5
        assert workflow.owner_user_id == new_user_id
        assert workflow.owner_team_id is None
        assert workflow.environment is None

        when_dcg = workflow.when_condition_group
        assert when_dcg
        assert when_dcg.logic_type == "all"
        assert len(when_dcg.conditions.all()) == 1

        data_condition = list(when_dcg.conditions.all())[0]
        assert data_condition.type == Condition.FIRST_SEEN_EVENT

        action_filter = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert action_filter.logic_type == "any-short"

        assert len(action_filter.conditions.all()) == 1
        data_condition = list(action_filter.conditions.all())[0]
        assert data_condition.type == Condition.TAGGED_EVENT
        assert data_condition.comparison == {"key": "foo", "match": "is"}

        action = DataConditionGroupAction.objects.get(condition_group=action_filter).action
        assert action.type == Action.Type.PLUGIN

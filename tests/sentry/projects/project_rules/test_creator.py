from sentry.models.rule import Rule
from sentry.projects.project_rules.creator import ProjectRuleCreator
from sentry.testutils.cases import TestCase
from sentry.types.actor import Actor


class TestProjectRuleCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(name="bloop", owner=self.user)
        self.project = self.create_project(
            teams=[self.create_team()], name="foo", fire_project_created=True
        )

        self.creator = ProjectRuleCreator(
            name="New Cool Rule",
            owner=Actor.from_id(user_id=self.user.id),
            project=self.project,
            action_match="all",
            filter_match="any",
            conditions=[
                {
                    "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                    "key": "foo",
                    "match": "eq",
                    "value": "bar",
                }
            ],
            actions=[
                {
                    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                    "name": "Send a notification (for all legacy integrations)",
                }
            ],
            frequency=5,
        )

    def test_creates_rule(self):
        r = self.creator.run()
        rule = Rule.objects.get(id=r.id)
        assert rule.label == "New Cool Rule"
        assert rule.owner_user_id == self.user.id
        assert rule.owner_team_id is None
        assert rule.project == self.project
        assert rule.environment_id is None
        assert rule.data == {
            "actions": [
                {
                    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                }
            ],
            "conditions": [
                {
                    "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                    "key": "foo",
                    "match": "eq",
                    "value": "bar",
                }
            ],
            "action_match": "all",
            "filter_match": "any",
            "frequency": 5,
        }

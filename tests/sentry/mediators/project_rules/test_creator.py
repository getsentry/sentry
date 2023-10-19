from sentry.mediators.project_rules.creator import Creator
from sentry.models.actor import get_actor_for_user, get_actor_id_for_user
from sentry.models.rule import Rule
from sentry.models.user import User
from sentry.testutils.cases import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(name="bloop", owner=self.user)
        self.project = self.create_project(
            teams=[self.create_team()], name="foo", fire_project_created=True
        )

        self.user = User.objects.get(id=self.user.id)
        self.creator = Creator(
            name="New Cool Rule",
            owner=get_actor_id_for_user(self.user),
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
        r = self.creator.call()
        rule = Rule.objects.get(id=r.id)
        assert rule.label == "New Cool Rule"
        assert rule.owner == get_actor_for_user(self.user)
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

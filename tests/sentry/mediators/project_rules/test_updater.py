from __future__ import absolute_import

from sentry.mediators.project_rules import Updater
from sentry.testutils import TestCase


class TestUpdater(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(name="bloop", owner=self.user)
        self.project = self.create_project(
            teams=[self.create_team()], name="foo", fire_project_created=True
        )
        self.rule = self.project.rule_set.all()[0]
        self.updater = Updater(rule=self.rule, project=self.project)

    def test_update_name(self):
        self.updater.name = "Cool New Rule"
        self.updater.call()
        assert self.rule.label == "Cool New Rule"

    def test_update_environment(self):
        self.updater.environment = 3
        self.updater.call()
        assert self.rule.environment_id == 3

    def test_update_environment_when_none(self):
        self.rule.environment_id = 3
        self.rule.save()
        assert self.rule.environment_id == 3
        self.updater.call()
        assert self.rule.environment_id is None

    def test_update_project(self):
        project2 = self.create_project(organization=self.org)
        self.updater.project = project2
        self.updater.call()
        assert self.rule.project == project2

    def test_update_actions(self):
        self.updater.actions = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification (for all legacy integrations)",
            }
        ]
        self.updater.call()
        assert self.rule.data["actions"] == [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification (for all legacy integrations)",
            }
        ]

    def test_update_action_match(self):
        self.updater.action_match = "any"
        self.updater.call()
        assert self.rule.data["action_match"] == "any"

    def test_update_filter_match(self):
        self.updater.filter_match = "any"
        self.updater.call()
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
        self.updater.call()
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
        self.updater.call()
        assert self.rule.data["frequency"] == 5

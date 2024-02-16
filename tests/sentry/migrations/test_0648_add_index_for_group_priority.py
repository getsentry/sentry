from uuid import UUID

from sentry.testutils.cases import TestMigrations


class BackfillAddUuidToAllRuleActions(TestMigrations):
    migrate_from = "0647_apitoken_add_hashed_columns"
    migrate_to = "0648_add_index_for_group_priority"

    def setup_before_migration(self, apps):
        # Create your db state here
        self.notify_event_action = [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}]
        self.rule = self.create_project_rule(action_match=self.notify_event_action)

    def test(self):
        # Test state after migration
        self.rule.refresh_from_db()
        actions = self.rule.data["actions"]
        assert len(actions) == len(self.notify_event_action)
        action = actions[0]
        assert "uuid" in action
        assert UUID(action["uuid"])

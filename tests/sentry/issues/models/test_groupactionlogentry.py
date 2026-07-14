from sentry.issues.action_log.types import (
    AssignAction,
    GroupActionType,
    GroupActorType,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.testutils.cases import TestCase


class GroupActionLogEntryActionPropertyTest(TestCase):
    def test_action_property_deserializes_data(self) -> None:
        entry = self.create_group_action_log_entry(
            type=GroupActionType.ASSIGN,
            actor_type=GroupActorType.USER,
            actor_id=self.user.id,
            data={"assignee": "user:42", "assignee_type": "user"},
        )

        loaded = GroupActionLogEntry.objects.get(id=entry.id)
        action = loaded.action

        assert isinstance(action, AssignAction)
        assert action.assignee == "user:42"
        assert action.assignee_type == "user"

    def test_action_property_is_cached(self) -> None:
        entry = self.create_group_action_log_entry(
            type=GroupActionType.ASSIGN,
            data={"assignee": "user:1", "assignee_type": "user"},
        )
        loaded = GroupActionLogEntry.objects.get(id=entry.id)

        assert loaded.action is loaded.action

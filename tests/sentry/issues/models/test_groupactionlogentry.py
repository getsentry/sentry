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


class GroupActionLogEntryManagerTest(TestCase):
    def test_user_visible_excludes_non_visible_types(self) -> None:
        visible = self.create_group_action_log_entry(
            type=GroupActionType.ASSIGN,
            data={"assignee": "user:1", "assignee_type": "user"},
        )
        # VIEW is not user-visible
        self.create_group_action_log_entry(type=GroupActionType.VIEW)
        # RECONCILE_STATUS is not user-visible
        self.create_group_action_log_entry(
            type=GroupActionType.RECONCILE_STATUS,
            data={"status": "open"},
        )

        qs = GroupActionLogEntry.objects.user_visible()
        assert list(qs.values_list("id", flat=True)) == [visible.id]

    def test_user_visible_chains_with_other_filters(self) -> None:
        group2 = self.create_group()
        self.create_group_action_log_entry(
            type=GroupActionType.RESOLVE,
        )
        entry = self.create_group_action_log_entry(
            group=group2,
            type=GroupActionType.RESOLVE,
        )

        qs = GroupActionLogEntry.objects.user_visible().filter(group_id=group2.id)
        assert list(qs.values_list("id", flat=True)) == [entry.id]

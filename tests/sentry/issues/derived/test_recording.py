from sentry.issues.derived.recording import record
from sentry.issues.derived.types import IssueActionType, ViewAction
from sentry.models.issueactionlogentry import ActorType, IssueActionLogEntry
from sentry.testutils.cases import TestCase


class RecordTest(TestCase):
    def test_creates_log_entry(self) -> None:
        group = self.create_group()

        entry = record(
            group_id=group.id,
            project_id=group.project_id,
            action=ViewAction(),
            user_id=self.user.id,
        )

        assert entry.group_id == group.id
        assert entry.project_id == group.project_id
        assert entry.type == IssueActionType.VIEW
        assert entry.actor_id == self.user.id
        assert entry.actor_type == ActorType.USER
        assert entry.data == {}
        assert entry.date_added is not None

    def test_system_action(self) -> None:
        group = self.create_group()

        entry = record(
            group_id=group.id,
            project_id=group.project_id,
            action=ViewAction(),
            user_id=None,
        )

        assert entry.actor_type == ActorType.SYSTEM
        assert entry.actor_id == 0

    def test_multiple_entries_ordered(self) -> None:
        group = self.create_group()

        for _ in range(3):
            record(
                group_id=group.id,
                project_id=group.project_id,
                action=ViewAction(),
                user_id=self.user.id,
            )

        entries = list(
            IssueActionLogEntry.objects.filter(group_id=group.id).order_by("date_added", "id")
        )
        assert len(entries) == 3
        assert entries[0].id < entries[1].id < entries[2].id

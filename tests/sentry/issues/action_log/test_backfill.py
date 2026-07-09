from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from sentry.issues.action_log.backfill import (
    BACKFILL_ACTIVITY_SOURCE,
    BackfillEntry,
    backfill_actions,
    backfill_group_activities,
)
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    GroupAction,
    GroupActionActor,
    GroupActionType,
    GroupActorType,
    ResolveAction,
    ViewAction,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class BackfillActionsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.now = timezone.now()

    def _entry(
        self,
        *,
        minutes_ago: int = 0,
        key: str = "k",
        action: GroupAction | None = None,
        actor: GroupActionActor = SYSTEM_ACTOR,
        source: str = "test",
    ) -> BackfillEntry:
        return BackfillEntry(
            action=action or ViewAction(),
            actor=actor,
            source=source,
            date_added=self.now - timedelta(minutes=minutes_ago),
            idempotency_key=key,
        )

    def test_empty_entries(self) -> None:
        result = backfill_actions(entries=[], group_id=self.group.id, project_id=self.project.id)
        assert result == 0

    def test_creates_entries(self) -> None:
        entries = [
            self._entry(minutes_ago=2, key="a"),
            self._entry(minutes_ago=1, key="b"),
        ]
        count = backfill_actions(
            entries=entries, group_id=self.group.id, project_id=self.project.id
        )
        assert count == 2
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2

    def test_sets_fields_correctly(self) -> None:
        entry = self._entry(
            key="x", actor=GroupActionActor.user(42), source="web", action=ResolveAction()
        )
        backfill_actions(entries=[entry], group_id=self.group.id, project_id=self.project.id)
        row = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert row.group_id == self.group.id
        assert row.project_id == self.project.id
        assert row.type == GroupActionType.RESOLVE.value
        assert row.actor_type == GroupActorType.USER.value
        assert row.actor_id == 42
        assert row.source == "web"
        assert row.idempotency_key == "x"
        assert row.date_added == entry.date_added

    def test_skips_duplicates(self) -> None:
        entries = [self._entry(key="dup")]
        assert (
            backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)
            == 1
        )
        assert (
            backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)
            == 0
        )
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_skips_only_conflicting_entries(self) -> None:
        backfill_actions(
            entries=[self._entry(key="existing")],
            group_id=self.group.id,
            project_id=self.project.id,
        )
        entries = [
            self._entry(minutes_ago=2, key="existing"),
            self._entry(minutes_ago=1, key="new"),
        ]
        count = backfill_actions(
            entries=entries, group_id=self.group.id, project_id=self.project.id
        )
        assert count == 1
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2

    def test_same_key_different_group_no_conflict(self) -> None:
        other_group = self.create_group()
        backfill_actions(
            entries=[self._entry(key="shared")],
            group_id=self.group.id,
            project_id=self.project.id,
        )
        count = backfill_actions(
            entries=[self._entry(key="shared")],
            group_id=other_group.id,
            project_id=self.project.id,
        )
        assert count == 1

    def test_rejects_unsorted_entries(self) -> None:
        entries = [
            self._entry(minutes_ago=0, key="a"),
            self._entry(minutes_ago=5, key="b"),
        ]
        with pytest.raises(ValueError, match="sorted"):
            backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)

    @patch("sentry.issues.action_log.backfill.invalidate_group_derived_data")
    def test_invalidates_with_earliest_cursor(self, mock_invalidate: MagicMock) -> None:
        entries = [
            self._entry(minutes_ago=5, key="a"),
            self._entry(minutes_ago=1, key="b"),
        ]
        backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)
        mock_invalidate.assert_called_once_with(self.group.id, cursor=(entries[0].date_added, 0))

    @patch("sentry.issues.action_log.backfill.invalidate_group_derived_data")
    def test_no_invalidation_when_all_duplicates(self, mock_invalidate: MagicMock) -> None:
        entries = [self._entry(key="x")]
        backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)
        mock_invalidate.reset_mock()
        count = backfill_actions(
            entries=entries, group_id=self.group.id, project_id=self.project.id
        )
        assert count == 0
        mock_invalidate.assert_not_called()


class BackfillGroupActivitiesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.now = timezone.now()

    def test_empty_group(self) -> None:
        count = backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert count == 0
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

    def test_translates_activities(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            datetime=self.now - timedelta(minutes=2),
        )
        self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": "123", "assigneeType": "user"},
            datetime=self.now - timedelta(minutes=1),
        )
        count = backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert count == 2
        entries = list(
            GroupActionLogEntry.objects.filter(group_id=self.group.id).order_by("date_added")
        )
        assert entries[0].type == GroupActionType.RESOLVE.value
        assert entries[1].type == GroupActionType.ASSIGN.value

    def test_sets_actor_from_user_id(self) -> None:
        user = self.create_user()
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            user_id=user.id,
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.USER.value
        assert entry.actor_id == user.id

    def test_sets_system_actor_when_no_user(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.AUTO_SET_ONGOING.value,
            data={},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.SYSTEM.value
        assert entry.actor_id == 0

    def test_uses_backfill_source(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.source == BACKFILL_ACTIVITY_SOURCE

    def test_idempotency_key_uses_activity_id(self) -> None:
        act = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.idempotency_key == f"activity:{act.id}"

    def test_skips_untranslatable_activities(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.FIRST_SEEN.value,
            data={"priority": 1},
        )
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        count = backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert count == 1

    def test_idempotent_on_rerun(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": "1"},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2

    def test_processes_in_batches(self) -> None:
        for i in range(5):
            self.create_group_activity(
                group=self.group,
                type=ActivityType.SET_RESOLVED.value,
                data={},
                datetime=self.now - timedelta(minutes=5 - i),
            )
        count = backfill_group_activities(
            group_id=self.group.id, project_id=self.project.id, batch_size=2
        )
        assert count == 5
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 5

    def test_does_not_affect_other_groups(self) -> None:
        other_group = self.create_group()
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        self.create_group_activity(
            group=other_group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1
        assert GroupActionLogEntry.objects.filter(group_id=other_group.id).count() == 0

    def test_preserves_activity_datetime(self) -> None:
        ts = self.now - timedelta(days=30)
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            datetime=ts,
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.date_added == ts

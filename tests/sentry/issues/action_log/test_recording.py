import pytest

from sentry.issues.action_log.base import ActionSource
from sentry.issues.action_log.recording import DuplicateActionError, record_group_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    GroupActionActor,
    GroupActionType,
    GroupActorType,
    ViewAction,
)
from sentry.issues.groupactionlogentry import GroupActionLogEntry
from sentry.testutils.cases import TestCase


class RecordTest(TestCase):
    def test_creates_log_entry(self) -> None:
        group = self.create_group()

        entry = record_group_action(
            group_id=group.id,
            project_id=group.project_id,
            action=ViewAction(),
            actor=GroupActionActor.user(self.user.id),
            source=ActionSource.API,
        )

        assert entry.group_id == group.id
        assert entry.project_id == group.project_id
        assert entry.type == GroupActionType.VIEW
        assert entry.actor_id == self.user.id
        assert entry.actor_type == GroupActorType.USER
        assert entry.source == ActionSource.API
        assert entry.data == {}
        assert entry.date_added is not None

    def test_system_action(self) -> None:
        group = self.create_group()

        entry = record_group_action(
            group_id=group.id,
            project_id=group.project_id,
            action=ViewAction(),
            actor=SYSTEM_ACTOR,
            source=ActionSource.SYSTEM,
        )

        assert entry.actor_type == GroupActorType.SYSTEM
        assert entry.actor_id == 0

    def test_multiple_entries_ordered(self) -> None:
        group = self.create_group()

        for _ in range(3):
            record_group_action(
                group_id=group.id,
                project_id=group.project_id,
                action=ViewAction(),
                actor=GroupActionActor.user(self.user.id),
                source=ActionSource.API,
            )

        entries = list(
            GroupActionLogEntry.objects.filter(group_id=group.id).order_by("date_added", "id")
        )
        assert len(entries) == 3
        assert entries[0].id < entries[1].id < entries[2].id

    def test_duplicate_idempotency_key_raises(self) -> None:
        group = self.create_group()
        kwargs = dict(
            group_id=group.id,
            project_id=group.project_id,
            action=ViewAction(),
            actor=GroupActionActor.user(self.user.id),
            source=ActionSource.API,
            idempotency_key="view-123",
        )

        record_group_action(**kwargs)

        with pytest.raises(DuplicateActionError):
            record_group_action(**kwargs)

        assert GroupActionLogEntry.objects.filter(group_id=group.id).count() == 1

import pytest

from sentry.issues.action_log.base import ActionSource, DuplicateActionError, publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    GroupActionActor,
    GroupActionType,
    GroupActorType,
    ViewAction,
)
from sentry.issues.groupactionlogentry import GroupActionLogEntry
from sentry.testutils.cases import TestCase


class PublishActionWriteTest(TestCase):
    def _publish(self, **overrides):
        group = overrides.pop("group", None) or self.create_group()
        defaults = dict(
            source=ActionSource.API,
            group_id=group.id,
            organization_id=group.project.organization_id,
            project_id=group.project_id,
            actor=GroupActionActor.user(self.user.id),
        )
        defaults.update(overrides)
        action = defaults.pop("action", ViewAction())
        with self.options({"issues.action-log.write-to-db": True}):
            publish_action(action, **defaults)
        return group

    def test_creates_log_entry(self) -> None:
        group = self._publish()

        entry = GroupActionLogEntry.objects.get(group_id=group.id)
        assert entry.group_id == group.id
        assert entry.project_id == group.project_id
        assert entry.type == GroupActionType.VIEW
        assert entry.actor_id == self.user.id
        assert entry.actor_type == GroupActorType.USER
        assert entry.source == ActionSource.API
        assert entry.data == {}
        assert entry.date_added is not None

    def test_system_action(self) -> None:
        group = self._publish(actor=SYSTEM_ACTOR, source=ActionSource.SYSTEM)

        entry = GroupActionLogEntry.objects.get(group_id=group.id)
        assert entry.actor_type == GroupActorType.SYSTEM
        assert entry.actor_id == 0

    def test_multiple_entries_ordered(self) -> None:
        group = self.create_group()

        for _ in range(3):
            self._publish(group=group)

        entries = list(
            GroupActionLogEntry.objects.filter(group_id=group.id).order_by("date_added", "id")
        )
        assert len(entries) == 3
        assert entries[0].id < entries[1].id < entries[2].id

    def test_duplicate_idempotency_key_raises(self) -> None:
        group = self.create_group()

        self._publish(group=group, idempotency_key="view-123")

        with pytest.raises(DuplicateActionError):
            self._publish(group=group, idempotency_key="view-123")

        assert GroupActionLogEntry.objects.filter(group_id=group.id).count() == 1

    def test_option_disabled_skips_write(self) -> None:
        group = self.create_group()

        with self.options({"issues.action-log.write-to-db": False}):
            publish_action(
                ViewAction(),
                source=ActionSource.API,
                group_id=group.id,
                organization_id=group.project.organization_id,
                project_id=group.project_id,
                actor=GroupActionActor.user(self.user.id),
            )

        assert GroupActionLogEntry.objects.filter(group_id=group.id).count() == 0

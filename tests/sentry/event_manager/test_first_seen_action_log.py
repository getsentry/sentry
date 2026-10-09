from sentry.issues.action_log.backfill import BackfillEntry, backfill_actions
from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    ActionSource,
    FirstSeenAction,
    GroupActionType,
    GroupActorType,
    first_seen_idempotency_key,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupactionlogoutbox import GroupActionLogOutbox
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.action_log import capture_action_log
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.skips import requires_snuba


@requires_snuba
class FirstSeenActionLogTest(TestCase):
    def _store(self, fingerprint: str = "group-1") -> int:
        event = self.store_event(
            data={
                "message": "oh no",
                "fingerprint": [fingerprint],
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group_id is not None
        return event.group_id

    def test_publishes_first_seen_on_group_creation(self) -> None:
        with capture_action_log() as log:
            group_id = self._store()

        group = Group.objects.get(id=group_id)
        log.assert_logged(
            FirstSeenAction,
            group_id=group_id,
            source=ActionSource.SYSTEM,
            actor=SYSTEM_ACTOR,
            first_seen=group.first_seen,
        )

    def test_not_republished_for_existing_group(self) -> None:
        group_id = self._store()

        with capture_action_log() as log:
            assert self._store() == group_id

        log.assert_not_logged(FirstSeenAction)

    def test_outbox_is_not_flushed_on_commit(self) -> None:
        group_id = self._store()

        assert GroupActionLogOutbox.objects.filter(shard_identifier=group_id).exists()
        assert not GroupActionLogEntry.objects.filter(
            group_id=group_id, type=GroupActionType.FIRST_SEEN
        ).exists()

    def test_entry_written_with_idempotency_key_after_drain(self) -> None:
        with outbox_runner():
            group_id = self._store()

        entry = GroupActionLogEntry.objects.get(group_id=group_id, type=GroupActionType.FIRST_SEEN)
        assert entry.idempotency_key == f"first_seen:{group_id}"
        assert entry.project_id == self.project.id
        assert entry.actor_type == GroupActorType.SYSTEM
        assert entry.source == ActionSource.SYSTEM
        assert entry.data == {"first_seen": Group.objects.get(id=group_id).first_seen.isoformat()}

    @with_feature({"projects:issue-action-log-write-to-db": False})
    def test_no_outbox_when_write_disabled(self) -> None:
        group_id = self._store()

        assert not GroupActionLogOutbox.objects.filter(shard_identifier=group_id).exists()


class FirstSeenIdempotencyTest(TestCase):
    def test_backfill_dedupes_against_live_entry(self) -> None:
        group = self.create_group()
        with outbox_runner():
            publish_action(
                FirstSeenAction(first_seen=group.first_seen.isoformat()),
                source=ActionSource.SYSTEM,
                group_id=group.id,
                project=self.project,
                idempotency_key=first_seen_idempotency_key(group.id),
            )

        inserted = backfill_actions(
            entries=[
                BackfillEntry(
                    action=FirstSeenAction(first_seen=group.first_seen.isoformat()),
                    actor=SYSTEM_ACTOR,
                    source="backfill:first-seen",
                    date_added=group.first_seen,
                    idempotency_key=first_seen_idempotency_key(group.id),
                )
            ],
            group_id=group.id,
            project_id=self.project.id,
        )

        assert inserted == 0
        assert (
            GroupActionLogEntry.objects.filter(
                group_id=group.id, type=GroupActionType.FIRST_SEEN
            ).count()
            == 1
        )

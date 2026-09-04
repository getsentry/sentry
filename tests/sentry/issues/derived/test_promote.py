from collections.abc import Generator
from contextlib import contextmanager
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone as django_timezone

from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    ActionSource,
    GroupAction,
    GroupActionActor,
    GroupActionType,
    GroupActorType,
    ResolveAction,
    ViewAction,
)
from sentry.issues.derived import processing
from sentry.issues.derived.processing import PIPELINE, GroupLogTimeout, process_group_log
from sentry.issues.derived.promote import (
    PromotionFailed,
    PromotionResult,
    _generation_cache,
    _read_live_generated_at,
    build_and_promote_batch,
    build_and_promote_derived_data,
    promote_to_live,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner

SOURCE = ActionSource.API


def _publish(*, group: Group, action: GroupAction, actor: GroupActionActor = SYSTEM_ACTOR) -> None:
    with outbox_runner():
        publish_action(
            action,
            source=SOURCE,
            group_id=group.id,
            project=group.project,
            actor=actor,
        )


@contextmanager
def _hide_first_row_read() -> Generator[None]:
    """Hide the live row from promote_to_live's first existence probe.

    Opens the TOCTOU window between that probe and the INSERT, so the
    INSERT loses the create race and raises IntegrityError.
    """
    seen = iter([True])

    def hide_once(group_id: int) -> datetime | None:
        if next(seen, False):
            return None
        return _read_live_generated_at(group_id)

    with patch("sentry.issues.derived.promote._read_live_generated_at", hide_once):
        yield


@with_feature("projects:issue-action-log-write-to-db")
class PromoteToLiveTest(TestCase):
    def test_promote_inserts_when_no_row(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        GroupDerivedData.objects.filter(group_id=group.id).delete()

        gen_time = django_timezone.now()
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=gen_time,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        processing._drain_log(candidate, PIPELINE, time_limit=timedelta(minutes=5), persist=False)
        assert promote_to_live(candidate) is PromotionResult.PROMOTED

        live = GroupDerivedData.objects.get(group_id=group.id)
        assert live.view_count == 1
        assert live.generated_at == gen_time

    def test_build_and_promote_raises_for_deleted_group(self) -> None:
        nonexistent_group_id = 999999999
        with pytest.raises(Group.DoesNotExist):
            build_and_promote_derived_data(nonexistent_group_id, time_limit=timedelta(minutes=5))

    def test_promote_updates_existing_row(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        old = process_group_log(group.id)
        old_id = old.id

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        gen_time = django_timezone.now()
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=gen_time,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        processing._drain_log(candidate, PIPELINE, time_limit=timedelta(minutes=5), persist=False)
        assert promote_to_live(candidate) is PromotionResult.PROMOTED

        live = GroupDerivedData.objects.get(group_id=group.id)
        assert live.id == old_id
        assert live.view_count == 2
        assert live.generated_at == gen_time

    def test_promote_rejected_if_cursor_behind_despite_newer_generation(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        # Incremental processing advances the cursor past the first entry.
        process_group_log(group.id)

        # A newer generation only processed the first entry (cursor behind).
        gen_time = django_timezone.now()
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=gen_time,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        processing._process_batch(PIPELINE, candidate, batch_size=1, persist=False)

        # Despite having a newer generated_at, the cursor is behind —
        # promote must not regress the cursor.
        assert promote_to_live(candidate) is PromotionResult.CURSOR_BEHIND

    def test_promote_ignores_known_invalid_log_id(self) -> None:
        group = self.create_group()
        invalid_log_id = 99999
        self.create_group_derived_data(
            group,
            cursor_date=django_timezone.now(),
            cursor_id=invalid_log_id,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=django_timezone.now(),
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )

        assert (
            promote_to_live(candidate, known_invalid_log_id=invalid_log_id)
            is PromotionResult.PROMOTED
        )

    def test_promote_does_not_ignore_different_invalid_log_id(self) -> None:
        group = self.create_group()
        self.create_group_derived_data(
            group,
            cursor_date=django_timezone.now(),
            cursor_id=99999,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=django_timezone.now(),
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )

        assert (
            promote_to_live(candidate, known_invalid_log_id=99998) is PromotionResult.CURSOR_BEHIND
        )

    def test_promote_superseded_by_newer_generation(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)

        newer_time = django_timezone.now()
        GroupDerivedData.objects.filter(group_id=group.id).update(generated_at=newer_time)

        old_time = newer_time - timedelta(seconds=10)
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=old_time,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        processing._drain_log(candidate, PIPELINE, time_limit=timedelta(minutes=5), persist=False)
        assert promote_to_live(candidate) is PromotionResult.SUPERSEDED

    def test_promote_create_race_returns_superseded_when_winner_is_newer(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        gen_time = django_timezone.now()
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=gen_time,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        processing._drain_log(candidate, PIPELINE, time_limit=timedelta(minutes=5), persist=False)

        newer_time = gen_time + timedelta(seconds=10)
        GroupDerivedData.objects.filter(group_id=group.id).update(
            generated_at=newer_time,
            cursor_date=candidate.cursor_date,
            cursor_id=candidate.cursor_id,
        )

        with _hide_first_row_read():
            assert promote_to_live(candidate) is PromotionResult.SUPERSEDED

    def test_promote_create_race_returns_race_lost_when_winner_same_generation(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        gen_time = django_timezone.now()
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=gen_time,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        # Only process one entry so candidate's cursor is behind the log tip.
        processing._process_batch(PIPELINE, candidate, batch_size=1, persist=False)

        last = GroupActionLogEntry.objects.filter(group_id=group.id).order_by("id").last()
        assert last is not None
        GroupDerivedData.objects.filter(group_id=group.id).update(
            generated_at=gen_time - timedelta(seconds=10),
            cursor_date=last.date_added,
            cursor_id=last.id,
        )

        with _hide_first_row_read():
            assert promote_to_live(candidate) is PromotionResult.RACE_LOST

    def test_promote_returns_group_missing_when_group_deleted(self) -> None:
        candidate = GroupDerivedData(
            group_id=999999999,
            generated_at=django_timezone.now(),
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        assert promote_to_live(candidate) is PromotionResult.GROUP_MISSING

    def test_generation_prevents_stale_incremental_write(self) -> None:
        """End-to-end ABA test: incremental write computed from pre-generation
        state must not overwrite a generation's result."""

        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        # Incremental processing reads the row.
        derived = process_group_log(group.id)
        pre_gen_generated_at = derived.generated_at

        # Simulate a generation promoting (stamps a newer generated_at).
        new_gen_time = django_timezone.now()
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=new_gen_time,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        processing._drain_log(candidate, PIPELINE, time_limit=timedelta(minutes=5), persist=False)
        assert promote_to_live(candidate) is PromotionResult.PROMOTED

        derived.refresh_from_db()
        assert derived.generated_at == new_gen_time

        # Insert a log entry directly (not via _publish) to avoid inline
        # processing, which would advance the cursor and mask the test.
        GroupActionLogEntry.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            type=GroupActionType.VIEW,
            actor_type=GroupActorType.SYSTEM,
            actor_id=0,
            source=SOURCE,
            data={},
        )

        # Simulate an incremental writer that read the row before the
        # generation promoted. We construct the GDD manually so we can
        # control the observed generated_at (pre-generation).
        stale = GroupDerivedData(
            id=derived.id,
            group_id=group.id,
            generated_at=pre_gen_generated_at,
            cursor_date=derived.cursor_date,
            cursor_id=derived.cursor_id,
            data=derived.data.copy(),
            pipeline_hash=derived.pipeline_hash,
        )
        # _process_batch with persist=True attempts the guarded UPDATE.
        processing._process_batch(PIPELINE, stale, batch_size=1)

        # The write should have been rejected because generated_at changed.
        derived.refresh_from_db()
        entries = list(GroupActionLogEntry.objects.filter(group_id=group.id).order_by("id"))
        assert derived.cursor_id == entries[-2].id  # still at the pre-new-entry position

    def test_build_and_promote(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(self.user.id))

        build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))
        derived = GroupDerivedData.objects.get(group_id=group.id)
        assert derived.view_count == 1
        assert derived.data["status"] == "closed"
        assert derived.generated_at is not None

    def test_build_and_promote_updates_existing_row(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        old = process_group_log(group.id)

        old_id = old.id

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

        live = GroupDerivedData.objects.get(group_id=group.id)
        assert live.id == old_id
        assert live.view_count == 2
        assert live.generated_at is not None

    def test_build_and_promote_overwrites_old_pipeline_hash(self) -> None:
        group = self.create_group()

        # Insert a log entry directly to avoid inline processing.
        GroupActionLogEntry.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            type=GroupActionType.VIEW,
            actor_type=GroupActorType.SYSTEM,
            actor_id=0,
            source=SOURCE,
            data={},
        )

        # Process incrementally, then set an old pipeline_hash to
        # simulate a pipeline change.
        process_group_log(group.id)
        GroupDerivedData.objects.filter(group_id=group.id).update(pipeline_hash="old_hash")

        build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))
        derived = GroupDerivedData.objects.get(group_id=group.id)
        assert derived.pipeline_hash == PIPELINE.pipeline_hash

    def test_build_and_promote_replaces_orphaned_cursor(self) -> None:
        group = self.create_group()

        # Create a live row with a cursor pointing past any existing entries.
        GroupDerivedData.objects.create(
            group_id=group.id,
            cursor_date=django_timezone.now(),
            cursor_id=99999,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )

        build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

        live = GroupDerivedData.objects.get(group_id=group.id)
        assert live.cursor_date == EPOCH
        assert live.cursor_id == 0
        assert live.generated_at is not None

    def test_build_and_promote_logs_when_live_cursor_orphaned(self) -> None:
        group = self.create_group()

        # Live row references a cursor_id that has no matching log entry.
        self.create_group_derived_data(
            group,
            cursor_date=django_timezone.now(),
            cursor_id=99999,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )

        with patch("sentry.issues.derived.promote.logger") as mock_logger:
            build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

        orphan_calls = [
            call
            for call in mock_logger.info.call_args_list
            if call.args and call.args[0] == "issues.derived.promote.live_cursor_orphaned"
        ]
        assert len(orphan_calls) == 1
        assert orphan_calls[0].kwargs["extra"]["group_id"] == group.id
        assert orphan_calls[0].kwargs["extra"]["live_cursor_id"] == 99999

    def test_build_and_promote_does_not_log_orphan_when_live_cursor_exists(self) -> None:
        group = self.create_group()
        entry = self.create_group_action_log_entry(group)

        # cursor_date in the future so a fresh candidate's replay lands behind it.
        self.create_group_derived_data(
            group,
            cursor_date=django_timezone.now() + timedelta(hours=1),
            cursor_id=entry.id,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )

        with patch("sentry.issues.derived.promote.logger") as mock_logger:
            with pytest.raises(PromotionFailed):
                build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

        orphan_calls = [
            call
            for call in mock_logger.info.call_args_list
            if call.args and call.args[0] == "issues.derived.promote.live_cursor_orphaned"
        ]
        assert orphan_calls == []

    def test_build_and_promote_superseded_returns_cleanly(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)

        # Stamp generated_at far in the future so our generation is older.
        GroupDerivedData.objects.filter(group_id=group.id).update(
            generated_at=django_timezone.now() + timedelta(hours=1)
        )

        # Should return without raising — SUPERSEDED is not a failure.
        build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

    def test_build_and_promote_cursor_behind_new_entries(self) -> None:
        group = self.create_group()

        # Create initial entry and process it incrementally.
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)
        live = GroupDerivedData.objects.get(group_id=group.id)
        first_cursor = live.cursor_id

        # Add a new entry that only incremental processing has seen.
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)
        live.refresh_from_db()
        assert live.cursor_id > first_cursor

        # build_and_promote replays the full log, gets CURSOR_BEHIND on
        # first promote (live cursor advanced), drains the new entry on
        # retry, and promotes successfully.
        build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))
        derived = GroupDerivedData.objects.get(group_id=group.id)
        assert derived.view_count == 2

    def test_build_and_promote_retries_on_race_lost_without_new_entries(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        # Had RACE_LOST been treated as CURSOR_BEHIND, the caller would give
        # up here: the drain leaves no entries past the cursor.
        real_promote = promote_to_live
        attempts = []

        def flaky_promote(
            candidate: GroupDerivedData, *, known_invalid_log_id: int | None = None
        ) -> PromotionResult:
            attempts.append(candidate)
            if len(attempts) == 1:
                return PromotionResult.RACE_LOST
            return real_promote(candidate, known_invalid_log_id=known_invalid_log_id)

        with patch("sentry.issues.derived.promote.promote_to_live", side_effect=flaky_promote):
            build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

        assert len(attempts) == 2
        derived = GroupDerivedData.objects.get(group_id=group.id)
        assert derived.view_count == 1

    def test_build_and_promote_raises_group_does_not_exist_on_mid_loop_group_missing(
        self,
    ) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        def missing_then_real(
            candidate: GroupDerivedData, *, known_invalid_log_id: int | None = None
        ) -> PromotionResult:
            return PromotionResult.GROUP_MISSING

        with patch("sentry.issues.derived.promote.promote_to_live", side_effect=missing_then_real):
            with pytest.raises(Group.DoesNotExist):
                build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

    def test_build_and_promote_prevents_stale_incremental_write(self) -> None:
        """End-to-end ABA test: incremental write computed from pre-generation
        state must not overwrite a generation's result."""
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        # Incremental processing reads the row.
        derived = process_group_log(group.id)

        pre_gen_generated_at = derived.generated_at  # None (never generated)

        # A generation runs and promotes (stamps generated_at).
        build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))
        derived.refresh_from_db()
        assert derived.generated_at is not None

        # A new entry arrives.
        GroupActionLogEntry.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            type=GroupActionType.VIEW,
            actor_type=GroupActorType.SYSTEM,
            actor_id=0,
            source=SOURCE,
            data={},
        )

        # Create a stale incremental writer with the pre-generation state.
        stale = GroupDerivedData(
            group_id=group.id,
            generated_at=pre_gen_generated_at,
            cursor_date=derived.cursor_date,
            cursor_id=derived.cursor_id,
            data=derived.data.copy(),
            pipeline_hash=derived.pipeline_hash,
        )
        # The stale writer processes the new entry.
        processing._process_batch(PIPELINE, stale, batch_size=1)

        # The write should have been rejected because generated_at changed.
        derived.refresh_from_db()
        assert derived.generated_at is not None
        # Cursor should NOT have advanced (stale write rejected).
        entries = list(GroupActionLogEntry.objects.filter(group_id=group.id).order_by("id"))
        assert derived.cursor_id == entries[-2].id  # still at the pre-new-entry position

    def test_build_and_promote_caches_on_timeout_for_resumption(self) -> None:
        group = self.create_group()
        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        with patch("sentry.issues.derived.promote._drain_log", return_value=False):
            with pytest.raises(GroupLogTimeout) as exc_info:
                build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

        assert exc_info.value.group_id == group.id
        assert exc_info.value.generation_id is not None

        # Resuming completes the promotion.
        build_and_promote_derived_data(
            group.id, generation_id=exc_info.value.generation_id, time_limit=timedelta(minutes=5)
        )
        promoted = GroupDerivedData.objects.get(group_id=group.id)
        assert promoted.view_count == 5

    def test_resumed_generation_advances_cursor_on_repeat_timeout(self) -> None:
        group = self.create_group()
        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        with pytest.raises(GroupLogTimeout) as exc_info:
            build_and_promote_derived_data(group.id, batch_size=2, time_limit=timedelta(0))

        gen_id = exc_info.value.generation_id
        assert gen_id is not None
        state = _generation_cache.get(gen_id)
        assert state is not None
        first_cursor = state.cursor_id
        assert first_cursor > 0

        with pytest.raises(GroupLogTimeout) as exc_info:
            build_and_promote_derived_data(
                group.id, generation_id=gen_id, batch_size=2, time_limit=timedelta(0)
            )

        gen_id2 = exc_info.value.generation_id
        assert gen_id2 is not None
        state = _generation_cache.get(gen_id2)
        assert state is not None
        assert state.cursor_id > first_cursor

    def test_build_and_promote_batch_logs_group_id_on_promotion_failed(self) -> None:
        group = self.create_group()
        entry = self.create_group_action_log_entry(group)

        # A valid cursor with a future date remains ahead and forces failure.
        self.create_group_derived_data(
            group,
            cursor_date=django_timezone.now() + timedelta(hours=1),
            cursor_id=entry.id,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )

        with patch("sentry.issues.derived.promote.logger") as mock_logger:
            result = build_and_promote_batch(
                [group.id],
                timeout=timedelta(minutes=5),
                log_key="test.batch",
            )

        assert result.processed.get(PromotionResult.CURSOR_BEHIND) == 1
        failed_calls = [
            call
            for call in mock_logger.exception.call_args_list
            if call.args and call.args[0] == "test.batch.promotion_failed"
        ]
        assert len(failed_calls) == 1
        assert failed_calls[0].kwargs["extra"]["group_id"] == group.id

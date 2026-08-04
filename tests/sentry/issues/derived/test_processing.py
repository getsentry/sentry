from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from django.db import router, transaction
from django.utils import timezone as django_timezone

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    ActionSource,
    GroupAction,
    GroupActionActor,
    GroupActionType,
    GroupActorType,
    PullRequestClosedAction,
    ResolveAction,
    ResolvedInPullRequestAction,
    RootCauseIdentifiedAction,
    SeerCodingCompletedAction,
    UnresolveAction,
    ViewAction,
)
from sentry.issues.derived import processing
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.features import (
    BLOCKER,
    HAS_OPEN_FIX_PR,
    LAST_COMPLETED_AUTOFIX_STEP,
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    VIEW_COUNT,
    IssueStatus,
)
from sentry.issues.derived.framework import (
    AggregatorResult,
    Feature,
    Pipeline,
    StateUpdate,
    StateView,
    aggregator,
)
from sentry.issues.derived.processing import (
    PIPELINE,
    GroupLogTimeout,
    PromotionResult,
    _entries_after_cursor,
    build_and_promote_derived_data,
    invalidate_group_derived_data,
    process_group_log,
    promote_to_live,
)
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.issues.progress_state import IssueProgressState
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.types.group import IssueAutofixStep, IssueBlocker
from sentry.utils import json

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


@with_feature("projects:issue-action-log-write-to-db")
class ProcessGroupLogTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # Enable mutation checking so aggregators that modify state in place fail.
        self._original_pipeline = processing.PIPELINE
        processing.PIPELINE = Pipeline(AGGREGATORS, check_mutations=True)

    def tearDown(self) -> None:
        processing.PIPELINE = self._original_pipeline
        super().tearDown()

    def test_records_and_processes(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))

        entries = list(GroupActionLogEntry.objects.filter(group_id=group.id).order_by("id"))
        assert len(entries) == 3
        assert entries[0].type == GroupActionType.VIEW
        assert entries[0].actor_type == GroupActorType.USER
        assert entries[0].actor_id == user.id

        derived = process_group_log(group.id)
        assert derived.cursor_id == entries[-1].id
        assert isinstance(derived.data, dict)

    def test_incremental_processing(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        first_cursor = derived.cursor_id

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.cursor_id > first_cursor

    def test_noop_when_no_new_entries(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        old_updated = derived.date_updated

        derived = process_group_log(group.id)
        assert derived.date_updated == old_updated

    def test_process_group_log_only_affects_target(self) -> None:
        group_a = self.create_group()
        group_b = self.create_group()
        user = self.user

        _publish(group=group_a, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group_b, action=ViewAction(), actor=GroupActionActor.user(user.id))

        cursor_b = GroupDerivedData.objects.get(group_id=group_b.id).cursor_id

        GroupActionLogEntry.objects.create(
            group_id=group_a.id,
            project_id=group_a.project_id,
            type=0,
            actor_type=GroupActorType.SYSTEM,
            actor_id=0,
            source=SOURCE,
            data={},
        )
        process_group_log(group_a.id)

        assert GroupDerivedData.objects.get(group_id=group_b.id).cursor_id == cursor_b

    def test_batched_processing(self) -> None:
        group = self.create_group()
        user = self.user

        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))

        # Process in batches of 2 — should take 3 batches (2+2+1)
        derived = process_group_log(group.id, batch_size=2)

        entries = list(GroupActionLogEntry.objects.filter(group_id=group.id).order_by("id"))
        assert derived.cursor_id == entries[-1].id
        assert len(entries) == 5

    def test_cursor_same_timestamp_different_ids(self) -> None:
        group = self.create_group()
        ts = datetime(2025, 1, 1, tzinfo=timezone.utc)

        # Create 3 entries with identical date_added but ascending ids.
        entries = []
        for _ in range(3):
            e = GroupActionLogEntry.objects.create(
                group_id=group.id,
                project_id=group.project_id,
                type=GroupActionType.VIEW.value,
                actor_type=GroupActorType.SYSTEM.value,
                actor_id=0,
                source=SOURCE,
                data={},
                date_added=ts,
            )
            entries.append(e)

        def ids_after_cursor(
            cursor_date: datetime, cursor_id: int, batch_size: int = 10
        ) -> list[int]:
            return [
                e.id for e in _entries_after_cursor(group.id, cursor_date, cursor_id, batch_size)
            ]

        e0, e1, e2 = entries[0].id, entries[1].id, entries[2].id

        # Starting before all entries returns all three.
        assert ids_after_cursor(ts, e0 - 1) == [e0, e1, e2]

        # Cursor at entry[0] skips it, returns entries[1] and entries[2].
        assert ids_after_cursor(ts, e0) == [e1, e2]

        # Cursor at entry[1] returns only entries[2].
        assert ids_after_cursor(ts, e1) == [e2]

        # Cursor at entry[2] returns nothing.
        assert ids_after_cursor(ts, e2) == []

        # Cursor before the timestamp returns all entries.
        assert ids_after_cursor(ts - timedelta(seconds=1), 0) == [e0, e1, e2]

        # batch_size limits results.
        assert ids_after_cursor(ts, e0 - 1, batch_size=2) == [e0, e1]

    def test_system_action_no_user(self) -> None:
        group = self.create_group()

        _publish(group=group, action=ResolveAction())

        entry = GroupActionLogEntry.objects.get(group_id=group.id)
        assert entry.actor_type == GroupActorType.SYSTEM
        assert entry.actor_id == 0

    def test_status_starts_open(self) -> None:
        group = self.create_group()

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[STATUS] == IssueStatus.OPEN

    def test_resolve_closes(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    def test_unresolve_reopens(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=UnresolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["status"] == "open"

    def test_duplicate_resolve_ignored(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    def test_duplicate_unresolve_ignored(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=UnresolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[STATUS] == IssueStatus.OPEN

    def test_status_toggle(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=UnresolveAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    # --- invalidation ---

    def test_invalidate_deletes_row(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)
        assert GroupDerivedData.objects.filter(group_id=group.id).exists()

        invalidate_group_derived_data(group.id)
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_invalidate_with_cursor_deletes_if_past(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        # Cursor at the processed entry — row should be deleted.
        invalidate_group_derived_data(group.id, cursor=(derived.cursor_date, derived.cursor_id))
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_invalidate_with_cursor_noop_if_not_reached(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        old_cursor = derived.cursor_id

        # Cursor beyond what we've processed — row should be untouched.
        future = derived.cursor_date.replace(year=derived.cursor_date.year + 1)
        invalidate_group_derived_data(group.id, cursor=(future, old_cursor + 1000))
        derived.refresh_from_db()
        assert derived.cursor_id == old_cursor

    def test_invalidate_then_reprocess(self) -> None:
        group = self.create_group()
        user = self.user
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.view_count == 2

        invalidate_group_derived_data(group.id)
        derived = process_group_log(group.id)
        assert derived.view_count == 2  # rebuilt from scratch

    def test_resolved_in_pull_request_proposes_fix(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=GroupActionActor.user(user.id),
        )
        derived = process_group_log(group.id)
        # An open PR referencing the issue proposes a fix; the issue stays open.
        assert derived.data["status"] == "open"
        assert derived.progress == IssueProgressState.FIX_PROPOSED.value

    def test_pull_request_close_demotes_progress(self) -> None:
        group = self.create_group()
        actor = GroupActionActor.user(self.user.id)

        _publish(group=group, action=RootCauseIdentifiedAction(), actor=actor)
        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=actor,
        )
        derived = process_group_log(group.id)
        assert derived.progress == IssueProgressState.FIX_PROPOSED.value

        _publish(
            group=group,
            action=PullRequestClosedAction(pull_request=101, has_other_open_prs=False),
            actor=actor,
        )
        derived = process_group_log(group.id)
        assert derived.progress == IssueProgressState.DIAGNOSED.value

    def test_pull_request_close_with_remaining_keeps_progress(self) -> None:
        group = self.create_group()
        actor = GroupActionActor.user(self.user.id)

        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=actor,
        )
        _publish(
            group=group,
            action=PullRequestClosedAction(pull_request=101, has_other_open_prs=True),
            actor=actor,
        )
        derived = process_group_log(group.id)
        assert derived.progress == IssueProgressState.FIX_PROPOSED.value

    def test_pull_request_close_invalidate_and_replay_matches(self) -> None:
        group = self.create_group()
        actor = GroupActionActor.user(self.user.id)

        _publish(group=group, action=RootCauseIdentifiedAction(), actor=actor)
        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=actor,
        )
        _publish(
            group=group,
            action=PullRequestClosedAction(pull_request=101, has_other_open_prs=False),
            actor=actor,
        )
        first = process_group_log(group.id)
        first_data = first.data.copy()
        first_progress = first.progress
        first_last_progressed_at = first.last_progressed_at

        invalidate_group_derived_data(group.id)
        second = process_group_log(group.id)
        assert second is not None
        assert second.data == first_data
        assert second.progress == first_progress
        assert second.last_progressed_at == first_last_progressed_at
        assert second.progress == IssueProgressState.DIAGNOSED.value

    def test_blocker_serializes_and_replays(self) -> None:
        group = self.create_group()
        actor = GroupActionActor.user(self.user.id)

        _publish(group=group, action=SeerCodingCompletedAction(), actor=actor)
        derived = process_group_log(group.id)
        assert derived.data["blocker"] == IssueBlocker.APPROVE_CODE_CHANGES.value
        assert derived.data["last_completed_autofix_step"] == IssueAutofixStep.CODE_CHANGES.value
        assert derived.data["has_open_fix_pr"] is False

        _publish(group=group, action=ResolvedInPullRequestAction(pull_request=101), actor=actor)
        derived = process_group_log(group.id)
        assert derived.data["blocker"] == IssueBlocker.MERGE_PR.value
        assert derived.data["has_open_fix_pr"] is True

        _publish(
            group=group,
            action=PullRequestClosedAction(pull_request=101, has_other_open_prs=False),
            actor=actor,
        )
        first = process_group_log(group.id)
        first_data = first.data.copy()
        assert first.data["blocker"] == IssueBlocker.APPROVE_CODE_CHANGES.value

        invalidate_group_derived_data(group.id)
        second = process_group_log(group.id)
        state = GroupDerivedDataStore.load(PIPELINE, second)

        assert second.data == first_data
        assert state[BLOCKER] == IssueBlocker.APPROVE_CODE_CHANGES
        assert state[LAST_COMPLETED_AUTOFIX_STEP] == IssueAutofixStep.CODE_CHANGES
        assert state[HAS_OPEN_FIX_PR] is False

    def test_pipeline_hash_set_on_create(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        assert derived.pipeline_hash == PIPELINE.pipeline_hash

    def test_pipeline_hash_concurrent_change_skips_cursor_update(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        derived = process_group_log(group.id)
        first_cursor = derived.cursor_id

        # Insert a log entry directly to avoid inline processing from _publish
        GroupActionLogEntry.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            type=GroupActionType.VIEW,
            actor_type=GroupActorType.SYSTEM,
            actor_id=0,
            source=SOURCE,
            data={},
        )

        # Simulate a concurrent pipeline_hash change (e.g. migration reset)
        # between our load and the UPDATE in _process_batch.
        GroupDerivedData.objects.filter(group_id=group.id).update(pipeline_hash="reset")

        processing._process_batch(processing.PIPELINE, derived, 1)

        # The UPDATE should not have matched because the DB hash changed
        derived.refresh_from_db()
        assert derived.cursor_id == first_cursor
        assert derived.pipeline_hash == "reset"

    def test_generated_at_change_skips_incremental_write(self) -> None:
        from django.utils import timezone

        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        derived = process_group_log(group.id)
        first_cursor = derived.cursor_id

        GroupActionLogEntry.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            type=GroupActionType.VIEW,
            actor_type=GroupActorType.SYSTEM,
            actor_id=0,
            source=SOURCE,
            data={},
        )

        # Simulate a generation promoting between our read and the UPDATE
        # in _process_batch — generated_at changed.
        GroupDerivedData.objects.filter(id=derived.id).update(generated_at=timezone.now())

        processing._process_batch(processing.PIPELINE, derived, 1)

        derived.refresh_from_db()
        assert derived.cursor_id == first_cursor

    def test_invalidate_and_reprocess_restores_pipeline_hash(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)

        invalidate_group_derived_data(group.id)
        derived = process_group_log(group.id)
        assert derived.pipeline_hash == PIPELINE.pipeline_hash


# --- promote_to_live ---


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

    def test_build_and_promote_cursor_behind_orphaned_cursor(self) -> None:
        from sentry.issues.derived.processing import PromotionFailed

        group = self.create_group()

        # Create a live row with a cursor pointing past any existing entries.
        GroupDerivedData.objects.create(
            group_id=group.id,
            cursor_date=django_timezone.now(),
            cursor_id=99999,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )

        # build_and_promote drains nothing (no entries), gets CURSOR_BEHIND
        # because the candidate's EPOCH cursor is behind the live row's.
        # With no entries to catch up on, the log was modified and the
        # replay is incomplete — give up.
        with pytest.raises(PromotionFailed):
            build_and_promote_derived_data(group.id, time_limit=timedelta(minutes=5))

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

    def test_drain_log_respects_time_limit(self) -> None:
        group = self.create_group()
        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        candidate = GroupDerivedData(group_id=group.id, cursor_date=EPOCH, cursor_id=0, data={})

        drained = processing._drain_log(
            candidate, PIPELINE, batch_size=2, time_limit=timedelta(0), persist=False
        )
        assert not drained
        assert candidate.cursor_id > 0
        entries = list(GroupActionLogEntry.objects.filter(group_id=group.id).order_by("id"))
        assert candidate.cursor_id < entries[-1].id

    def test_build_and_promote_caches_on_timeout_for_resumption(self) -> None:
        group = self.create_group()
        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        with patch("sentry.issues.derived.processing._drain_log", return_value=False):
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
        from sentry.issues.derived.processing import _generation_cache

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


# --- Pure Python tests (no DB) ---


def test_build_update_json_blob_includes_all_json_features() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A, B))
    def compute(state: StateView, entry: object) -> AggregatorResult:
        return None

    pipeline = Pipeline([compute])
    state = pipeline.initial_state()

    # Update only A — blob should still contain both A and B
    state.merge(StateUpdate({A: 1}))
    update = GroupDerivedDataStore.build_update(pipeline, state)

    assert update["data"] == {"a": 1, "b": 0}


def test_store_apply_to_instance() -> None:
    derived = GroupDerivedData()
    derived.data = {}
    update = {"data": {"status": "closed"}, "view_count": 5}
    GroupDerivedDataStore.apply_to_instance(derived, update)
    assert derived.data == {"status": "closed"}
    assert derived.view_count == 5


def test_all_feature_defaults_round_trip_through_json() -> None:
    state = PIPELINE.initial_state()
    blob = {f.name: f.to_json(state[f]) for f in PIPELINE.features}
    serialized = json.loads(json.dumps(blob))
    for f in PIPELINE.features:
        assert f.from_json(serialized[f.name]) == state[f], f"round-trip failed for {f.name}"


# --- Store tests (need DB) ---


@with_feature("projects:issue-action-log-write-to-db")
class GroupDerivedDataStoreTest(TestCase):
    def test_feature_default_matches_column_default(self) -> None:
        field = GroupDerivedData._meta.get_field("progress")
        assert PROGRESS.initial_value() == field.default

    def test_load_returns_defaults_for_empty_data(self) -> None:
        group = self.create_group()
        derived = GroupDerivedData.objects.create(
            group=group,
            data={},
        )
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[VIEW_COUNT] == 0
        assert state[STATUS] == IssueStatus.OPEN

    def test_load_populates_columns_and_json(self) -> None:
        group = self.create_group()
        derived = GroupDerivedData.objects.create(
            group=group,
            view_count=3,
            progress="diagnosed",
            data={
                "status": "closed",
                "blocker": "approve_plan",
                "last_completed_autofix_step": "solution",
                "has_open_fix_pr": False,
            },
        )
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[VIEW_COUNT] == 3
        assert state[PROGRESS] == IssueProgressState.DIAGNOSED
        assert isinstance(state[PROGRESS], IssueProgressState)
        assert state[STATUS] == IssueStatus.CLOSED
        assert state[BLOCKER] == IssueBlocker.APPROVE_PLAN
        assert isinstance(state[BLOCKER], IssueBlocker)
        assert state[LAST_COMPLETED_AUTOFIX_STEP] == IssueAutofixStep.SOLUTION
        assert state[HAS_OPEN_FIX_PR] is False

    def test_load_null_progress(self) -> None:
        group = self.create_group()
        derived = GroupDerivedData.objects.create(
            group=group,
            progress=None,
            data={},
        )
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[PROGRESS] is None

    def test_round_trip_preserves_state(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        first = process_group_log(group.id)

        first_data = first.data.copy()
        first_view_count = first.view_count
        first_progress = first.progress
        first_last_progressed_at = first.last_progressed_at

        invalidate_group_derived_data(group.id)
        second = process_group_log(group.id)
        assert second is not None

        assert second.data == first_data
        assert second.view_count == first_view_count
        assert second.progress == first_progress
        assert second.last_progressed_at == first_last_progressed_at

    def test_build_update_only_includes_updated_features(self) -> None:
        state = PIPELINE.initial_state()

        # Update only STATUS (lives in JSON) — column features stay clean
        state.merge(StateUpdate({STATUS: IssueStatus.CLOSED}))

        update = GroupDerivedDataStore.build_update(PIPELINE, state)

        assert "view_count" not in update
        assert "progress" not in update
        assert "last_progressed_at" not in update
        assert "data" in update
        assert update["data"]["status"] == "closed"

        # Update a column-mapped feature — it should appear in the update
        state.merge(StateUpdate({VIEW_COUNT: 5}))
        update = GroupDerivedDataStore.build_update(PIPELINE, state)
        assert update["view_count"] == 5

    def test_build_update_excludes_json_blob_when_no_json_features_updated(self) -> None:
        state = PIPELINE.initial_state()

        # Update only a column-mapped feature — JSON blob should be excluded
        state.merge(StateUpdate({VIEW_COUNT: 3}))

        update = GroupDerivedDataStore.build_update(PIPELINE, state)

        assert update["view_count"] == 3
        assert "data" not in update

    def test_progress_round_trip(self) -> None:
        group = self.create_group()
        user = self.user
        actor = GroupActionActor.user(user.id)

        _publish(group=group, action=ViewAction(), actor=actor)
        derived = process_group_log(group.id)

        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[PROGRESS] == IssueProgressState.IDENTIFIED
        assert state[LAST_PROGRESSED_AT] is None

        _publish(group=group, action=ResolveAction(), actor=actor)
        derived = process_group_log(group.id)

        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[PROGRESS] is None
        assert state[LAST_PROGRESSED_AT] is not None

        _publish(group=group, action=UnresolveAction(), actor=actor)
        derived = process_group_log(group.id)

        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[PROGRESS] == IssueProgressState.IDENTIFIED
        assert state[LAST_PROGRESSED_AT] is not None


class _IntentionalRollback(Exception):
    pass


@with_feature("projects:issue-action-log-write-to-db")
class DerivedDataTransactionTest(TestCase):
    """Verify derived data processing respects transaction boundaries."""

    def test_rolled_back_action_does_not_produce_derived_data(self) -> None:
        group = self.create_group()

        try:
            with transaction.atomic(using=router.db_for_write(CellOutbox)):
                publish_action(
                    ViewAction(),
                    source=SOURCE,
                    group_id=group.id,
                    project=group.project,
                    actor=GroupActionActor.user(self.user.id),
                )
                assert CellOutbox.objects.filter(
                    category=OutboxCategory.GROUP_ACTION_LOG_EVENT
                ).exists()
                raise _IntentionalRollback
        except _IntentionalRollback:
            pass

        assert not CellOutbox.objects.filter(
            category=OutboxCategory.GROUP_ACTION_LOG_EVENT
        ).exists()
        assert GroupActionLogEntry.objects.filter(group_id=group.id).count() == 0
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_committed_action_produces_derived_data(self) -> None:
        group = self.create_group()

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        assert GroupActionLogEntry.objects.filter(group_id=group.id).count() == 1
        assert GroupDerivedData.objects.filter(group_id=group.id).exists()
        derived = GroupDerivedData.objects.get(group_id=group.id)
        assert derived.view_count == 1


@with_feature("projects:issue-action-log-write-to-db")
class ProcessGroupLogTimeoutTest(TestCase):
    def test_raises_when_timeout_exceeded(self) -> None:
        group = self.create_group()
        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        GroupDerivedData.objects.filter(group_id=group.id).delete()

        with pytest.raises(GroupLogTimeout):
            process_group_log(group.id, batch_size=1, timeout=timedelta(0))

    def test_completes_with_generous_timeout(self) -> None:
        group = self.create_group()
        for _ in range(3):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        GroupDerivedData.objects.filter(group_id=group.id).delete()

        derived = process_group_log(group.id, timeout=timedelta(minutes=5))
        assert derived.view_count == 3

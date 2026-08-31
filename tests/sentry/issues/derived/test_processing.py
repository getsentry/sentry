from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import pytest
from django.db import connection, router, transaction
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
from sentry.issues.derived.check import (
    CheckFailure,
    CheckInvalidated,
    CheckPassed,
    CheckTimeout,
    FeatureDifference,
    check_derived_data,
)
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
    State,
    StateUpdate,
    StateView,
    aggregator,
)
from sentry.issues.derived.processing import (
    PIPELINE,
    DerivedMetrics,
    GroupLogTimeout,
    ProcessingStrategy,
    _entries_after_cursor,
    invalidate_group_derived_data,
    process_group_log,
)
from sentry.issues.derived.promote import PromotionResult, promote_to_live
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

    def _publish_view_without_processing(self, group: Group) -> None:
        with patch("sentry.receivers.outbox.cell.trigger_group_log_processing"):
            _publish(
                group=group,
                action=ViewAction(),
                actor=GroupActionActor.user(self.user.id),
            )

    def test_missing_group_raises_does_not_exist(self) -> None:
        group = self.create_group()

        with transaction.atomic(using=router.db_for_write(GroupDerivedData)):
            with pytest.raises(Group.DoesNotExist):
                process_group_log(9_999_999_999)

            # The failed insert rolls back to its savepoint without breaking this transaction.
            derived = process_group_log(group.id)
            assert derived.group_id == group.id

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

    def test_check_derived_data_matches_replayed_state(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        assert check_derived_data(derived, PIPELINE) == CheckPassed()

    def test_check_derived_data_reports_different_features(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        derived.view_count = 0

        assert check_derived_data(derived, PIPELINE) == CheckFailure(
            group_id=group.id,
            cursor_date=derived.cursor_date,
            cursor_id=derived.cursor_id,
            differences={
                VIEW_COUNT: FeatureDifference(expected=1, actual=0),
            },
        )

    def test_check_derived_data_skips_stale_pipeline(self) -> None:
        group = self.create_group()
        derived = process_group_log(group.id)
        derived.pipeline_hash = "stale"

        assert check_derived_data(derived, PIPELINE) == CheckInvalidated()

    def test_check_derived_data_can_resume_after_timeout(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        with pytest.raises(CheckTimeout) as exc_info:
            check_derived_data(derived, PIPELINE, timeout=timedelta(0), batch_size=1)

        assert (
            check_derived_data(
                derived,
                PIPELINE,
                timeout=timedelta(minutes=1),
                check_id=exc_info.value.check_id,
                batch_size=1,
            )
            == CheckPassed()
        )

    def test_check_derived_data_uses_invocation_scoped_checkpoints(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        with pytest.raises(CheckTimeout) as first_timeout:
            check_derived_data(derived, PIPELINE, timeout=timedelta(0), batch_size=1)
        with pytest.raises(CheckTimeout) as second_timeout:
            check_derived_data(derived, PIPELINE, timeout=timedelta(0), batch_size=1)

        assert (
            first_timeout.value.check_id.invocation_id
            != second_timeout.value.check_id.invocation_id
        )

        for check_id in (first_timeout.value.check_id, second_timeout.value.check_id):
            assert (
                check_derived_data(
                    derived,
                    PIPELINE,
                    timeout=timedelta(minutes=1),
                    check_id=check_id,
                    batch_size=1,
                )
                == CheckPassed()
            )

    def test_check_derived_data_stops_after_partial_batch(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        entries = list(GroupActionLogEntry.objects.filter(group_id=group.id))

        with patch(
            "sentry.issues.derived.check._entries_through_target_cursor", side_effect=[entries]
        ) as get:
            assert check_derived_data(derived, PIPELINE, batch_size=2) == CheckPassed()

        get.assert_called_once()

    def test_check_derived_data_does_not_resume_across_generations(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        with pytest.raises(CheckTimeout) as exc_info:
            check_derived_data(derived, PIPELINE, timeout=timedelta(0), batch_size=1)

        GroupDerivedData.objects.filter(group_id=group.id).update(
            generated_at=derived.generated_at + timedelta(seconds=1)
        )
        derived.refresh_from_db()

        assert (
            check_derived_data(
                derived,
                PIPELINE,
                timeout=timedelta(minutes=1),
                check_id=exc_info.value.check_id,
                batch_size=1,
            )
            == CheckInvalidated()
        )

    def test_check_derived_data_skips_row_invalidated_during_replay(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        original_run = PIPELINE.run

        def run_and_invalidate(
            entries: Iterable[GroupActionLogEntry], state: State | None = None
        ) -> State:
            result = original_run(entries, state=state)
            GroupDerivedData.objects.filter(group_id=group.id).update(pipeline_hash=None)
            return result

        with patch.object(PIPELINE, "run", side_effect=run_and_invalidate):
            assert check_derived_data(derived, PIPELINE) == CheckInvalidated()

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

    def test_current_row_keeps_incremental_metrics(self) -> None:
        group = self.create_group()
        process_group_log(group.id)
        self._publish_view_without_processing(group)
        derived_metrics = Mock(spec=DerivedMetrics)

        process_group_log(group.id, derived_metrics=derived_metrics)

        derived_metrics.as_not_incremental.assert_not_called()
        derived_metrics.report_batch_processed.assert_called_once()

    def test_new_row_downgrades_incremental_metrics(self) -> None:
        group = self.create_group()
        self._publish_view_without_processing(group)
        derived_metrics = Mock(spec=DerivedMetrics)
        nonincremental_metrics = Mock(spec=DerivedMetrics)
        derived_metrics.as_not_incremental.return_value = nonincremental_metrics

        process_group_log(group.id, derived_metrics=derived_metrics)

        derived_metrics.as_not_incremental.assert_called_once_with()
        derived_metrics.report_batch_processed.assert_not_called()
        nonincremental_metrics.report_batch_processed.assert_called_once()

    def test_concurrent_creation_is_not_expected_incremental(self) -> None:
        group = self.create_group()
        derived = GroupDerivedData(
            group_id=group.id,
            pipeline_hash=PIPELINE.pipeline_hash,
        )

        with (
            patch.object(
                GroupDerivedData.objects,
                "get",
                side_effect=GroupDerivedData.DoesNotExist,
            ),
            patch.object(
                GroupDerivedData.objects,
                "get_or_create",
                return_value=(derived, False),
            ),
        ):
            ensured, expected_incremental = processing._ensure_derived(
                group.id, PIPELINE.pipeline_hash
            )

        assert ensured is derived
        assert not expected_incremental

    def test_invalidated_row_downgrades_incremental_metrics(self) -> None:
        group = self.create_group()
        process_group_log(group.id)
        GroupDerivedData.objects.filter(group_id=group.id).update(pipeline_hash=None)
        self._publish_view_without_processing(group)
        derived_metrics = Mock(spec=DerivedMetrics)
        nonincremental_metrics = Mock(spec=DerivedMetrics)
        derived_metrics.as_not_incremental.return_value = nonincremental_metrics

        process_group_log(group.id, derived_metrics=derived_metrics)

        derived_metrics.as_not_incremental.assert_called_once_with()
        derived_metrics.report_batch_processed.assert_not_called()
        nonincremental_metrics.report_batch_processed.assert_called_once()

    def test_new_inline_row_preserves_latency_suppression_on_async_fallback(self) -> None:
        group = self.create_group()

        with (
            patch("sentry.issues.derived.processing._process_batch", return_value=True),
            patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_delay,
        ):
            processing.trigger_group_log_processing(
                group.id,
                strategy=ProcessingStrategy.INLINE,
            )

        mock_delay.assert_called_once_with(group.id, incremental=False)

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

        with patch(
            "sentry.issues.derived.processing.generate_group_derived_data.delay"
        ) as mock_generate:
            invalidate_group_derived_data(group.id, soft=False)
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()
        mock_generate.assert_called_once_with(group.id)

    def test_invalidate_soft_keeps_row_and_schedules_generate(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)
        assert GroupDerivedData.objects.filter(group_id=group.id).exists()

        with patch(
            "sentry.issues.derived.processing.generate_group_derived_data.delay"
        ) as mock_generate:
            invalidate_group_derived_data(group.id)
        row = GroupDerivedData.objects.get(group_id=group.id)
        # Soft invalidation nulls pipeline_hash but keeps the row readable.
        assert row.pipeline_hash is None
        mock_generate.assert_called_once_with(group.id)

    def test_invalidate_soft_no_trigger_skips_task(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)
        assert (
            GroupDerivedData.objects.get(group_id=group.id).pipeline_hash == PIPELINE.pipeline_hash
        )

        with (
            patch(
                "sentry.issues.derived.processing.generate_group_derived_data.delay"
            ) as mock_generate,
            patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_process,
        ):
            invalidate_group_derived_data(group.id, trigger_regenerate=False)
        # Row is still invalidated (hash nulled) even without triggering regen.
        assert GroupDerivedData.objects.get(group_id=group.id).pipeline_hash is None
        mock_generate.assert_not_called()
        mock_process.assert_not_called()

    def test_invalidate_hard_no_trigger_deletes_without_task(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)
        assert GroupDerivedData.objects.filter(group_id=group.id).exists()

        with (
            patch(
                "sentry.issues.derived.processing.generate_group_derived_data.delay"
            ) as mock_generate,
            patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_process,
        ):
            invalidate_group_derived_data(group.id, soft=False, trigger_regenerate=False)
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()
        mock_generate.assert_not_called()
        mock_process.assert_not_called()

    def test_invalidate_pure_append_no_trigger_skips_process_task(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        old_cursor = derived.cursor_id

        future = derived.cursor_date.replace(year=derived.cursor_date.year + 1)
        with patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_delay:
            invalidate_group_derived_data(
                group.id,
                cursor=(future, old_cursor + 1000),
                trigger_regenerate=False,
            )
        mock_delay.assert_not_called()

    def test_invalidate_soft_rebuilds_via_generate(self) -> None:
        group = self.create_group()
        user = self.user
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.view_count == 2

        with self.tasks():
            invalidate_group_derived_data(group.id)
        derived.refresh_from_db()
        assert derived.view_count == 2

    def test_invalidate_with_cursor_deletes_if_past(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        invalidate_group_derived_data(
            group.id, cursor=(derived.cursor_date, derived.cursor_id), soft=False
        )
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_invalidate_with_cursor_soft_schedules_generate_if_past(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        with patch(
            "sentry.issues.derived.processing.generate_group_derived_data.delay"
        ) as mock_generate:
            invalidate_group_derived_data(group.id, cursor=(derived.cursor_date, derived.cursor_id))
        assert GroupDerivedData.objects.filter(group_id=group.id).exists()
        mock_generate.assert_called_once_with(group.id)

    def test_invalidate_with_cursor_noop_if_not_reached(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        old_cursor = derived.cursor_id

        # Cursor is past the processed entry — a pure append, so the row
        # is untouched and processing is scheduled to drain it.
        future = derived.cursor_date.replace(year=derived.cursor_date.year + 1)
        with patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_delay:
            invalidate_group_derived_data(group.id, cursor=(future, old_cursor + 1000))
        derived.refresh_from_db()
        assert derived.cursor_id == old_cursor
        mock_delay.assert_called_once_with(group.id)

    def test_invalidate_soft_inserts_null_row_when_missing(self) -> None:
        group = self.create_group()
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

        with (
            patch(
                "sentry.issues.derived.processing.generate_group_derived_data.delay"
            ) as mock_generate,
            patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_process,
        ):
            invalidate_group_derived_data(group.id)

        row = GroupDerivedData.objects.get(group_id=group.id)
        assert row.pipeline_hash is None
        mock_generate.assert_called_once_with(group.id)
        mock_process.assert_not_called()

    def test_invalidate_soft_inserts_null_row_when_missing_no_trigger(self) -> None:
        group = self.create_group()
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

        with (
            patch(
                "sentry.issues.derived.processing.generate_group_derived_data.delay"
            ) as mock_generate,
            patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_process,
        ):
            invalidate_group_derived_data(group.id, trigger_regenerate=False)

        row = GroupDerivedData.objects.get(group_id=group.id)
        assert row.pipeline_hash is None
        mock_generate.assert_not_called()
        mock_process.assert_not_called()

    def test_invalidate_soft_inserts_null_row_when_missing_with_cursor(self) -> None:
        group = self.create_group()
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

        cursor = (django_timezone.now(), 12345)
        with patch(
            "sentry.issues.derived.processing.generate_group_derived_data.delay"
        ) as mock_generate:
            invalidate_group_derived_data(group.id, cursor=cursor)

        row = GroupDerivedData.objects.get(group_id=group.id)
        assert row.pipeline_hash is None
        mock_generate.assert_called_once_with(group.id)

    def test_invalidate_soft_missing_group_is_noop(self) -> None:
        # Force FK constraints to IMMEDIATE so the violation fires at INSERT time (matching
        # production autocommit behaviour) rather than at test teardown.
        with connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")

        nonexistent_group_id = 9_999_999_999
        with (
            patch(
                "sentry.issues.derived.processing.generate_group_derived_data.delay"
            ) as mock_generate,
            patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_process,
        ):
            # Should not raise IntegrityError — the invalidator swallows it.
            invalidate_group_derived_data(nonexistent_group_id)

        assert not GroupDerivedData.objects.filter(group_id=nonexistent_group_id).exists()
        mock_generate.assert_not_called()
        mock_process.assert_not_called()

    def test_invalidate_soft_bumps_generated_at(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        before = derived.generated_at

        with patch("sentry.issues.derived.processing.generate_group_derived_data.delay"):
            invalidate_group_derived_data(group.id)

        derived.refresh_from_db()
        assert derived.pipeline_hash is None
        assert derived.generated_at > before

    def test_invalidate_matches_null_hash_row_regardless_of_cursor(self) -> None:
        # A null-hash row is already stale — a subsequent invalidation whose
        # cursor is past the row's cursor must still refresh the CAS rather
        # than fall into the pure-append branch.
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        # Null the hash directly to simulate a prior invalidation (placeholder
        # left behind by the missing-row insert path or an in-flight null).
        GroupDerivedData.objects.filter(group_id=group.id).update(pipeline_hash=None)
        derived.refresh_from_db()
        before_gen = derived.generated_at

        # Cursor is well past the row's cursor — under the old predicate this
        # would look like a pure append.
        future = derived.cursor_date.replace(year=derived.cursor_date.year + 1)
        with (
            patch(
                "sentry.issues.derived.processing.generate_group_derived_data.delay"
            ) as mock_generate,
            patch("sentry.issues.derived.processing.process_group_log_task.delay") as mock_process,
        ):
            invalidate_group_derived_data(group.id, cursor=(future, derived.cursor_id + 1000))

        derived.refresh_from_db()
        assert derived.pipeline_hash is None
        assert derived.generated_at > before_gen
        mock_generate.assert_called_once_with(group.id)
        mock_process.assert_not_called()

    def test_invalidate_supersedes_in_flight_generation(self) -> None:
        # A generation task that started before invalidation must not
        # promote its (pre-invalidation) snapshot over the null-hash row.
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        # Snapshot a candidate as if a generation started here.
        candidate = GroupDerivedData(
            group_id=group.id,
            generated_at=django_timezone.now(),
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=PIPELINE.pipeline_hash,
        )
        processing._drain_log(candidate, PIPELINE, time_limit=timedelta(minutes=5), persist=False)

        # Invalidation happens between the drain and the promote — either
        # against an existing row or (as here) inserting the placeholder.
        with patch("sentry.issues.derived.processing.generate_group_derived_data.delay"):
            invalidate_group_derived_data(group.id)

        # Promotion of the pre-invalidation snapshot must lose.
        assert promote_to_live(candidate) is PromotionResult.SUPERSEDED
        row = GroupDerivedData.objects.get(group_id=group.id)
        assert row.pipeline_hash is None

    def test_invalidate_then_reprocess(self) -> None:
        group = self.create_group()
        user = self.user
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.view_count == 2

        invalidate_group_derived_data(group.id, soft=False)
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

        invalidate_group_derived_data(group.id, soft=False)
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

        invalidate_group_derived_data(group.id, soft=False)
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

    def test_pipeline_hash_null_stale_still_incrementally_updates(self) -> None:
        # NULL ``pipeline_hash`` officially marks a row as stale — known to
        # be out of date and awaiting replacement. Incremental writes should
        # still advance a stale row rather than be frozen out.
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        derived = process_group_log(group.id)
        first_cursor = derived.cursor_id

        # Direct-create bypasses the outbox and takes ``date_added`` from
        # ``db_default=Now()`` — Postgres ``NOW()`` returns the enclosing
        # transaction's start time, which in a test transaction can predate
        # the outbox-delivered entry above (whose ``date_added`` was stamped
        # by wall-clock ``timezone.now()``). Set it explicitly so the cursor
        # predicate sees new_entry as strictly newer.
        new_entry = GroupActionLogEntry.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            type=GroupActionType.VIEW,
            actor_type=GroupActorType.SYSTEM,
            actor_id=0,
            source=SOURCE,
            data={},
            date_added=derived.cursor_date + timedelta(seconds=1),
        )

        # Officially mark the row stale by resetting pipeline_hash to NULL.
        GroupDerivedData.objects.filter(group_id=group.id).update(pipeline_hash=None)

        processing._process_batch(processing.PIPELINE, derived, 1)

        derived.refresh_from_db()
        assert derived.cursor_id == new_entry.id
        assert derived.cursor_id != first_cursor
        # The row remains stale (NULL) — it's up to a subsequent full
        # generation to restamp the current pipeline_hash.
        assert derived.pipeline_hash is None

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

        invalidate_group_derived_data(group.id, soft=False)
        derived = process_group_log(group.id)
        assert derived.pipeline_hash == PIPELINE.pipeline_hash


@with_feature("projects:issue-action-log-write-to-db")
class DrainLogTest(TestCase):
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

        invalidate_group_derived_data(group.id, soft=False)
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

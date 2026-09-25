from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Literal
from unittest.mock import MagicMock, call, patch

import pytest
from django.db.utils import OperationalError

from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import ActionSource, GroupActionActor, ViewAction
from sentry.issues.derived.check import CheckId, CheckTimeout
from sentry.issues.derived.framework import DerivedDataError
from sentry.issues.derived.gate import GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION
from sentry.issues.derived.heal_state import (
    CURRENT_STATE_VERSION,
    HealSchedulerState,
    _state_cache,
    load_state,
    save_state,
)
from sentry.issues.derived.processing import PIPELINE, GroupLogTimeout, process_group_log
from sentry.issues.derived.tasks import (
    BATCH_RETRIGGER_TIMEOUT,
    _discover_stale_pipeline_hashes,
    check_fresh_derived_data_batch,
    generate_group_derived_data,
    generate_project_derived_data,
    generate_project_derived_data_batch,
    heal_stale_derived_data,
    regenerate_stale_derived_data_batch,
)
from sentry.issues.derived.tasks_util import (
    GroupIdRangeResult,
    SpawnState,
    _estimate_group_id_ranges,
    _exact_group_id_ranges,
    _pick_random_fresh_group_ranges,
    group_id_ranges_for_hash,
)
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.group import Group, GroupStatus
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import outbox_runner


class DerivedDataTaskTestBase(TestCase):
    def create_unprocessed_groups(self, count: int) -> list[Group]:
        groups = []
        for _ in range(count):
            group = self.create_group(project=self.project)
            with outbox_runner():
                publish_action(
                    ViewAction(),
                    source=ActionSource.API,
                    group_id=group.id,
                    project=group.project,
                    actor=GroupActionActor.user(self.user.id),
                )
            # Delete the derived data created by publish so the task sees them as unprocessed
            GroupDerivedData.objects.filter(group_id=group.id).delete()
            groups.append(group)
        return groups


@with_feature("projects:issue-action-log-write-to-db")
class GenerateProjectDerivedDataStaleOnlyTest(DerivedDataTaskTestBase):
    def test_only_includes_stale_groups(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        # Make one group stale
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash="stale")

        with patch.object(generate_project_derived_data_batch, "delay") as mock_delay:
            generate_project_derived_data(project_id=self.project.id, stale_only=True)

        mock_delay.assert_called_once()
        assert mock_delay.call_args[1]["group_id_start"] == group_ids[0]
        assert mock_delay.call_args[1]["group_id_end"] == group_ids[0] + 1

    def test_includes_null_hash_groups(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash=None)

        with patch.object(generate_project_derived_data_batch, "delay") as mock_delay:
            generate_project_derived_data(project_id=self.project.id, stale_only=True)

        mock_delay.assert_called_once()
        assert mock_delay.call_args[1]["group_id_start"] == group_ids[0]

    def test_excludes_current_hash_groups(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        # All groups have the current hash — nothing to do
        with patch.object(generate_project_derived_data_batch, "delay") as mock_delay:
            generate_project_derived_data(project_id=self.project.id, stale_only=True)

        mock_delay.assert_not_called()

    def test_excludes_groups_without_gdd(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        # Only process two groups — group_ids[2] has no GDD at all
        process_group_log(group_ids[0])
        process_group_log(group_ids[1])

        # Make one stale
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash="stale")

        with patch.object(generate_project_derived_data_batch, "delay") as mock_delay:
            generate_project_derived_data(project_id=self.project.id, stale_only=True)

        # Only the stale group should be included, not the one missing GDD
        mock_delay.assert_called_once()
        assert mock_delay.call_args[1]["group_id_start"] == group_ids[0]
        assert mock_delay.call_args[1]["group_id_end"] == group_ids[0] + 1


@with_feature("projects:issue-action-log-write-to-db")
class GenerateProjectDerivedDataBatchResumeTest(DerivedDataTaskTestBase):
    def test_resume_generation_id_not_applied_when_start_group_filtered_out(self) -> None:
        # A resume ``GenerationId`` identifies a specific group. If that
        # group is no longer in the batch queryset (e.g. under stale_only
        # it was already rebuilt to the current hash), the resume must
        # be dropped — it must NOT get applied to whichever group happens
        # to be first, because the cached partial progress belongs to a
        # different group.
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)
        group_a, group_b = group_ids

        for gid in group_ids:
            process_group_log(gid)

        # A is at the current hash (not stale); B is stale.
        GroupDerivedData.objects.filter(group_id=group_b).update(pipeline_hash="stale")

        resume_generated_at = datetime(2024, 1, 1, tzinfo=timezone.utc).isoformat()
        resume_pipeline_hash = "prevhash"

        with patch("sentry.issues.derived.promote.build_and_promote_derived_data") as mock_build:
            generate_project_derived_data_batch(
                project_id=self.project.id,
                group_id_start=group_a,
                group_id_end=group_b + 1,
                resume_generated_at=resume_generated_at,
                resume_pipeline_hash=resume_pipeline_hash,
                stale_only=True,
            )

        # Only B is processed (A is filtered by stale_only).
        mock_build.assert_called_once()
        call_kwargs = mock_build.call_args.kwargs
        assert mock_build.call_args.args[0] == group_b
        # And critically, B does NOT inherit the resume generation_id
        # that was built for A.
        assert call_kwargs["generation_id"] is None


@with_feature("projects:issue-action-log-write-to-db")
class GenerateProjectDerivedDataPaginationTest(DerivedDataTaskTestBase):
    def test_limits_page_to_max_tasks(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(group.id for group in groups)

        with (
            override_options(
                {
                    "issues.derived.project-batch-size": 2,
                    "issues.derived.project-max-tasks": 1,
                }
            ),
            patch.object(generate_project_derived_data_batch, "delay") as mock_batch_delay,
            patch.object(generate_project_derived_data, "apply_async") as mock_project_delay,
        ):
            generate_project_derived_data(project_id=self.project.id)

        mock_batch_delay.assert_called_once_with(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[1] + 1,
            stale_only=False,
        )
        mock_project_delay.assert_called_once_with(
            kwargs={
                "project_id": self.project.id,
                "cursor_group_id": group_ids[1],
                "stale_only": False,
            },
            headers={"sentry-propagate-traces": False},
        )

    def test_schedules_the_next_page(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(group.id for group in groups)

        with (
            patch("sentry.issues.derived.tasks._MAX_PROJECT_GROUPS", 2),
            patch.object(generate_project_derived_data_batch, "delay") as mock_batch_delay,
            patch.object(generate_project_derived_data, "apply_async") as mock_project_delay,
        ):
            generate_project_derived_data(project_id=self.project.id)

        mock_batch_delay.assert_called_once_with(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[1] + 1,
            stale_only=False,
        )
        mock_project_delay.assert_called_once_with(
            kwargs={
                "project_id": self.project.id,
                "cursor_group_id": group_ids[1],
                "stale_only": False,
            },
            headers={"sentry-propagate-traces": False},
        )

    def test_resumes_after_the_cursor(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(group.id for group in groups)

        with (
            patch.object(generate_project_derived_data_batch, "delay") as mock_batch_delay,
            patch.object(generate_project_derived_data, "apply_async") as mock_project_delay,
        ):
            generate_project_derived_data(
                project_id=self.project.id,
                cursor_group_id=group_ids[1],
            )

        mock_batch_delay.assert_called_once_with(
            project_id=self.project.id,
            group_id_start=group_ids[2],
            group_id_end=group_ids[2] + 1,
            stale_only=False,
        )
        mock_project_delay.assert_not_called()

    @patch("taskbroker_client.state.current_task")
    def test_selfchain_skips_self_schedule_when_marked_during_work(
        self, mock_current_task: MagicMock
    ) -> None:
        # Entry guard passes; a concurrent delivery marks before we self-schedule the next page.
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(group.id for group in groups)
        mock_current_task.return_value = SimpleNamespace(id="proj-act-race")

        def mark_during_chunk(
            chunk_group_ids: Sequence[int], batch_size: int
        ) -> list[tuple[int, int]]:
            mark_spawned("generate_project_derived_data", "proj-act-race")
            return [(chunk_group_ids[0], chunk_group_ids[-1] + 1)]

        with (
            override_options(
                {
                    "issues.derived.project-batch-size": 2,
                    "issues.derived.project-max-tasks": 1,
                }
            ),
            patch(
                "sentry.issues.derived.tasks._chunk_group_ids_into_ranges",
                side_effect=mark_during_chunk,
            ),
            patch.object(generate_project_derived_data_batch, "delay") as mock_batch_delay,
            patch.object(generate_project_derived_data, "apply_async") as mock_project_delay,
        ):
            generate_project_derived_data(project_id=self.project.id)

        mock_batch_delay.assert_called_once_with(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[1] + 1,
            stale_only=False,
        )
        mock_project_delay.assert_not_called()

    @patch("taskbroker_client.state.current_task")
    def test_selfchain_marks_after_self_schedule(self, mock_current_task: MagicMock) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(group.id for group in groups)
        mock_current_task.return_value = SimpleNamespace(id="proj-act-mark")

        with (
            override_options(
                {
                    "issues.derived.project-batch-size": 2,
                    "issues.derived.project-max-tasks": 1,
                }
            ),
            patch.object(generate_project_derived_data_batch, "delay"),
            patch.object(generate_project_derived_data, "apply_async") as mock_project_delay,
        ):
            generate_project_derived_data(project_id=self.project.id)

        mock_project_delay.assert_called_once()
        assert already_spawned("generate_project_derived_data", "proj-act-mark") is True
        call_kwargs: dict[str, Any] = mock_project_delay.call_args.kwargs["kwargs"]
        assert group_ids[1] == call_kwargs["cursor_group_id"]


class SpawnStateTest(TestCase):
    def test_roundtrip(self) -> None:
        spawn = SpawnState(SimpleNamespace(id="act-spawn-state"), "merge_groups")
        assert spawn.task_key == "merge_groups"
        assert spawn.activation_id == "act-spawn-state"
        assert spawn.already_spawned() is False

        spawn.mark_spawned()

        assert spawn.already_spawned() is True
        assert already_spawned(spawn.task_key, "act-spawn-state") is True

    def test_noop_without_activation(self) -> None:
        spawn = SpawnState(None, "merge_groups")
        assert spawn.task_key == "merge_groups"
        assert spawn.activation_id is None
        assert spawn.already_spawned() is False
        spawn.mark_spawned()
        assert already_spawned(spawn.task_key, "act-none") is False


class HealSchedulerStateTest(TestCase):
    def test_cache_key(self) -> None:
        assert _state_cache.key("state") == "issues-derived-heal:state"

    def test_round_trip(self) -> None:
        state = HealSchedulerState(
            head_hash="current",
            stale={"stale": 42},
            discovered_at=datetime.now(timezone.utc),
        )

        with patch.object(_state_cache, "set") as cache_set:
            save_state(state)
        cached_state = cache_set.call_args.args[1]

        with patch.object(_state_cache, "get", return_value=cached_state):
            assert load_state() == state
        assert state.version == CURRENT_STATE_VERSION

    def test_missing(self) -> None:
        with patch.object(_state_cache, "get", return_value=None):
            assert load_state() is None

    def test_corrupt(self) -> None:
        with patch.object(_state_cache, "get", return_value="not-state"):
            assert load_state() is None

    def test_wrong_version(self) -> None:
        state = HealSchedulerState(
            version=CURRENT_STATE_VERSION + 1,
            head_hash="current",
            stale={},
            discovered_at=datetime.now(timezone.utc),
        )
        with patch.object(_state_cache, "get", return_value=state):
            assert load_state() is None

    def test_expired(self) -> None:
        state = HealSchedulerState(
            head_hash="current",
            discovered_at=datetime.now(timezone.utc) - timedelta(days=3),
        )

        with patch.object(_state_cache, "get", return_value=state):
            assert load_state() is None


@with_feature("projects:issue-action-log-write-to-db")
class HealStaleDerivedDataTest(DerivedDataTaskTestBase):
    def setUp(self) -> None:
        super().setUp()
        load_state_patch = patch("sentry.issues.derived.tasks.load_state", return_value=None)
        save_state_patch = patch("sentry.issues.derived.tasks.save_state")
        load_state_patch.start()
        save_state_patch.start()
        self.addCleanup(load_state_patch.stop)
        self.addCleanup(save_state_patch.stop)

    def _pick_stale_hash(self, seed: str = "0") -> str:
        h = seed * 16
        return h if PIPELINE.pipeline_hash != h else ("z" * 16)

    def test_finds_stale_groups_and_schedules_batch(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        stale = self._pick_stale_hash()
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash=stale)

        with patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay:
            heal_stale_derived_data()

        mock_delay.assert_called_once_with(
            target_hash=stale,
            group_id_start=group_ids[0],
            group_id_end=group_ids[0] + 1,
        )

    def test_logs_progress_through_scheduling_stages(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(group.id for group in groups)
        for group_id in group_ids:
            process_group_log(group_id)

        stale = self._pick_stale_hash()
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash=stale)

        with (
            override_options(
                {
                    "issues.derived.heal-batch-size": 1,
                    "issues.derived.heal-max-tasks": 2,
                    "issues.derived.check-task-count": 1,
                }
            ),
            patch("sentry.issues.derived.tasks_util.random.randint", return_value=group_ids[1]),
            patch("sentry.issues.derived.tasks.logger") as mock_logger,
            patch.object(regenerate_stale_derived_data_batch, "delay"),
            patch.object(check_fresh_derived_data_batch, "delay"),
        ):
            heal_stale_derived_data()

        messages = [log_call.args[0] for log_call in mock_logger.info.call_args_list]
        assert messages == [
            "heal_stale_derived_data.started",
            "heal_stale_derived_data.configuration_loaded",
            "heal_stale_derived_data.state_regenerated",
            "heal_stale_derived_data.stale_hash_discovery_started",
            "heal_stale_derived_data.stale_hash_discovery_complete",
            "heal_stale_derived_data.range_selection_started",
            "heal_stale_derived_data.range_selection_complete",
            "heal_stale_derived_data.range_selection_started",
            "heal_stale_derived_data.range_selection_complete",
            "heal_stale_derived_data.batch_dispatch_started",
            "heal_stale_derived_data.stale_hash_mark_advanced",
            "heal_stale_derived_data.batch_dispatch_complete",
            "heal_stale_derived_data.scheduled",
            "heal_stale_derived_data.check_range_selection_started",
            "heal_stale_derived_data.check_range_selection_complete",
            "heal_stale_derived_data.check_dispatch_started",
            "heal_stale_derived_data.checks_scheduled",
            "heal_stale_derived_data.complete",
        ]
        range_selection_logs = [
            log_call
            for log_call in mock_logger.info.call_args_list
            if log_call.args[0] == "heal_stale_derived_data.range_selection_complete"
        ]
        assert all(log_call.kwargs["extra"]["elapsed"] >= 0 for log_call in range_selection_logs)

    def test_missing_state_discovers_and_reports_metric(self) -> None:
        with (
            override_options({"issues.derived.check-task-count": 0}),
            patch(
                "sentry.issues.derived.tasks._discover_stale_pipeline_hashes", return_value=[]
            ) as discover,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                return_value=GroupIdRangeResult(ranges=[], drained=True),
            ),
            patch("sentry.issues.derived.tasks.metrics.incr") as mock_incr,
        ):
            heal_stale_derived_data()

        discover.assert_called_once_with(PIPELINE.pipeline_hash, 5)
        assert (
            call(
                "issues.derived.heal_stale_hash_discovery",
                sample_rate=1.0,
                tags={"reason": "no_state"},
            )
            in mock_incr.call_args_list
        )

    def test_discovery_metric_reports_healed_state_when_nothing_is_stale(self) -> None:
        state = HealSchedulerState(
            head_hash=PIPELINE.pipeline_hash,
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options({"issues.derived.check-task-count": 0}),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch("sentry.issues.derived.tasks._discover_stale_pipeline_hashes", return_value=[]),
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                return_value=GroupIdRangeResult(ranges=[], drained=True),
            ),
            patch("sentry.issues.derived.tasks.metrics.incr") as mock_incr,
        ):
            heal_stale_derived_data()

        assert (
            call(
                "issues.derived.heal_stale_hash_discovery",
                sample_rate=1.0,
                tags={"reason": "stale_empty"},
            )
            in mock_incr.call_args_list
        )

    def test_head_change_enqueues_old_hash_without_discovery(self) -> None:
        old_hash = self._pick_stale_hash()
        state = HealSchedulerState(
            head_hash=old_hash,
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options(
                {
                    "issues.derived.heal-max-tasks": 1,
                    "issues.derived.check-task-count": 0,
                }
            ),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch("sentry.issues.derived.tasks.save_state") as mock_save,
            patch("sentry.issues.derived.tasks._discover_stale_pipeline_hashes") as discover,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    GroupIdRangeResult(ranges=[], drained=True),
                    GroupIdRangeResult(ranges=[(10, 20)], drained=False),
                ],
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay"),
        ):
            heal_stale_derived_data()

        discover.assert_not_called()
        assert mock_save.call_args.args[0].stale == {old_hash: 20}

    def test_head_change_removes_current_hash_from_stale_state(self) -> None:
        old_hash = self._pick_stale_hash()
        state = HealSchedulerState(
            head_hash=old_hash,
            stale={PIPELINE.pipeline_hash: 10},
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options(
                {
                    "issues.derived.heal-max-tasks": 1,
                    "issues.derived.check-task-count": 0,
                }
            ),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch("sentry.issues.derived.tasks.save_state") as mock_save,
            patch("sentry.issues.derived.tasks._discover_stale_pipeline_hashes") as discover,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    GroupIdRangeResult(ranges=[], drained=True),
                    GroupIdRangeResult(ranges=[(1, 2)], drained=False),
                ],
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay"),
        ):
            heal_stale_derived_data()

        discover.assert_not_called()
        assert mock_save.call_args.args[0].stale == {old_hash: 2}

    def test_discovery_timeout_still_schedules_null_and_saves_retryable_state(self) -> None:
        with (
            override_options({"issues.derived.heal-max-tasks": 1}),
            patch(
                "sentry.issues.derived.tasks._discover_stale_pipeline_hashes",
                side_effect=OperationalError,
            ),
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                return_value=GroupIdRangeResult(ranges=[(1, 2)], drained=False),
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay") as delay,
            patch("sentry.issues.derived.tasks.save_state") as mock_save,
            patch("sentry.issues.derived.tasks.logger") as mock_logger,
        ):
            heal_stale_derived_data()

        delay.assert_called_once()
        saved_state = mock_save.call_args.args[0]
        assert saved_state.discovered_at is None
        mock_logger.exception.assert_called_once_with(
            "heal_stale_derived_data.stale_hash_discovery_failed"
        )

    def test_range_selection_timeout_is_reported_and_other_hashes_continue(self) -> None:
        stale_hash = self._pick_stale_hash()
        state = HealSchedulerState(
            head_hash=PIPELINE.pipeline_hash,
            stale={stale_hash: 10},
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options(
                {
                    "issues.derived.heal-max-tasks": 1,
                    "issues.derived.check-task-count": 0,
                }
            ),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    OperationalError,
                    GroupIdRangeResult(ranges=[(10, 20)], drained=False),
                ],
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay") as delay,
            patch("sentry.issues.derived.tasks.metrics.incr") as mock_incr,
            patch("sentry.issues.derived.tasks.logger") as mock_logger,
        ):
            heal_stale_derived_data()

        delay.assert_called_once()
        failure_log = mock_logger.exception.call_args
        assert failure_log.args == ("heal_stale_derived_data.range_selection_failed",)
        assert failure_log.kwargs["extra"]["hash_kind"] == "null"
        assert failure_log.kwargs["extra"]["elapsed"] >= 0
        assert (
            call(
                "issues.derived.heal_range_selection_failed",
                sample_rate=1.0,
                tags={"hash_kind": "null"},
            )
            in mock_incr.call_args_list
        )

    def test_range_selection_timeout_does_not_advance_mark(self) -> None:
        stale = self._pick_stale_hash()
        state = HealSchedulerState(
            head_hash=PIPELINE.pipeline_hash,
            stale={stale: 10},
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options(
                {
                    "issues.derived.heal-max-tasks": 1,
                    "issues.derived.check-task-count": 0,
                }
            ),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    GroupIdRangeResult(ranges=[], drained=True),
                    OperationalError,
                ],
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay") as delay,
            patch("sentry.issues.derived.tasks.logger") as mock_logger,
        ):
            heal_stale_derived_data()

        assert state.stale == {stale: 10}
        delay.assert_not_called()
        failure_log = mock_logger.exception.call_args
        assert failure_log.args == ("heal_stale_derived_data.range_selection_failed",)
        assert failure_log.kwargs["extra"]["hash_kind"] == "stale"
        assert failure_log.kwargs["extra"]["pipeline_hash"] == stale
        assert failure_log.kwargs["extra"]["group_id_lower_bound"] == 10
        assert failure_log.kwargs["extra"]["elapsed"] >= 0

    def test_discovered_hashes_are_saved_before_range_selection(self) -> None:
        stale_hash = self._pick_stale_hash()
        with (
            patch(
                "sentry.issues.derived.tasks._discover_stale_pipeline_hashes",
                return_value=[stale_hash],
            ),
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=RuntimeError("range selection timed out"),
            ),
            patch("sentry.issues.derived.tasks.save_state") as mock_save,
        ):
            with pytest.raises(RuntimeError):
                heal_stale_derived_data()

        mock_save.assert_called_once()
        saved_state = mock_save.call_args.args[0]
        assert saved_state.head_hash == PIPELINE.pipeline_hash
        assert saved_state.stale == {stale_hash: 0}

    def test_non_empty_state_skips_discovery_and_advances_across_runs(self) -> None:
        stale_hash = self._pick_stale_hash()
        state = HealSchedulerState(
            head_hash=PIPELINE.pipeline_hash,
            stale={stale_hash: 10},
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options(
                {
                    "issues.derived.heal-max-tasks": 1,
                    "issues.derived.check-task-count": 0,
                }
            ),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch("sentry.issues.derived.tasks.save_state") as first_save,
            patch("sentry.issues.derived.tasks._discover_stale_pipeline_hashes") as discover,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    GroupIdRangeResult(ranges=[], drained=True),
                    GroupIdRangeResult(ranges=[(10, 20)], drained=False),
                ],
            ) as first_ranges,
            patch.object(regenerate_stale_derived_data_batch, "delay"),
        ):
            heal_stale_derived_data()

        persisted = first_save.call_args.args[0].copy(deep=True)
        assert persisted.stale == {stale_hash: 20}
        assert first_ranges.call_args_list[1].kwargs["group_id_lower_bound"] == 10
        discover.assert_not_called()

        with (
            override_options(
                {
                    "issues.derived.heal-max-tasks": 1,
                    "issues.derived.check-task-count": 0,
                }
            ),
            patch("sentry.issues.derived.tasks.load_state", return_value=persisted),
            patch("sentry.issues.derived.tasks.save_state") as second_save,
            patch("sentry.issues.derived.tasks._discover_stale_pipeline_hashes") as discover,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    GroupIdRangeResult(ranges=[], drained=True),
                    GroupIdRangeResult(ranges=[(20, 30)], drained=False),
                ],
            ) as second_ranges,
            patch.object(regenerate_stale_derived_data_batch, "delay"),
        ):
            heal_stale_derived_data()

        assert second_save.call_args.args[0].stale == {stale_hash: 30}
        assert second_ranges.call_args_list[1].kwargs["group_id_lower_bound"] == 20
        discover.assert_not_called()

    def test_drained_hash_is_removed_then_rediscovered(self) -> None:
        stale_hash = self._pick_stale_hash()
        state = HealSchedulerState(
            head_hash=PIPELINE.pipeline_hash,
            stale={stale_hash: 10},
            discovered_at=datetime.now(timezone.utc),
        )
        options = {
            "issues.derived.heal-max-tasks": 1,
            "issues.derived.check-task-count": 0,
        }
        with (
            override_options(options),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch("sentry.issues.derived.tasks.save_state") as first_save,
            patch("sentry.issues.derived.tasks._discover_stale_pipeline_hashes") as discover,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                return_value=GroupIdRangeResult(ranges=[], drained=True),
            ),
        ):
            heal_stale_derived_data()

        retired = first_save.call_args.args[0].copy(deep=True)
        assert retired.stale == {}
        discover.assert_not_called()

        with (
            override_options(options),
            patch("sentry.issues.derived.tasks.load_state", return_value=retired),
            patch("sentry.issues.derived.tasks.save_state"),
            patch(
                "sentry.issues.derived.tasks._discover_stale_pipeline_hashes",
                return_value=[stale_hash],
            ) as discover,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    GroupIdRangeResult(ranges=[], drained=True),
                    GroupIdRangeResult(ranges=[(1, 2)], drained=False),
                ],
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay"),
        ):
            heal_stale_derived_data()

        discover.assert_called_once_with(PIPELINE.pipeline_hash, 5)

    def test_null_starts_at_zero_without_rewriting_state(self) -> None:
        stale_hash = self._pick_stale_hash()
        state = HealSchedulerState(
            head_hash=PIPELINE.pipeline_hash,
            stale={stale_hash: 50},
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options({"issues.derived.heal-max-tasks": 1}),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch("sentry.issues.derived.tasks.save_state") as mock_save,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                return_value=GroupIdRangeResult(ranges=[(1, 2)], drained=False),
            ) as mock_ranges,
            patch.object(regenerate_stale_derived_data_batch, "delay"),
        ):
            heal_stale_derived_data()

        mock_ranges.assert_called_once_with(
            None,
            range_size=500,
            max_ranges=1,
            group_id_lower_bound=0,
        )
        mock_save.assert_not_called()
        assert state.stale == {stale_hash: 50}

    def test_mark_is_saved_before_scheduling_the_next_hash(self) -> None:
        hash_a = self._pick_stale_hash("a")
        hash_b = self._pick_stale_hash("b")
        state = HealSchedulerState(
            head_hash=PIPELINE.pipeline_hash,
            stale={hash_a: 10, hash_b: 10},
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options(
                {
                    "issues.derived.heal-max-tasks": 2,
                    "issues.derived.check-task-count": 0,
                }
            ),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch("sentry.issues.derived.tasks.save_state") as mock_save,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    GroupIdRangeResult(ranges=[], drained=True),
                    GroupIdRangeResult(ranges=[(10, 20)], drained=False),
                    RuntimeError("range selection failed"),
                ],
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay"),
        ):
            with pytest.raises(RuntimeError):
                heal_stale_derived_data()

        mock_save.assert_called_once_with(state)
        assert state.stale == {hash_a: 20, hash_b: 10}

    def test_marks_are_saved_when_check_fan_out_fails(self) -> None:
        stale_hash = self._pick_stale_hash()
        state = HealSchedulerState(
            head_hash=PIPELINE.pipeline_hash,
            stale={stale_hash: 10},
            discovered_at=datetime.now(timezone.utc),
        )
        with (
            override_options(
                {
                    "issues.derived.heal-max-tasks": 2,
                    "issues.derived.check-task-count": 1,
                }
            ),
            patch("sentry.issues.derived.tasks.load_state", return_value=state),
            patch("sentry.issues.derived.tasks.save_state") as mock_save,
            patch(
                "sentry.issues.derived.tasks_util.group_id_ranges_for_hash",
                side_effect=[
                    GroupIdRangeResult(ranges=[], drained=True),
                    GroupIdRangeResult(ranges=[(10, 20)], drained=False),
                ],
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay"),
            patch(
                "sentry.issues.derived.tasks_util._pick_random_fresh_group_ranges",
                side_effect=RuntimeError("check selection failed"),
            ),
        ):
            with pytest.raises(RuntimeError):
                heal_stale_derived_data()

        mock_save.assert_called_once_with(state)
        assert state.stale == {stale_hash: 20}

    def test_no_stale_data(self) -> None:
        groups = self.create_unprocessed_groups(2)
        for g in groups:
            process_group_log(g.id)

        group_ids = sorted(group.id for group in groups)
        with (
            patch("sentry.issues.derived.tasks_util.random.randint", return_value=group_ids[0]),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_regenerate,
            patch.object(check_fresh_derived_data_batch, "delay") as mock_check,
        ):
            heal_stale_derived_data()

        mock_regenerate.assert_not_called()
        # One anchor + contiguous fan-out; 2 groups fit in a single default batch.
        mock_check.assert_called_once_with(
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
        )

    def test_schedules_contiguous_ranges_from_one_anchor(self) -> None:
        groups = self.create_unprocessed_groups(4)
        group_ids = sorted(group.id for group in groups)
        for group_id in group_ids:
            process_group_log(group_id)

        with (
            override_options(
                {
                    "issues.derived.check-task-count": 2,
                    "issues.derived.heal-batch-size": 2,
                }
            ),
            patch("sentry.issues.derived.tasks_util.random.randint", return_value=group_ids[0]),
            patch.object(check_fresh_derived_data_batch, "delay") as mock_check,
        ):
            heal_stale_derived_data()

        assert mock_check.call_args_list == [
            call(group_id_start=group_ids[0], group_id_end=group_ids[1] + 1),
            call(group_id_start=group_ids[2], group_id_end=group_ids[3] + 1),
        ]

    def test_respects_killswitch(self) -> None:
        groups = self.create_unprocessed_groups(1)
        process_group_log(groups[0].id)
        GroupDerivedData.objects.filter(group_id=groups[0].id).update(
            pipeline_hash=self._pick_stale_hash()
        )

        with (
            override_options({"issues.derived.heal-enabled": False}),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay,
        ):
            heal_stale_derived_data()

        mock_delay.assert_not_called()

    def test_bails_on_invalid_batch_configuration(self) -> None:
        groups = self.create_unprocessed_groups(1)
        process_group_log(groups[0].id)
        GroupDerivedData.objects.filter(group_id=groups[0].id).update(
            pipeline_hash=self._pick_stale_hash()
        )

        with (
            override_options({"issues.derived.heal-max-tasks": 0}),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay,
            patch.object(check_fresh_derived_data_batch, "delay") as mock_check,
        ):
            heal_stale_derived_data()

        # Neither healing nor the "nothing to heal" check fan-out should fire.
        mock_delay.assert_not_called()
        mock_check.assert_not_called()

    def test_dispatches_one_task_per_stale_hash(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        hash_a = self._pick_stale_hash("0")
        hash_b = self._pick_stale_hash("y")
        GroupDerivedData.objects.filter(group_id__in=group_ids[:2]).update(pipeline_hash=hash_a)
        GroupDerivedData.objects.filter(group_id=group_ids[2]).update(pipeline_hash=hash_b)

        with patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay:
            heal_stale_derived_data()

        # Ranges are computed per hash, so each hash gets its own task targeting
        # just that hash.
        assert [c.kwargs["target_hash"] for c in mock_delay.call_args_list] == [hash_a, hash_b]
        assert [
            (c.kwargs["group_id_start"], c.kwargs["group_id_end"])
            for c in mock_delay.call_args_list
        ] == [(group_ids[0], group_ids[1] + 1), (group_ids[2], group_ids[2] + 1)]

    def test_null_range_does_not_overlap_stale_hash_range(self) -> None:
        # NULL and stale-hash rows interleave in ID space, so the ranges overlap.
        # Each task must be scoped so the overlap isn't processed twice.
        groups = self.create_unprocessed_groups(4)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        stale = self._pick_stale_hash()
        GroupDerivedData.objects.filter(group_id__in=group_ids[::2]).update(pipeline_hash=None)
        GroupDerivedData.objects.filter(group_id__in=group_ids[1::2]).update(pipeline_hash=stale)

        with patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay:
            heal_stale_derived_data()

        # NULL is scheduled first — it means an explicit invalidation. The two
        # ranges overlap, but their targets are disjoint.
        assert [
            (
                c.kwargs["target_hash"],
                c.kwargs["group_id_start"],
                c.kwargs["group_id_end"],
            )
            for c in mock_delay.call_args_list
        ] == [
            (None, group_ids[0], group_ids[2] + 1),
            (stale, group_ids[1], group_ids[3] + 1),
        ]

    def test_null_hash_is_prioritized_over_stale_hashes(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        stale = self._pick_stale_hash()
        # The stale-hash row sorts first, so ordering alone wouldn't pick NULL.
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash=stale)
        GroupDerivedData.objects.filter(group_id=group_ids[1]).update(pipeline_hash=None)

        with (
            override_options({"issues.derived.heal-max-tasks": 1}),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay,
        ):
            heal_stale_derived_data()

        mock_delay.assert_called_once()
        assert mock_delay.call_args.kwargs["target_hash"] is None
        assert mock_delay.call_args.kwargs["group_id_start"] == group_ids[1]

    def test_null_hash_is_always_stale_without_being_listed(self) -> None:
        groups = self.create_unprocessed_groups(1)
        process_group_log(groups[0].id)
        GroupDerivedData.objects.filter(group_id=groups[0].id).update(pipeline_hash=None)

        with patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay:
            heal_stale_derived_data()

        mock_delay.assert_called_once()
        kwargs = mock_delay.call_args.kwargs
        assert kwargs["target_hash"] is None
        assert kwargs["group_id_start"] == groups[0].id
        assert kwargs["group_id_end"] == groups[0].id + 1

    def test_respects_max_tasks(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)
        stale = self._pick_stale_hash()
        GroupDerivedData.objects.filter(group_id__in=group_ids).update(pipeline_hash=stale)

        with (
            override_options(
                {
                    "issues.derived.heal-batch-size": 1,
                    "issues.derived.heal-max-tasks": 2,
                }
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay,
            patch.object(check_fresh_derived_data_batch, "delay") as mock_check,
        ):
            heal_stale_derived_data()

        # 3 chunks would be produced, but max_tasks caps to 2 and the third group
        # is left for the next invocation rather than folded into the last range.
        assert [
            (c.kwargs["group_id_start"], c.kwargs["group_id_end"])
            for c in mock_delay.call_args_list
        ] == [(group_ids[0], group_ids[1]), (group_ids[1], group_ids[2])]
        # Budget fully consumed by heal work, so no consistency checks fire.
        mock_check.assert_not_called()

    def test_schedules_checks_with_leftover_heal_budget(self) -> None:
        groups = self.create_unprocessed_groups(4)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        stale = self._pick_stale_hash()
        # One stale row leaves heal budget free for checks on the fresh rows.
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash=stale)

        with (
            override_options(
                {
                    "issues.derived.heal-batch-size": 1,
                    "issues.derived.heal-max-tasks": 3,
                    "issues.derived.check-task-count": 5,
                }
            ),
            patch("sentry.issues.derived.tasks_util.random.randint", return_value=group_ids[1]),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_regenerate,
            patch.object(check_fresh_derived_data_batch, "delay") as mock_check,
        ):
            heal_stale_derived_data()

        mock_regenerate.assert_called_once_with(
            target_hash=stale,
            group_id_start=group_ids[0],
            group_id_end=group_ids[0] + 1,
        )
        # Remaining budget is 2, so checks are capped there even though
        # check-task-count is higher.
        assert mock_check.call_args_list == [
            call(group_id_start=group_ids[1], group_id_end=group_ids[1] + 1),
            call(group_id_start=group_ids[2], group_id_end=group_ids[2] + 1),
        ]


@with_feature("projects:issue-action-log-write-to-db")
class CheckFreshDerivedDataBatchTest(DerivedDataTaskTestBase):
    @override_options({"issues.derived.status-consistency-check-enabled": False})
    def test_corrupt_row_does_not_abort_other_checks(self) -> None:
        groups = self.create_unprocessed_groups(2)
        ids = sorted(group.id for group in groups)
        for group_id in ids:
            process_group_log(group_id)
        GroupDerivedData.objects.filter(group_id=ids[0]).update(data={"status": "invalid"})
        with (
            patch.object(check_fresh_derived_data_batch, "delay") as delay,
            patch("sentry.issues.derived.tasks_util._record_check_result") as record,
            patch("sentry.issues.derived.reporting.logger") as logger,
        ):
            check_fresh_derived_data_batch(group_id_start=ids[0], group_id_end=ids[-1] + 1)
        delay.assert_not_called()
        record.assert_called_once()
        logger.exception.assert_called_once()
        assert logger.exception.call_args.kwargs["extra"]["operation"] == "check"

    def test_check_database_failure_propagates(self) -> None:
        group = self.create_unprocessed_groups(1)[0]
        process_group_log(group.id)
        with (
            patch(
                "sentry.issues.derived.check.check_derived_data",
                side_effect=OperationalError("offline"),
            ),
            pytest.raises(OperationalError),
        ):
            check_fresh_derived_data_batch(group_id_start=group.id, group_id_end=group.id + 1)

    def test_checks_only_fresh_rows_inline(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(group.id for group in groups)
        for group_id in group_ids:
            process_group_log(group_id)
        GroupDerivedData.objects.filter(group_id=group_ids[1]).update(pipeline_hash="stale")

        with patch("sentry.issues.derived.tasks_util.metrics.incr") as mock_incr:
            check_fresh_derived_data_batch(
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )

        assert mock_incr.call_args_list == [
            call(
                "issues.status_reconciliation.checked",
                sample_rate=1.0,
                tags={"result": "aligned", "source": "batch_check"},
            ),
            call("issues.derived.check_group", sample_rate=1.0, tags={"result": "success"}),
            call(
                "issues.status_reconciliation.checked",
                sample_rate=1.0,
                tags={"result": "aligned", "source": "batch_check"},
            ),
            call("issues.derived.check_group", sample_rate=1.0, tags={"result": "success"}),
        ]

    def test_reschedules_timed_out_group_with_check_id(self) -> None:
        group = self.create_unprocessed_groups(1)[0]
        derived = process_group_log(group.id)
        assert derived.pipeline_hash is not None
        check_id = CheckId(
            "invocation-id",
            group.id,
            derived.generated_at,
            derived.cursor_date,
            derived.cursor_id,
            derived.pipeline_hash,
        )

        with (
            patch(
                "sentry.issues.derived.check.check_derived_data",
                side_effect=CheckTimeout(check_id),
            ),
            patch.object(check_fresh_derived_data_batch, "delay") as mock_delay,
        ):
            check_fresh_derived_data_batch(
                group_id_start=group.id,
                group_id_end=group.id + 1,
            )

        mock_delay.assert_called_once_with(
            group_id_start=group.id,
            group_id_end=group.id + 1,
            resume_check_id="invocation-id",
            resume_generated_at=derived.generated_at.isoformat(),
            resume_cursor_date=derived.cursor_date.isoformat(),
            resume_cursor_id=derived.cursor_id,
            resume_pipeline_hash=derived.pipeline_hash,
            prior_runs=1,
        )

    def test_advances_after_check_retry_limit(self) -> None:
        group = self.create_unprocessed_groups(1)[0]
        derived = process_group_log(group.id)
        assert derived.pipeline_hash is not None
        check_id = CheckId(
            "invocation-id",
            group.id,
            derived.generated_at,
            derived.cursor_date,
            derived.cursor_id,
            derived.pipeline_hash,
        )

        with (
            patch(
                "sentry.issues.derived.check.check_derived_data",
                side_effect=CheckTimeout(check_id),
            ),
            patch("sentry.issues.derived.tasks._MAX_CHECK_RUNS", 1),
            patch.object(check_fresh_derived_data_batch, "delay") as mock_delay,
            patch("sentry.issues.derived.tasks_util.metrics.incr") as mock_incr,
        ):
            check_fresh_derived_data_batch(
                group_id_start=group.id,
                group_id_end=group.id + 2,
            )

        mock_delay.assert_called_once_with(
            group_id_start=group.id + 1,
            group_id_end=group.id + 2,
        )
        assert mock_incr.call_args_list == [
            call(
                "issues.status_reconciliation.checked",
                sample_rate=1.0,
                tags={"result": "aligned", "source": "batch_check"},
            ),
            call(
                "issues.derived.check_group",
                sample_rate=1.0,
                tags={"result": "no_result"},
            ),
        ]

    def test_records_status_inconsistency_for_backfilled_project(self) -> None:
        group = self.create_unprocessed_groups(1)[0]
        process_group_log(group.id)
        group.update(status=GroupStatus.IGNORED)
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)
        GroupDerivedData.objects.filter(group_id=group.id).update(
            data={"status": "open"},
        )

        with patch("sentry.issues.derived.check.metrics.incr") as mock_incr:
            check_fresh_derived_data_batch(
                group_id_start=group.id,
                group_id_end=group.id + 1,
            )

        assert (
            call(
                "issues.status_reconciliation.checked",
                sample_rate=1.0,
                tags={
                    "result": "diverged",
                    "derived_status": "open",
                    "actual_status": "closed",
                    "source": "batch_check",
                },
            )
            in mock_incr.call_args_list
        )

    def test_skips_status_check_when_not_derived_should_be_correct(self) -> None:
        group = self.create_unprocessed_groups(1)[0]
        process_group_log(group.id)
        group.update(status=GroupStatus.IGNORED)
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, False)
        GroupDerivedData.objects.filter(group_id=group.id).update(data={"status": "open"})

        with patch("sentry.issues.derived.check.record_status_consistency") as mock_record_status:
            check_fresh_derived_data_batch(
                group_id_start=group.id,
                group_id_end=group.id + 1,
            )

        mock_record_status.assert_not_called()

    @override_options({"issues.derived.status-consistency-check-enabled": False})
    def test_skips_status_check_when_option_disabled(self) -> None:
        group = self.create_unprocessed_groups(1)[0]
        process_group_log(group.id)
        group.update(status=GroupStatus.IGNORED)
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)
        GroupDerivedData.objects.filter(group_id=group.id).update(data={"status": "open"})

        with patch("sentry.issues.derived.check.record_status_consistency") as mock_record_status:
            check_fresh_derived_data_batch(
                group_id_start=group.id,
                group_id_end=group.id + 1,
            )

        mock_record_status.assert_not_called()

    def test_status_check_runs_before_derived_check_timeout(self) -> None:
        group = self.create_unprocessed_groups(1)[0]
        derived = process_group_log(group.id)
        assert derived.pipeline_hash is not None
        group.update(status=GroupStatus.IGNORED)
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)
        GroupDerivedData.objects.filter(group_id=group.id).update(data={"status": "open"})
        check_id = CheckId(
            "invocation-id",
            group.id,
            derived.generated_at,
            derived.cursor_date,
            derived.cursor_id,
            derived.pipeline_hash,
        )

        with (
            patch(
                "sentry.issues.derived.check.check_derived_data",
                side_effect=CheckTimeout(check_id),
            ),
            patch.object(check_fresh_derived_data_batch, "delay"),
            patch("sentry.issues.derived.check.record_status_consistency") as mock_record_status,
        ):
            check_fresh_derived_data_batch(
                group_id_start=group.id,
                group_id_end=group.id + 1,
            )

        mock_record_status.assert_called_once()


@with_feature("projects:issue-action-log-write-to-db")
class PickRandomFreshGroupRangesTest(DerivedDataTaskTestBase):
    def test_returns_contiguous_ranges_from_anchor(self) -> None:
        groups = self.create_unprocessed_groups(6)
        group_ids = sorted(group.id for group in groups)
        for group_id in group_ids:
            process_group_log(group_id)

        with patch("sentry.issues.derived.tasks_util.random.randint", return_value=group_ids[1]):
            result = _pick_random_fresh_group_ranges(
                PIPELINE.pipeline_hash, batch_size=2, task_count=2
            )

        # need=4 and 5 rows remain at/after anchor → no slide.
        assert result == [
            (group_ids[1], group_ids[2] + 1),
            (group_ids[3], group_ids[4] + 1),
        ]

    def test_slides_window_to_fill_near_upper_bound(self) -> None:
        groups = self.create_unprocessed_groups(5)
        group_ids = sorted(group.id for group in groups)
        for group_id in group_ids:
            process_group_log(group_id)

        with patch("sentry.issues.derived.tasks_util.random.randint", return_value=group_ids[-1]):
            result = _pick_random_fresh_group_ranges(
                PIPELINE.pipeline_hash, batch_size=2, task_count=1
            )

        # need=2 but only 1 row forward of the anchor → last 2 fresh rows.
        assert result == [(group_ids[-2], group_ids[-1] + 1)]

    def test_slides_to_all_rows_when_table_smaller_than_need(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(group.id for group in groups)
        for group_id in group_ids:
            process_group_log(group_id)

        with patch("sentry.issues.derived.tasks_util.random.randint", return_value=group_ids[-1]):
            result = _pick_random_fresh_group_ranges(
                PIPELINE.pipeline_hash, batch_size=2, task_count=2
            )

        assert result == [
            (group_ids[0], group_ids[1] + 1),
            (group_ids[2], group_ids[2] + 1),
        ]

    def test_returns_empty_without_fresh_rows(self) -> None:
        assert (
            _pick_random_fresh_group_ranges(PIPELINE.pipeline_hash, batch_size=1000, task_count=5)
            == []
        )

    def test_caps_total_groups(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(group.id for group in groups)
        for group_id in group_ids:
            process_group_log(group_id)

        with (
            patch("sentry.issues.derived.tasks_util._MAX_CHECK_GROUPS", 2),
            patch("sentry.issues.derived.tasks_util.random.randint", return_value=group_ids[0]),
        ):
            result = _pick_random_fresh_group_ranges(
                PIPELINE.pipeline_hash, batch_size=1000, task_count=5
            )

        assert result == [(group_ids[0], group_ids[1] + 1)]


class TestGroupIdRangeMath:
    def test_exact_ranges_use_lookahead_to_close_final_range(self) -> None:
        assert _exact_group_id_ranges([10, 20, 30, 40, 50], range_size=2, max_ranges=2) == [
            (10, 30),
            (30, 50),
        ]

    def test_exact_ranges_close_short_tail_after_last_group(self) -> None:
        assert _exact_group_id_ranges([10, 20, 30], range_size=2, max_ranges=5) == [
            (10, 30),
            (30, 31),
        ]

    def test_estimated_ranges_use_sample_density(self) -> None:
        assert _estimate_group_id_ranges([10, 20, 31], range_size=2, range_count=2) == [
            (10, 25),
            (25, 40),
        ]


@with_feature("projects:issue-action-log-write-to-db")
class GroupIdRangesForHashTest(DerivedDataTaskTestBase):
    HASH = "a" * 16
    OTHER_HASH = "b" * 16

    def _seed(self, count: int, pipeline_hash: str | None) -> list[int]:
        groups = self.create_unprocessed_groups(count)
        for group in groups:
            GroupDerivedData.objects.create(group_id=group.id, pipeline_hash=pipeline_hash)
        return sorted(group.id for group in groups)

    def test_no_matching_rows(self) -> None:
        self._seed(2, self.OTHER_HASH)

        assert group_id_ranges_for_hash(
            self.HASH, range_size=2, max_ranges=5
        ) == GroupIdRangeResult(ranges=[], drained=True)
        assert group_id_ranges_for_hash(None, range_size=2, max_ranges=5) == GroupIdRangeResult(
            ranges=[], drained=True
        )

    def test_query_has_statement_timeout(self) -> None:
        with patch("sentry.issues.derived.tasks_util.statement_timeout") as timeout:
            group_id_ranges_for_hash(self.HASH, range_size=2, max_ranges=5)

        query_timeout = timeout.call_args.args[1]
        assert timedelta(0) < query_timeout <= timedelta(seconds=40)

    def test_short_tail_is_one_range(self) -> None:
        null_ids = self._seed(3, None)
        hash_ids = self._seed(3, self.HASH)

        # Fewer rows than range_size, for both the NULL and the concrete-hash
        # predicate, and neither picks up the other's rows.
        assert group_id_ranges_for_hash(None, range_size=10, max_ranges=5).ranges == [
            (null_ids[0], null_ids[-1] + 1)
        ]
        assert group_id_ranges_for_hash(self.HASH, range_size=10, max_ranges=5).ranges == [
            (hash_ids[0], hash_ids[-1] + 1)
        ]

    def test_exact_chunk_boundaries(self) -> None:
        group_ids = self._seed(5, self.HASH)

        assert group_id_ranges_for_hash(self.HASH, range_size=2, max_ranges=5).ranges == [
            (group_ids[0], group_ids[2]),
            (group_ids[2], group_ids[4]),
            (group_ids[4], group_ids[4] + 1),
        ]

    def test_truncates_to_max_ranges(self) -> None:
        group_ids = self._seed(5, self.HASH)

        # The 5th group is left out rather than folded into an oversized last range.
        assert group_id_ranges_for_hash(self.HASH, range_size=2, max_ranges=2).ranges == [
            (group_ids[0], group_ids[2]),
            (group_ids[2], group_ids[4]),
        ]

    def test_truncates_full_tail_to_max_ranges(self) -> None:
        group_ids = self._seed(6, self.HASH)

        assert group_id_ranges_for_hash(self.HASH, range_size=2, max_ranges=2).ranges == [
            (group_ids[0], group_ids[2]),
            (group_ids[2], group_ids[4]),
        ]

    def test_invalid_chunking(self) -> None:
        self._seed(2, self.HASH)

        assert group_id_ranges_for_hash(
            self.HASH, range_size=0, max_ranges=5
        ) == GroupIdRangeResult(ranges=[], drained=False)
        assert group_id_ranges_for_hash(
            self.HASH, range_size=2, max_ranges=0
        ) == GroupIdRangeResult(ranges=[], drained=False)

    def test_density_probes_share_one_query_budget(self) -> None:
        with (
            patch(
                "sentry.issues.derived.tasks_util.time.monotonic",
                # Query deadline, metrics timer start, budget check, metrics timer end.
                side_effect=[0.0, 0.0, 41.0, 41.0],
            ),
            pytest.raises(OperationalError, match="query budget exceeded"),
        ):
            group_id_ranges_for_hash(self.HASH, range_size=2, max_ranges=5)

    def test_samples_local_density_for_approximate_ranges(self) -> None:
        groups = self.create_unprocessed_groups(81)
        all_group_ids = sorted(group.id for group in groups)
        matching_group_ids = [all_group_ids[index] for index in range(0, 81, 10)]
        for group_id in all_group_ids:
            GroupDerivedData.objects.create(
                group_id=group_id,
                pipeline_hash=self.HASH if group_id in matching_group_ids else self.OTHER_HASH,
            )

        with (
            patch("sentry.issues.derived.tasks_util._MAX_EXACT_RANGE_ROWS", 0),
            patch("sentry.issues.derived.tasks_util._RANGE_DENSITY_SAMPLE_SIZE", 2),
            patch("sentry.issues.derived.tasks_util._RANGES_PER_DENSITY_SAMPLE", 2),
            patch("sentry.issues.derived.tasks_util._MAX_RANGE_DENSITY_SAMPLES", 2),
        ):
            result = group_id_ranges_for_hash(self.HASH, range_size=4, max_ranges=4)

        assert len(result.ranges) == 4
        assert result.ranges == sorted(result.ranges)
        assert all(
            any(start <= group_id < end for start, end in result.ranges)
            for group_id in matching_group_ids
        )

    def test_low_volume_request_uses_exact_boundaries(self) -> None:
        group_ids = self._seed(5, self.HASH)

        with (
            patch("sentry.issues.derived.tasks_util._MAX_EXACT_RANGE_ROWS", 10),
            patch("sentry.issues.derived.tasks_util._RANGE_DENSITY_SAMPLE_SIZE", 2),
        ):
            result = group_id_ranges_for_hash(self.HASH, range_size=2, max_ranges=5)

        assert result.ranges == [
            (group_ids[0], group_ids[2]),
            (group_ids[2], group_ids[4]),
            (group_ids[4], group_ids[4] + 1),
        ]

    def test_lower_bound(self) -> None:
        group_ids = self._seed(3, self.HASH)

        result = group_id_ranges_for_hash(
            self.HASH,
            range_size=2,
            max_ranges=5,
            group_id_lower_bound=group_ids[1],
        )

        assert result.ranges == [(group_ids[1], group_ids[2] + 1)]


@with_feature("projects:issue-action-log-write-to-db")
class RegenerateStaleDerivedDataBatchTest(DerivedDataTaskTestBase):
    @staticmethod
    def _stale() -> str:
        return "0" * 16 if PIPELINE.pipeline_hash != "0" * 16 else "z" * 16

    def test_rebuilds_stale_rows(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        stale = self._stale()
        GroupDerivedData.objects.filter(group_id__in=group_ids).update(pipeline_hash=stale)

        regenerate_stale_derived_data_batch(
            target_hash=stale,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
        )

        for gid in group_ids:
            gdd = GroupDerivedData.objects.get(group_id=gid)
            assert gdd.pipeline_hash == PIPELINE.pipeline_hash

    def test_rebuilds_null_hash_rows_when_target_is_none(self) -> None:
        groups = self.create_unprocessed_groups(1)
        gid = groups[0].id
        process_group_log(gid)
        GroupDerivedData.objects.filter(group_id=gid).update(pipeline_hash=None)

        regenerate_stale_derived_data_batch(
            target_hash=None,
            group_id_start=gid,
            group_id_end=gid + 1,
        )

        gdd = GroupDerivedData.objects.get(group_id=gid)
        assert gdd.pipeline_hash == PIPELINE.pipeline_hash

    def test_targets_only_the_given_hash(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        stale = self._stale()
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash=None)
        GroupDerivedData.objects.filter(group_id=group_ids[1]).update(pipeline_hash=stale)

        regenerate_stale_derived_data_batch(
            target_hash=stale,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
        )

        # The NULL row belongs to the task targeting None, not this one.
        assert GroupDerivedData.objects.get(group_id=group_ids[0]).pipeline_hash is None
        assert (
            GroupDerivedData.objects.get(group_id=group_ids[1]).pipeline_hash
            == PIPELINE.pipeline_hash
        )

    def test_skips_rows_no_longer_stale(self) -> None:
        # Row now has the current hash — the range query should return
        # nothing so build_and_promote is never called.
        groups = self.create_unprocessed_groups(1)
        gid = groups[0].id
        process_group_log(gid)

        with patch("sentry.issues.derived.promote.build_and_promote_derived_data") as mock_build:
            regenerate_stale_derived_data_batch(
                target_hash=self._stale(),
                group_id_start=gid,
                group_id_end=gid + 1,
            )
        mock_build.assert_not_called()

    def test_reschedules_on_batch_timeout(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        stale = self._stale()
        GroupDerivedData.objects.filter(group_id__in=group_ids).update(pipeline_hash=stale)

        with (
            patch("sentry.issues.derived.promote.time") as mock_time,
            patch("sentry.issues.derived.promote.build_and_promote_derived_data") as mock_build,
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay,
        ):
            expired = BATCH_RETRIGGER_TIMEOUT.total_seconds() + 1
            # Helper start(), iter 1 remaining, iter 1 deadline check
            # (triggers reschedule after the first group).
            mock_time.monotonic.side_effect = [0.0, 0.0, expired]

            regenerate_stale_derived_data_batch(
                target_hash=stale,
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )

        mock_build.assert_called_once()
        mock_delay.assert_called_once()
        kwargs = mock_delay.call_args.kwargs
        assert kwargs["target_hash"] == stale
        assert kwargs["group_id_start"] == group_ids[0] + 1
        assert kwargs["group_id_end"] == group_ids[-1] + 1

    def test_reschedules_when_estimated_range_is_overfull(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        stale = self._stale()
        GroupDerivedData.objects.filter(group_id__in=group_ids).update(pipeline_hash=stale)

        with (
            override_options({"issues.derived.heal-batch-size": 2}),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay,
        ):
            regenerate_stale_derived_data_batch(
                target_hash=stale,
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )

        assert (
            GroupDerivedData.objects.get(group_id=group_ids[0]).pipeline_hash
            == PIPELINE.pipeline_hash
        )
        assert (
            GroupDerivedData.objects.get(group_id=group_ids[1]).pipeline_hash
            == PIPELINE.pipeline_hash
        )
        assert GroupDerivedData.objects.get(group_id=group_ids[2]).pipeline_hash == stale
        mock_delay.assert_called_once_with(
            target_hash=stale,
            group_id_start=group_ids[1] + 1,
            group_id_end=group_ids[-1] + 1,
            rows_found_before=2,
            range_overflowed=True,
        )

    def test_records_rows_found_across_overflow_retriggers(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        stale = self._stale()
        GroupDerivedData.objects.filter(group_id__in=group_ids).update(pipeline_hash=stale)

        with (
            override_options({"issues.derived.heal-batch-size": 2}),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay,
            patch("sentry.issues.derived.tasks.metrics.distribution") as distribution,
        ):
            regenerate_stale_derived_data_batch(
                target_hash=stale,
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )

            distribution.assert_not_called()
            regenerate_stale_derived_data_batch(**mock_delay.call_args.kwargs)

        distribution.assert_called_once_with(
            "issues.derived.heal_range_rows_found",
            3,
            sample_rate=1.0,
            tags={"hash_kind": "stale", "range_overflowed": "true"},
        )

    def test_reschedules_on_group_log_timeout(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        stale = self._stale()
        GroupDerivedData.objects.filter(group_id__in=group_ids).update(pipeline_hash=stale)

        with (
            patch(
                "sentry.issues.derived.promote.build_and_promote_derived_data",
                side_effect=GroupLogTimeout(0),
            ),
            patch.object(regenerate_stale_derived_data_batch, "delay") as mock_delay,
        ):
            regenerate_stale_derived_data_batch(
                target_hash=stale,
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )

        mock_delay.assert_called_once()
        kwargs = mock_delay.call_args.kwargs
        # Resume from the SAME group on a per-group timeout.
        assert kwargs["group_id_start"] == group_ids[0]
        assert kwargs["target_hash"] == stale


@with_feature("projects:issue-action-log-write-to-db")
class DiscoverStalePipelineHashesTest(DerivedDataTaskTestBase):
    def _seed_hashes(self, hashes: Sequence[str | None], per_hash: int = 1) -> None:
        for h in hashes:
            groups = self.create_unprocessed_groups(per_hash)
            for group in groups:
                GroupDerivedData.objects.create(group_id=group.id, pipeline_hash=h)

    def test_returns_empty_when_only_current_hash_present(self) -> None:
        current = PIPELINE.pipeline_hash
        self._seed_hashes([current, current, current])

        assert _discover_stale_pipeline_hashes(current, limit=5) == []

    def test_returns_empty_when_table_empty(self) -> None:
        assert _discover_stale_pipeline_hashes(PIPELINE.pipeline_hash, limit=5) == []

    def test_query_has_statement_timeout(self) -> None:
        with patch("sentry.issues.derived.tasks.statement_timeout") as timeout:
            _discover_stale_pipeline_hashes(PIPELINE.pipeline_hash, limit=5)

        assert timeout.call_args.args[1] == timedelta(seconds=15)

    def test_excludes_null_pipeline_hash(self) -> None:
        current = PIPELINE.pipeline_hash
        self._seed_hashes([None, None])

        assert _discover_stale_pipeline_hashes(current, limit=5) == []

    def test_excludes_current_hash(self) -> None:
        current = PIPELINE.pipeline_hash
        stale_low = "0" * 16
        stale_high = "z" * 16
        self._seed_hashes([stale_low, current, stale_high])

        result = _discover_stale_pipeline_hashes(current, limit=5)
        assert current not in result
        assert set(result) == {stale_low, stale_high}

    def test_returns_distinct_hashes_across_many_duplicate_rows(self) -> None:
        current = PIPELINE.pipeline_hash
        stale = "0" * 16 if current != "0" * 16 else "1" * 16
        self._seed_hashes([stale], per_hash=25)

        assert _discover_stale_pipeline_hashes(current, limit=5) == [stale]

    def test_respects_limit(self) -> None:
        current = PIPELINE.pipeline_hash
        stale_hashes = [f"stale-{i:02d}" for i in range(5)]
        assert current not in stale_hashes
        self._seed_hashes(stale_hashes)

        result = _discover_stale_pipeline_hashes(current, limit=3)
        assert len(result) == 3
        assert result == sorted(result)
        assert set(result).issubset(set(stale_hashes))

    def test_returns_hashes_in_ascending_order(self) -> None:
        current = PIPELINE.pipeline_hash
        stale_hashes = ["c-hash", "a-hash", "b-hash"]
        assert current not in stale_hashes
        self._seed_hashes(stale_hashes)

        result = _discover_stale_pipeline_hashes(current, limit=10)
        assert result == ["a-hash", "b-hash", "c-hash"]

    def test_limit_honored_when_current_hash_appears_mid_walk(self) -> None:
        current = "m-current"
        stale_hashes = ["a-hash", "b-hash", "y-hash", "z-hash"]
        self._seed_hashes(stale_hashes + [current])

        result = _discover_stale_pipeline_hashes(current, limit=3)
        assert result == ["a-hash", "b-hash", "y-hash"]


@pytest.mark.parametrize("stage", ["decode", "aggregate", "encode"])
def test_failed_generation_does_not_reschedule(
    stage: Literal["decode", "aggregate", "encode"],
) -> None:
    with (
        patch(
            "sentry.issues.derived.promote.build_and_promote_derived_data",
            side_effect=DerivedDataError(stage),
        ),
        patch.object(generate_group_derived_data, "delay") as delay,
    ):
        generate_group_derived_data(group_id=123)
    delay.assert_not_called()


def test_generation_database_failure_propagates() -> None:
    with (
        patch(
            "sentry.issues.derived.promote.build_and_promote_derived_data",
            side_effect=OperationalError("offline"),
        ),
        pytest.raises(OperationalError),
    ):
        generate_group_derived_data(group_id=123)

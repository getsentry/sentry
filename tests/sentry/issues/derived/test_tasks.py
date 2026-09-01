from collections.abc import Sequence
from datetime import datetime, timezone
from unittest.mock import call, patch

from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import ActionSource, GroupActionActor, ViewAction
from sentry.issues.derived.check import CheckId, CheckTimeout
from sentry.issues.derived.processing import PIPELINE, GroupLogTimeout, process_group_log
from sentry.issues.derived.tasks import (
    BATCH_RETRIGGER_TIMEOUT,
    _discover_stale_pipeline_hashes,
    check_fresh_derived_data_batch,
    generate_project_derived_data,
    generate_project_derived_data_batch,
    heal_stale_derived_data,
    regenerate_stale_derived_data_batch,
)
from sentry.issues.derived.tasks_util import (
    _pick_random_fresh_group_ranges,
    group_id_ranges_for_hash,
)
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.group import Group
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


@with_feature("projects:issue-action-log-write-to-db")
class HealStaleDerivedDataTest(DerivedDataTaskTestBase):
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
            stale_pipeline_hashes=[stale],
            target_hash=stale,
            group_id_start=group_ids[0],
            group_id_end=group_ids[0] + 1,
        )

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
        # A None target means the NULL hash; the legacy list stays empty.
        assert kwargs["target_hash"] is None
        assert kwargs["stale_pipeline_hashes"] == []
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
        ):
            heal_stale_derived_data()

        # 3 chunks would be produced, but max_tasks caps to 2 and the third group
        # is left for the next invocation rather than folded into the last range.
        assert [
            (c.kwargs["group_id_start"], c.kwargs["group_id_end"])
            for c in mock_delay.call_args_list
        ] == [(group_ids[0], group_ids[1]), (group_ids[1], group_ids[2])]


@with_feature("projects:issue-action-log-write-to-db")
class CheckFreshDerivedDataBatchTest(DerivedDataTaskTestBase):
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
            call("issues.derived.check_group", sample_rate=1.0, tags={"result": "success"}),
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
        mock_incr.assert_called_once_with(
            "issues.derived.check_group",
            sample_rate=1.0,
            tags={"result": "no_result"},
        )


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

        assert group_id_ranges_for_hash(self.HASH, chunk_size=2, max_chunks=5) == []
        assert group_id_ranges_for_hash(None, chunk_size=2, max_chunks=5) == []

    def test_short_tail_is_one_range(self) -> None:
        null_ids = self._seed(3, None)
        hash_ids = self._seed(3, self.HASH)

        # Fewer rows than chunk_size, for both the NULL and the concrete-hash
        # predicate, and neither picks up the other's rows.
        assert group_id_ranges_for_hash(None, chunk_size=10, max_chunks=5) == [
            (null_ids[0], null_ids[-1] + 1)
        ]
        assert group_id_ranges_for_hash(self.HASH, chunk_size=10, max_chunks=5) == [
            (hash_ids[0], hash_ids[-1] + 1)
        ]

    def test_exact_chunk_boundaries(self) -> None:
        group_ids = self._seed(5, self.HASH)

        assert group_id_ranges_for_hash(self.HASH, chunk_size=2, max_chunks=5) == [
            (group_ids[0], group_ids[2]),
            (group_ids[2], group_ids[4]),
            (group_ids[4], group_ids[4] + 1),
        ]

    def test_truncates_to_max_chunks(self) -> None:
        group_ids = self._seed(5, self.HASH)

        # The 5th group is left out rather than folded into an oversized last range.
        assert group_id_ranges_for_hash(self.HASH, chunk_size=2, max_chunks=2) == [
            (group_ids[0], group_ids[2]),
            (group_ids[2], group_ids[4]),
        ]

    def test_truncates_when_scan_limit_is_reached(self) -> None:
        # 6 rows exactly fills the scan budget of chunk_size * (max_chunks + 1), so
        # the tail is known to be incomplete and waits for the next call.
        group_ids = self._seed(6, self.HASH)

        assert group_id_ranges_for_hash(self.HASH, chunk_size=2, max_chunks=2) == [
            (group_ids[0], group_ids[2]),
            (group_ids[2], group_ids[4]),
        ]

    def test_invalid_chunking(self) -> None:
        self._seed(2, self.HASH)

        assert group_id_ranges_for_hash(self.HASH, chunk_size=0, max_chunks=5) == []
        assert group_id_ranges_for_hash(self.HASH, chunk_size=2, max_chunks=0) == []

    def test_clamps_scan_budget(self) -> None:
        group_ids = self._seed(3, self.HASH)

        with patch("sentry.issues.derived.tasks_util._MAX_SCANNED_GROUP_IDS", 2):
            ranges = group_id_ranges_for_hash(self.HASH, chunk_size=1, max_chunks=5)

        # Only 2 rows were scanned, so the clamp must not be mistaken for having
        # reached the end — the tail may not run past what we scanned.
        assert ranges == [(group_ids[0], group_ids[1])]

    def test_clamp_never_drops_below_one_chunk(self) -> None:
        group_ids = self._seed(3, self.HASH)

        # Clamping below chunk_size would leave a single boundary, which can't close
        # a range — the caller would read the empty result as "nothing to do".
        with patch("sentry.issues.derived.tasks_util._MAX_SCANNED_GROUP_IDS", 1):
            ranges = group_id_ranges_for_hash(self.HASH, chunk_size=2, max_chunks=5)

        assert ranges == [
            (group_ids[0], group_ids[2]),
            (group_ids[2], group_ids[2] + 1),
        ]


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
            stale_pipeline_hashes=[stale],
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
            stale_pipeline_hashes=[],
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
            stale_pipeline_hashes=[stale],
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

    def test_legacy_activation_targets_first_listed_hash(self) -> None:
        # Enqueued by the previous release: a list of hashes and no target.
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)
        for gid in group_ids:
            process_group_log(gid)

        first, second = self._stale(), "y" * 16
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash=first)
        GroupDerivedData.objects.filter(group_id=group_ids[1]).update(pipeline_hash=second)

        regenerate_stale_derived_data_batch(
            stale_pipeline_hashes=[first, second],
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
        )

        # Only the first hash is covered; the rest waits for the next scheduled run.
        assert (
            GroupDerivedData.objects.get(group_id=group_ids[0]).pipeline_hash
            == PIPELINE.pipeline_hash
        )
        assert GroupDerivedData.objects.get(group_id=group_ids[1]).pipeline_hash == second

    def test_legacy_activation_with_empty_list_targets_null(self) -> None:
        groups = self.create_unprocessed_groups(1)
        gid = groups[0].id
        process_group_log(gid)
        GroupDerivedData.objects.filter(group_id=gid).update(pipeline_hash=None)

        regenerate_stale_derived_data_batch(
            stale_pipeline_hashes=[],
            group_id_start=gid,
            group_id_end=gid + 1,
        )

        assert GroupDerivedData.objects.get(group_id=gid).pipeline_hash == PIPELINE.pipeline_hash

    def test_skips_rows_no_longer_stale(self) -> None:
        # Row now has the current hash — the range query should return
        # nothing so build_and_promote is never called.
        groups = self.create_unprocessed_groups(1)
        gid = groups[0].id
        process_group_log(gid)

        with patch("sentry.issues.derived.promote.build_and_promote_derived_data") as mock_build:
            regenerate_stale_derived_data_batch(
                stale_pipeline_hashes=[self._stale()],
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
                stale_pipeline_hashes=[stale],
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
                stale_pipeline_hashes=[stale],
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

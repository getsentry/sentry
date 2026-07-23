from unittest.mock import patch

from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import ActionSource, GroupActionActor, ViewAction
from sentry.issues.derived import processing
from sentry.issues.derived.processing import PIPELINE, GroupLogTimeout, process_group_log
from sentry.issues.derived.tasks import (
    BATCH_RETRIGGER_TIMEOUT,
    heal_stale_derived_data,
    process_project_derived_data,
    process_project_derived_data_batch,
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
class ProcessProjectDerivedDataTest(DerivedDataTaskTestBase):
    def test_fans_out_batches(self) -> None:
        groups = self.create_unprocessed_groups(3)

        with patch.object(process_project_derived_data_batch, "delay") as mock_delay:
            process_project_derived_data(project_id=self.project.id)

        group_ids = sorted(g.id for g in groups)
        mock_delay.assert_called_once_with(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
            use_pipeline_hash=False,
        )

    def test_skips_already_processed_groups(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        # Pre-process first group
        process_group_log(group_ids[0])

        with patch.object(process_project_derived_data_batch, "delay") as mock_delay:
            process_project_derived_data(project_id=self.project.id)

        # First group should be excluded from the range
        mock_delay.assert_called_once()
        assert mock_delay.call_args[1]["group_id_start"] == group_ids[1]

    def test_batching(self) -> None:
        self.create_unprocessed_groups(5)

        with (
            override_options({"issues.derived.project-batch-size": 2}),
            patch.object(process_project_derived_data_batch, "delay") as mock_delay,
        ):
            process_project_derived_data(project_id=self.project.id)

        assert mock_delay.call_count == 3

    def test_exceeds_max_tasks(self) -> None:
        self.create_unprocessed_groups(3)

        with (
            override_options(
                {
                    "issues.derived.project-batch-size": 1,
                    "issues.derived.project-max-tasks": 2,
                }
            ),
            patch.object(process_project_derived_data_batch, "delay") as mock_delay,
        ):
            process_project_derived_data(project_id=self.project.id)

        mock_delay.assert_not_called()


@with_feature("projects:issue-action-log-write-to-db")
class ProcessProjectDerivedDataBatchTest(DerivedDataTaskTestBase):
    def test_processes_range(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        process_project_derived_data_batch(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
        )

        for group in groups:
            assert GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_skips_deleted_groups(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)
        deleted_id = groups[1].id
        groups[1].delete()

        process_project_derived_data_batch(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
        )

        assert not GroupDerivedData.objects.filter(group_id=deleted_id).exists()

    def test_reschedules_on_timeout(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        # First call succeeds; monotonic then jumps past the timeout
        with (
            patch("sentry.issues.derived.tasks.time") as mock_time,
            patch.object(processing, "process_group_log") as mock_process,
            patch.object(process_project_derived_data_batch, "delay") as mock_delay,
        ):
            expired = BATCH_RETRIGGER_TIMEOUT.total_seconds() + 1
            mock_time.monotonic.side_effect = [0.0, 0.0, expired, expired]

            process_project_derived_data_batch(
                project_id=self.project.id,
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )

        mock_process.assert_called_once()
        mock_delay.assert_called_once_with(
            project_id=self.project.id,
            group_id_start=group_ids[1],
            group_id_end=group_ids[-1] + 1,
            use_pipeline_hash=False,
        )

    def test_reschedules_on_group_log_timeout(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        with (
            patch.object(
                processing,
                "process_group_log",
                side_effect=GroupLogTimeout(0),
            ),
            patch.object(process_project_derived_data_batch, "delay") as mock_delay,
        ):
            process_project_derived_data_batch(
                project_id=self.project.id,
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )
        # On GroupLogTimeout, reschedule starts from the SAME group
        mock_delay.assert_called_once_with(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
            use_pipeline_hash=False,
        )


@with_feature("projects:issue-action-log-write-to-db")
class ProcessProjectDerivedDataWithPipelineHashTest(DerivedDataTaskTestBase):
    def test_includes_stale_hash_groups(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        # Process all groups so they have GDD rows
        for gid in group_ids:
            process_group_log(gid)

        # Stamp one with a stale hash
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash="stale")

        with patch.object(process_project_derived_data_batch, "delay") as mock_delay:
            process_project_derived_data(project_id=self.project.id, use_pipeline_hash=True)

        # Only the stale group should be included
        mock_delay.assert_called_once()
        assert mock_delay.call_args[1]["group_id_start"] == group_ids[0]
        assert mock_delay.call_args[1]["use_pipeline_hash"] is True

    def test_includes_both_missing_and_stale(self) -> None:
        groups = self.create_unprocessed_groups(3)
        group_ids = sorted(g.id for g in groups)

        # Process only the first two
        process_group_log(group_ids[0])
        process_group_log(group_ids[1])

        # Stamp first with stale hash
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash="stale")

        with patch.object(process_project_derived_data_batch, "delay") as mock_delay:
            process_project_derived_data(project_id=self.project.id, use_pipeline_hash=True)

        # Should include group_ids[0] (stale) and group_ids[2] (missing)
        mock_delay.assert_called_once()
        call_kwargs = mock_delay.call_args[1]
        assert call_kwargs["group_id_start"] == group_ids[0]
        assert call_kwargs["group_id_end"] == group_ids[2] + 1

    def test_includes_null_hash_groups(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash=None)

        with patch.object(process_project_derived_data_batch, "delay") as mock_delay:
            process_project_derived_data(project_id=self.project.id, use_pipeline_hash=True)

        mock_delay.assert_called_once()
        assert mock_delay.call_args[1]["group_id_start"] == group_ids[0]


@with_feature("projects:issue-action-log-write-to-db")
class ProcessProjectDerivedDataBatchWithPipelineHashTest(DerivedDataTaskTestBase):
    def test_deletes_stale_gdd_before_processing(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        # Process groups so they have GDD rows
        for gid in group_ids:
            process_group_log(gid)

        # Stamp with stale hash
        GroupDerivedData.objects.filter(group_id__in=group_ids).update(pipeline_hash="stale")

        process_project_derived_data_batch(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
            use_pipeline_hash=True,
        )

        # All groups should now have GDD with the current pipeline hash
        for gid in group_ids:
            gdd = GroupDerivedData.objects.get(group_id=gid)
            assert gdd.pipeline_hash == PIPELINE.pipeline_hash

    def test_deletes_null_hash_gdd_before_processing(self) -> None:
        groups = self.create_unprocessed_groups(1)
        group_id = groups[0].id

        process_group_log(group_id)
        GroupDerivedData.objects.filter(group_id=group_id).update(pipeline_hash=None)

        process_project_derived_data_batch(
            project_id=self.project.id,
            group_id_start=group_id,
            group_id_end=group_id + 1,
            use_pipeline_hash=True,
        )

        gdd = GroupDerivedData.objects.get(group_id=group_id)
        assert gdd.pipeline_hash == PIPELINE.pipeline_hash

    def test_leaves_current_hash_gdd_alone(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        # Process groups — they'll get the current hash
        for gid in group_ids:
            process_group_log(gid)

        original_gdds = {
            gid: GroupDerivedData.objects.get(group_id=gid).generated_at for gid in group_ids
        }

        process_project_derived_data_batch(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
            use_pipeline_hash=True,
        )

        # GDDs should be untouched since hash is current
        for gid in group_ids:
            gdd = GroupDerivedData.objects.get(group_id=gid)
            assert gdd.generated_at == original_gdds[gid]


@with_feature("projects:issue-action-log-write-to-db")
class HealStaleDerivedDataTest(DerivedDataTaskTestBase):
    def test_finds_stale_projects_and_schedules(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        # Make one group stale
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash="stale")

        with patch.object(process_project_derived_data, "delay") as mock_delay:
            heal_stale_derived_data()

        mock_delay.assert_called_once_with(project_id=self.project.id, use_pipeline_hash=True)

    def test_no_stale_data(self) -> None:
        groups = self.create_unprocessed_groups(2)
        for g in groups:
            process_group_log(g.id)

        with patch.object(process_project_derived_data, "delay") as mock_delay:
            heal_stale_derived_data()

        mock_delay.assert_not_called()

    def test_respects_killswitch(self) -> None:
        groups = self.create_unprocessed_groups(1)
        process_group_log(groups[0].id)
        GroupDerivedData.objects.filter(group_id=groups[0].id).update(pipeline_hash="stale")

        with (
            override_options({"issues.derived.heal-enabled": False}),
            patch.object(process_project_derived_data, "delay") as mock_delay,
        ):
            heal_stale_derived_data()

        mock_delay.assert_not_called()

    def test_respects_project_limit(self) -> None:
        projects = [self.create_project(organization=self.organization) for _ in range(3)]
        for proj in projects:
            group = self.create_group(project=proj)
            with outbox_runner():
                publish_action(
                    ViewAction(),
                    source=ActionSource.API,
                    group_id=group.id,
                    project=proj,
                    actor=GroupActionActor.user(self.user.id),
                )
            # Stamp with stale hash
            GroupDerivedData.objects.filter(group_id=group.id).update(pipeline_hash="stale")

        with (
            override_options({"issues.derived.heal-project-limit": 2}),
            patch.object(process_project_derived_data, "delay") as mock_delay,
        ):
            heal_stale_derived_data()

        assert mock_delay.call_count == 2

    def test_treats_null_hash_as_stale(self) -> None:
        groups = self.create_unprocessed_groups(1)
        process_group_log(groups[0].id)
        GroupDerivedData.objects.filter(group_id=groups[0].id).update(pipeline_hash=None)

        with patch.object(process_project_derived_data, "delay") as mock_delay:
            heal_stale_derived_data()

        mock_delay.assert_called_once_with(project_id=self.project.id, use_pipeline_hash=True)

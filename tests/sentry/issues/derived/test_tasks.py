from datetime import datetime, timezone
from unittest.mock import patch

from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import ActionSource, GroupActionActor, ViewAction
from sentry.issues.derived.processing import process_group_log
from sentry.issues.derived.tasks import (
    generate_project_derived_data,
    generate_project_derived_data_batch,
    heal_stale_derived_data,
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

        with patch("sentry.issues.derived.processing.build_and_promote_derived_data") as mock_build:
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
    def test_finds_stale_projects_and_schedules(self) -> None:
        groups = self.create_unprocessed_groups(2)
        group_ids = sorted(g.id for g in groups)

        for gid in group_ids:
            process_group_log(gid)

        # Make one group stale
        GroupDerivedData.objects.filter(group_id=group_ids[0]).update(pipeline_hash="stale")

        with patch.object(generate_project_derived_data, "delay") as mock_delay:
            heal_stale_derived_data()

        mock_delay.assert_called_once_with(project_id=self.project.id, stale_only=True)

    def test_no_stale_data(self) -> None:
        groups = self.create_unprocessed_groups(2)
        for g in groups:
            process_group_log(g.id)

        with patch.object(generate_project_derived_data, "delay") as mock_delay:
            heal_stale_derived_data()

        mock_delay.assert_not_called()

    def test_respects_killswitch(self) -> None:
        groups = self.create_unprocessed_groups(1)
        process_group_log(groups[0].id)
        GroupDerivedData.objects.filter(group_id=groups[0].id).update(pipeline_hash="stale")

        with (
            override_options({"issues.derived.heal-enabled": False}),
            patch.object(generate_project_derived_data, "delay") as mock_delay,
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
            patch.object(generate_project_derived_data, "delay") as mock_delay,
        ):
            heal_stale_derived_data()

        assert mock_delay.call_count == 2

    def test_treats_null_hash_as_stale(self) -> None:
        groups = self.create_unprocessed_groups(1)
        process_group_log(groups[0].id)
        GroupDerivedData.objects.filter(group_id=groups[0].id).update(pipeline_hash=None)

        with patch.object(generate_project_derived_data, "delay") as mock_delay:
            heal_stale_derived_data()

        mock_delay.assert_called_once_with(project_id=self.project.id, stale_only=True)

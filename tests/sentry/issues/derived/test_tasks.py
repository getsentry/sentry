from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import patch

import pytest

from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    ActionSource,
    GroupAction,
    GroupActionActor,
    ViewAction,
)
from sentry.issues.derived.processing import GroupLogDeadlineExceeded
from sentry.issues.derived.tasks import (
    process_project_derived_data,
    process_project_derived_data_batch,
)
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
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


def _create_groups_with_entries(test_case: TestCase, count: int) -> list[Group]:
    groups = []
    for _ in range(count):
        group = test_case.create_group(project=test_case.project)
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(test_case.user.id))
        # Delete the derived data created by _publish so the task sees them as unprocessed
        GroupDerivedData.objects.filter(group_id=group.id).delete()
        groups.append(group)
    return groups


@with_feature("projects:issue-action-log-write-to-db")
class ProcessProjectDerivedDataTest(TestCase):
    def test_no_groups(self) -> None:
        process_project_derived_data(project_id=self.project.id)

    def test_fans_out_batches(self) -> None:
        groups = _create_groups_with_entries(self, 3)

        with patch.object(process_project_derived_data_batch, "delay") as mock_delay:
            process_project_derived_data(project_id=self.project.id)

        assert mock_delay.call_count == 1
        call_kwargs = mock_delay.call_args[1]
        group_ids = sorted(g.id for g in groups)
        assert call_kwargs["group_id_start"] == group_ids[0]
        assert call_kwargs["group_id_end"] == group_ids[-1] + 1

    def test_skips_already_processed_groups(self) -> None:
        from sentry.issues.derived.processing import process_group_log

        groups = _create_groups_with_entries(self, 3)
        group_ids = sorted(g.id for g in groups)

        # Pre-process first group
        process_group_log(group_ids[0])

        with patch.object(process_project_derived_data_batch, "delay") as mock_delay:
            process_project_derived_data(project_id=self.project.id)

        assert mock_delay.call_count == 1
        call_kwargs = mock_delay.call_args[1]
        # First group should be excluded from the range
        assert call_kwargs["group_id_start"] == group_ids[1]

    def test_batching(self) -> None:
        _create_groups_with_entries(self, 5)

        with (
            override_options({"issues.derived.project-batch-size": 2}),
            patch.object(process_project_derived_data_batch, "delay") as mock_delay,
        ):
            process_project_derived_data(project_id=self.project.id)

        assert mock_delay.call_count == 3

    def test_exceeds_max_tasks(self) -> None:
        _create_groups_with_entries(self, 3)

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

        # Should bail out without scheduling any tasks
        assert mock_delay.call_count == 0


@with_feature("projects:issue-action-log-write-to-db")
class ProcessProjectDerivedDataBatchTest(TestCase):
    def test_processes_range(self) -> None:
        groups = _create_groups_with_entries(self, 3)
        group_ids = sorted(g.id for g in groups)

        process_project_derived_data_batch(
            project_id=self.project.id,
            group_id_start=group_ids[0],
            group_id_end=group_ids[-1] + 1,
        )

        for group in groups:
            assert GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_skips_deleted_groups(self) -> None:
        groups = _create_groups_with_entries(self, 3)
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
        from sentry.issues.derived import processing

        groups = _create_groups_with_entries(self, 3)
        group_ids = sorted(g.id for g in groups)

        call_count = 0
        original_process = processing.process_group_log

        def process_then_expire(group_id: int, **kwargs: Any) -> object:
            nonlocal call_count
            call_count += 1
            result = original_process(group_id, **kwargs)
            if call_count == 1:
                mock_now.return_value = deadline_future
            return result

        deadline_future = datetime.now(UTC) + timedelta(seconds=60)

        with (
            patch("sentry.issues.derived.tasks.datetime") as mock_datetime,
            patch.object(processing, "process_group_log", side_effect=process_then_expire),
            patch.object(process_project_derived_data_batch, "delay") as mock_delay,
        ):
            mock_now = mock_datetime.now
            mock_now.return_value = datetime.now(UTC)

            process_project_derived_data_batch(
                project_id=self.project.id,
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )

        assert call_count == 1
        assert mock_delay.call_count == 1
        reschedule_kwargs = mock_delay.call_args[1]
        assert reschedule_kwargs["group_id_start"] == group_ids[1]
        assert reschedule_kwargs["group_id_end"] == group_ids[-1] + 1

    def test_reschedules_on_group_log_deadline_exceeded(self) -> None:
        from sentry.issues.derived import processing

        groups = _create_groups_with_entries(self, 3)
        group_ids = sorted(g.id for g in groups)

        call_count = 0

        def raise_on_first(group_id: int, **kwargs: object) -> None:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise GroupLogDeadlineExceeded(group_id)

        with (
            patch.object(processing, "process_group_log", side_effect=raise_on_first),
            patch.object(process_project_derived_data_batch, "delay") as mock_delay,
        ):
            process_project_derived_data_batch(
                project_id=self.project.id,
                group_id_start=group_ids[0],
                group_id_end=group_ids[-1] + 1,
            )

        assert call_count == 1
        assert mock_delay.call_count == 1
        reschedule_kwargs = mock_delay.call_args[1]
        # On GroupLogDeadlineExceeded, reschedule starts from the SAME group
        assert reschedule_kwargs["group_id_start"] == group_ids[0]
        assert reschedule_kwargs["group_id_end"] == group_ids[-1] + 1


@with_feature("projects:issue-action-log-write-to-db")
class ProcessGroupLogTimeoutTest(TestCase):
    def test_raises_when_timeout_exceeded(self) -> None:
        from sentry.issues.derived.processing import process_group_log

        group = self.create_group()
        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        GroupDerivedData.objects.filter(group_id=group.id).delete()

        with pytest.raises(GroupLogDeadlineExceeded):
            process_group_log(group.id, batch_size=1, timeout=timedelta(0))

    def test_completes_without_timeout(self) -> None:
        from sentry.issues.derived.processing import process_group_log

        group = self.create_group()
        for _ in range(3):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        GroupDerivedData.objects.filter(group_id=group.id).delete()

        derived = process_group_log(group.id)
        assert derived.view_count == 3

    def test_completes_with_generous_timeout(self) -> None:
        from sentry.issues.derived.processing import process_group_log

        group = self.create_group()
        for _ in range(3):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        GroupDerivedData.objects.filter(group_id=group.id).delete()

        derived = process_group_log(group.id, timeout=timedelta(minutes=5))
        assert derived.view_count == 3

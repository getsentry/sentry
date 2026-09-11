from __future__ import annotations

from typing import Any
from unittest.mock import patch

from django.utils import timezone

from sentry import options as real_options
from sentry.issues.action_log.backfill import BACKFILL_PR_LIFECYCLE_SOURCE
from sentry.issues.action_log.types import GroupActionType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.tasks.backfill_pr_lifecycle_action_log import (
    backfill_pr_lifecycle_action_log_for_group,
    backfill_pr_lifecycle_action_log_for_project,
)
from sentry.testutils.cases import TestCase

TEST_BATCH_SIZE = 5


class BackfillPullRequestLifecycleActionLogTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repository = self.create_repo(project=self.project)
        self.now = timezone.now()

    def _options(
        self,
        *,
        killswitch: bool = False,
        batch_size: int = TEST_BATCH_SIZE,
        delay: int = 0,
    ) -> Any:
        overrides = {
            "issues.backfill_pr_lifecycle_action_log.killswitch": killswitch,
            "issues.backfill_pr_lifecycle_action_log.batch_size": batch_size,
            "issues.backfill_pr_lifecycle_action_log.inter_batch_delay_s": delay,
        }
        original_get = real_options.get

        def side_effect(key: str, *args: Any, **kwargs: Any) -> Any:
            if key in overrides:
                return overrides[key]
            return original_get(key, *args, **kwargs)

        return patch(
            "sentry.tasks.backfill_pr_lifecycle_action_log.options.get",
            side_effect=side_effect,
        )

    def _create_linked_pull_request(self, group: Group) -> PullRequest:
        pull_request = self.create_pull_request(
            repository_id=self.repository.id,
            organization_id=self.organization.id,
        )
        PullRequest.objects.filter(id=pull_request.id).update(
            state=PullRequestLifecycleState.MERGED,
            merged_at=self.now,
        )
        pull_request.refresh_from_db()
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=pull_request.id,
        )
        return pull_request

    def test_group_task_backfills_lifecycle_entry(self) -> None:
        group = self.create_group()
        self._create_linked_pull_request(group)

        backfill_pr_lifecycle_action_log_for_group(group.id)

        assert GroupActionLogEntry.objects.filter(
            group_id=group.id,
            type=GroupActionType.PULL_REQUEST_MERGED,
        ).exists()

    def test_project_task_backfills_each_linked_group(self) -> None:
        groups = [self.create_group(), self.create_group()]
        for group in groups:
            self._create_linked_pull_request(group)

        with (
            self._options(),
            patch.object(backfill_pr_lifecycle_action_log_for_project, "apply_async"),
            patch(
                "sentry.issues.derived.tasks.generate_project_derived_data.delay"
            ) as mock_derived,
        ):
            backfill_pr_lifecycle_action_log_for_project(self.project.id)

        assert GroupActionLogEntry.objects.filter(
            project_id=self.project.id,
            type=GroupActionType.PULL_REQUEST_MERGED,
        ).count() == len(groups)
        mock_derived.assert_called_once_with(project_id=self.project.id)

    def test_project_task_respects_killswitch(self) -> None:
        group = self.create_group()
        self._create_linked_pull_request(group)

        with self._options(killswitch=True):
            backfill_pr_lifecycle_action_log_for_project(self.project.id)

        assert not GroupActionLogEntry.objects.filter(project_id=self.project.id).exists()

    def test_project_task_self_chains_with_group_cursor(self) -> None:
        groups = [self.create_group(), self.create_group(), self.create_group()]
        for group in groups:
            self._create_linked_pull_request(group)

        with (
            self._options(batch_size=2, delay=3),
            patch.object(
                backfill_pr_lifecycle_action_log_for_project,
                "apply_async",
            ) as mock_apply,
            patch(
                "sentry.issues.derived.tasks.generate_project_derived_data.delay"
            ) as mock_derived,
        ):
            backfill_pr_lifecycle_action_log_for_project(self.project.id)

        mock_apply.assert_called_once_with(
            kwargs={
                "project_id": self.project.id,
                "cursor_group_id": sorted(group.id for group in groups)[1],
            },
            countdown=3,
            headers={"sentry-propagate-traces": False},
        )
        mock_derived.assert_not_called()
        assert GroupActionLogEntry.objects.filter(project_id=self.project.id).count() == 2

    def test_project_task_processes_derived_data_when_complete(self) -> None:
        with (
            self._options(),
            patch(
                "sentry.issues.derived.tasks.generate_project_derived_data.delay"
            ) as mock_derived,
        ):
            backfill_pr_lifecycle_action_log_for_project(self.project.id)

        mock_derived.assert_called_once_with(project_id=self.project.id)

    def test_reset_deletes_backfilled_entries_and_derived_data(self) -> None:
        group = self.create_group()
        self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.PULL_REQUEST_MERGED,
            source=BACKFILL_PR_LIFECYCLE_SOURCE,
            data={"pull_request": 1, "has_other_open_prs": False},
        )
        self.create_group_derived_data(group=group)

        with (
            self._options(),
            patch("sentry.issues.derived.tasks.generate_project_derived_data.delay"),
        ):
            backfill_pr_lifecycle_action_log_for_project(self.project.id, reset=True)

        assert not GroupActionLogEntry.objects.filter(
            project_id=self.project.id,
            source=BACKFILL_PR_LIFECYCLE_SOURCE,
        ).exists()
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

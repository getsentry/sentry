from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from sentry.issues.action_log.backfill import (
    BACKFILL_ACTIVITY_SOURCE,
    BACKFILL_PR_LIFECYCLE_SOURCE,
    BackfillEntry,
    backfill_actions,
    backfill_group_activities,
    backfill_group_pr_lifecycle,
)
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    GroupAction,
    GroupActionActor,
    GroupActionType,
    GroupActorType,
    ResolveAction,
    ResolvedInPullRequestAction,
    ViewAction,
)
from sentry.issues.derived.processing import process_group_log
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.progress_state import IssueProgressState
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class BackfillActionsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.now = timezone.now()

    def _entry(
        self,
        *,
        minutes_ago: int = 0,
        key: str = "k",
        action: GroupAction | None = None,
        actor: GroupActionActor = SYSTEM_ACTOR,
        source: str = "test",
    ) -> BackfillEntry:
        return BackfillEntry(
            action=action or ViewAction(),
            actor=actor,
            source=source,
            date_added=self.now - timedelta(minutes=minutes_ago),
            idempotency_key=key,
        )

    def test_empty_entries(self) -> None:
        result = backfill_actions(entries=[], group_id=self.group.id, project_id=self.project.id)
        assert result == 0

    def test_creates_entries(self) -> None:
        entries = [
            self._entry(minutes_ago=2, key="a"),
            self._entry(minutes_ago=1, key="b"),
        ]
        count = backfill_actions(
            entries=entries, group_id=self.group.id, project_id=self.project.id
        )
        assert count == 2
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2

    def test_sets_fields_correctly(self) -> None:
        entry = self._entry(
            key="x", actor=GroupActionActor.user(42), source="web", action=ResolveAction()
        )
        backfill_actions(entries=[entry], group_id=self.group.id, project_id=self.project.id)
        row = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert row.group_id == self.group.id
        assert row.project_id == self.project.id
        assert row.type == GroupActionType.RESOLVE.value
        assert row.actor_type == GroupActorType.USER.value
        assert row.actor_id == 42
        assert row.source == "web"
        assert row.idempotency_key == "x"
        assert row.date_added == entry.date_added

    def test_skips_duplicates(self) -> None:
        entries = [self._entry(key="dup")]
        assert (
            backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)
            == 1
        )
        assert (
            backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)
            == 0
        )
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_skips_only_conflicting_entries(self) -> None:
        backfill_actions(
            entries=[self._entry(key="existing")],
            group_id=self.group.id,
            project_id=self.project.id,
        )
        entries = [
            self._entry(minutes_ago=2, key="existing"),
            self._entry(minutes_ago=1, key="new"),
        ]
        count = backfill_actions(
            entries=entries, group_id=self.group.id, project_id=self.project.id
        )
        assert count == 1
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2

    def test_same_key_different_group_no_conflict(self) -> None:
        other_group = self.create_group()
        backfill_actions(
            entries=[self._entry(key="shared")],
            group_id=self.group.id,
            project_id=self.project.id,
        )
        count = backfill_actions(
            entries=[self._entry(key="shared")],
            group_id=other_group.id,
            project_id=self.project.id,
        )
        assert count == 1

    def test_rejects_unsorted_entries(self) -> None:
        entries = [
            self._entry(minutes_ago=0, key="a"),
            self._entry(minutes_ago=5, key="b"),
        ]
        with pytest.raises(ValueError, match="sorted"):
            backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)

    @patch("sentry.issues.action_log.backfill.invalidate_group_derived_data")
    def test_invalidates_with_earliest_cursor(self, mock_invalidate: MagicMock) -> None:
        entries = [
            self._entry(minutes_ago=5, key="a"),
            self._entry(minutes_ago=1, key="b"),
        ]
        backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)
        mock_invalidate.assert_called_once_with(self.group.id, cursor=(entries[0].date_added, 0))

    @patch("sentry.issues.action_log.backfill.invalidate_group_derived_data")
    def test_no_invalidation_when_all_duplicates(self, mock_invalidate: MagicMock) -> None:
        entries = [self._entry(key="x")]
        backfill_actions(entries=entries, group_id=self.group.id, project_id=self.project.id)
        mock_invalidate.reset_mock()
        count = backfill_actions(
            entries=entries, group_id=self.group.id, project_id=self.project.id
        )
        assert count == 0
        mock_invalidate.assert_not_called()


class BackfillGroupActivitiesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.now = timezone.now()

    def test_empty_group(self) -> None:
        count = backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert count == 0
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

    def test_translates_activities(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            datetime=self.now - timedelta(minutes=2),
        )
        self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": "123", "assigneeType": "user"},
            datetime=self.now - timedelta(minutes=1),
        )
        count = backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert count == 2
        entries = list(
            GroupActionLogEntry.objects.filter(group_id=self.group.id).order_by("date_added")
        )
        assert entries[0].type == GroupActionType.RESOLVE.value
        assert entries[1].type == GroupActionType.ASSIGN.value

    def test_sets_actor_from_user_id(self) -> None:
        user = self.create_user()
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            user_id=user.id,
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.USER.value
        assert entry.actor_id == user.id

    def test_sets_system_actor_when_no_user(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.AUTO_SET_ONGOING.value,
            data={},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.SYSTEM.value
        assert entry.actor_id == 0

    def test_uses_backfill_source(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.source == BACKFILL_ACTIVITY_SOURCE

    def test_idempotency_key_uses_activity_id(self) -> None:
        act = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.idempotency_key == f"activity:{act.id}"

    def test_skips_untranslatable_activities(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.FIRST_SEEN.value,
            data={"priority": 1},
        )
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        count = backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert count == 1

    def test_idempotent_on_rerun(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": "1"},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2

    def test_processes_in_batches(self) -> None:
        for i in range(5):
            self.create_group_activity(
                group=self.group,
                type=ActivityType.SET_RESOLVED.value,
                data={},
                datetime=self.now - timedelta(minutes=5 - i),
            )
        count = backfill_group_activities(
            group_id=self.group.id, project_id=self.project.id, batch_size=2
        )
        assert count == 5
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 5

    def test_does_not_affect_other_groups(self) -> None:
        other_group = self.create_group()
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        self.create_group_activity(
            group=other_group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1
        assert GroupActionLogEntry.objects.filter(group_id=other_group.id).count() == 0

    def test_preserves_activity_datetime(self) -> None:
        ts = self.now - timedelta(days=30)
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            datetime=ts,
        )
        backfill_group_activities(group_id=self.group.id, project_id=self.project.id)
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.date_added == ts


class BackfillGroupPullRequestLifecycleTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.repository = self.create_repo(project=self.project)
        self.now = timezone.now()

    def _create_linked_pull_request(
        self,
        *,
        state: str | None,
        group: Group | None = None,
        relationship: int = GroupLink.Relationship.resolves,
        closed_at: datetime | None = None,
        merged_at: datetime | None = None,
    ) -> PullRequest:
        group = group or self.group
        pull_request = self.create_pull_request(
            repository_id=self.repository.id,
            organization_id=self.organization.id,
        )
        PullRequest.objects.filter(id=pull_request.id).update(
            state=state,
            closed_at=closed_at,
            merged_at=merged_at,
        )
        pull_request.refresh_from_db()
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=relationship,
            linked_id=pull_request.id,
        )
        return pull_request

    def _backfill_resolved_action(self, pull_request: PullRequest) -> None:
        backfill_actions(
            entries=[
                BackfillEntry(
                    action=ResolvedInPullRequestAction(pull_request=pull_request.id),
                    actor=SYSTEM_ACTOR,
                    source="test",
                    date_added=self.now - timedelta(minutes=2),
                    idempotency_key=f"test-resolved-pr:{pull_request.id}",
                )
            ],
            group_id=self.group.id,
            project_id=self.project.id,
        )

    def _backfill_pr_lifecycle(self) -> int:
        return backfill_group_pr_lifecycle(
            group_id=self.group.id,
            project_id=self.project.id,
        )

    def test_backfills_merged_pull_request(self) -> None:
        merged_at = self.now - timedelta(minutes=1)
        pull_request = self._create_linked_pull_request(
            state=PullRequestLifecycleState.MERGED,
            merged_at=merged_at,
        )

        assert self._backfill_pr_lifecycle() == 1

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.type == GroupActionType.PULL_REQUEST_MERGED
        assert entry.data == {
            "pull_request": pull_request.id,
            "has_other_open_prs": False,
        }
        assert entry.date_added == merged_at
        assert entry.actor_type == GroupActorType.SYSTEM
        assert entry.actor_id == SYSTEM_ACTOR.actor_id
        assert entry.source == BACKFILL_PR_LIFECYCLE_SOURCE
        assert entry.idempotency_key == (
            f"pr-lifecycle:{pull_request.id}:{GroupActionType.PULL_REQUEST_MERGED.value}"
        )

    def test_backfills_closed_and_superseded_pull_requests(self) -> None:
        closed_at = self.now - timedelta(minutes=1)
        closed_pull_request = self._create_linked_pull_request(
            state=PullRequestLifecycleState.CLOSED,
            closed_at=closed_at,
        )
        superseded_pull_request = self._create_linked_pull_request(
            state=PullRequestLifecycleState.SUPERSEDED,
            closed_at=closed_at,
        )

        assert self._backfill_pr_lifecycle() == 2

        entries = list(GroupActionLogEntry.objects.filter(group_id=self.group.id))
        assert {entry.type for entry in entries} == {GroupActionType.PULL_REQUEST_CLOSED}
        assert {entry.data["pull_request"] for entry in entries} == {
            closed_pull_request.id,
            superseded_pull_request.id,
        }
        assert {entry.date_added for entry in entries} == {closed_at}

    def test_skips_open_pull_requests(self) -> None:
        self._create_linked_pull_request(state=None)
        self._create_linked_pull_request(state=PullRequestLifecycleState.OPEN)
        self._create_linked_pull_request(state=PullRequestLifecycleState.LOCKED)

        assert self._backfill_pr_lifecycle() == 0
        assert not GroupActionLogEntry.objects.filter(group_id=self.group.id).exists()

    def test_open_sibling_keeps_fix_pr_open(self) -> None:
        closed_pull_request = self._create_linked_pull_request(
            state=PullRequestLifecycleState.CLOSED,
            closed_at=self.now - timedelta(minutes=1),
        )
        self._create_linked_pull_request(state=PullRequestLifecycleState.OPEN)
        self._backfill_resolved_action(closed_pull_request)

        self._backfill_pr_lifecycle()
        derived = process_group_log(self.group.id)

        closed_entry = GroupActionLogEntry.objects.get(
            group_id=self.group.id,
            type=GroupActionType.PULL_REQUEST_CLOSED,
        )
        assert closed_entry.data["has_other_open_prs"] is True
        assert derived.data["has_open_fix_pr"] is True
        assert derived.progress == IssueProgressState.FIX_PROPOSED

    def test_all_terminal_pull_requests_clear_fix_proposed(self) -> None:
        pull_request = self._create_linked_pull_request(
            state=PullRequestLifecycleState.MERGED,
            merged_at=self.now - timedelta(minutes=1),
        )
        self._backfill_resolved_action(pull_request)

        self._backfill_pr_lifecycle()
        derived = process_group_log(self.group.id)

        assert derived.data["has_open_fix_pr"] is False
        assert derived.progress != IssueProgressState.FIX_PROPOSED

    def test_skips_terminal_pull_request_without_timestamp(self) -> None:
        self._create_linked_pull_request(state=PullRequestLifecycleState.MERGED)

        assert self._backfill_pr_lifecycle() == 0
        assert not GroupActionLogEntry.objects.filter(group_id=self.group.id).exists()

    def test_skips_pull_request_whose_latest_action_matches_state(self) -> None:
        pull_request = self._create_linked_pull_request(
            state=PullRequestLifecycleState.CLOSED,
            closed_at=self.now - timedelta(minutes=1),
        )
        self.create_group_action_log_entry(
            group=self.group,
            type=GroupActionType.PULL_REQUEST_CLOSED,
            data={"pull_request": str(pull_request.id), "has_other_open_prs": False},
            date_added=self.now - timedelta(minutes=1),
        )

        assert self._backfill_pr_lifecycle() == 0
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_backfills_merge_after_stale_closed_action(self) -> None:
        merged_at = self.now - timedelta(minutes=1)
        pull_request = self._create_linked_pull_request(
            state=PullRequestLifecycleState.MERGED,
            closed_at=merged_at,
            merged_at=merged_at,
        )
        # PULL_REQUEST_CLOSED was logged before the other lifecycle actions existed,
        # so the log's last word on this pull request is a stale close.
        self.create_group_action_log_entry(
            group=self.group,
            type=GroupActionType.PULL_REQUEST_CLOSED,
            data={"pull_request": pull_request.id, "has_other_open_prs": False},
            date_added=self.now - timedelta(minutes=30),
        )

        assert self._backfill_pr_lifecycle() == 1

        merged_entry = GroupActionLogEntry.objects.get(
            group_id=self.group.id,
            type=GroupActionType.PULL_REQUEST_MERGED,
        )
        assert merged_entry.data == {
            "pull_request": pull_request.id,
            "has_other_open_prs": False,
        }
        assert merged_entry.date_added == merged_at
        assert self._backfill_pr_lifecycle() == 0

    def test_backfills_close_after_stale_reopened_action(self) -> None:
        closed_at = self.now - timedelta(minutes=1)
        pull_request = self._create_linked_pull_request(
            state=PullRequestLifecycleState.CLOSED,
            closed_at=closed_at,
        )
        self._backfill_resolved_action(pull_request)
        # The pull request was closed, reopened, then closed again — only the reopen
        # made it into the log, so derived data still sees an open fix pull request.
        self.create_group_action_log_entry(
            group=self.group,
            type=GroupActionType.PULL_REQUEST_REOPENED,
            data={"pull_request": pull_request.id},
            date_added=self.now - timedelta(seconds=90),
        )

        assert self._backfill_pr_lifecycle() == 1

        closed_entry = GroupActionLogEntry.objects.get(
            group_id=self.group.id,
            type=GroupActionType.PULL_REQUEST_CLOSED,
        )
        assert closed_entry.date_added == closed_at
        derived = process_group_log(self.group.id)
        assert derived.data["has_open_fix_pr"] is False

    def test_backfills_reopen_after_stale_closed_action(self) -> None:
        pull_request = self._create_linked_pull_request(state=PullRequestLifecycleState.OPEN)
        self._backfill_resolved_action(pull_request)
        # The pull request was closed and later reopened, but only the close was logged,
        # so derived data no longer sees the open fix pull request.
        self.create_group_action_log_entry(
            group=self.group,
            type=GroupActionType.PULL_REQUEST_CLOSED,
            data={"pull_request": pull_request.id, "has_other_open_prs": False},
            date_added=self.now - timedelta(seconds=90),
        )

        assert self._backfill_pr_lifecycle() == 1

        # PullRequest has no reopened timestamp, so the entry is dated now.
        reopened_entry = GroupActionLogEntry.objects.get(
            group_id=self.group.id,
            type=GroupActionType.PULL_REQUEST_REOPENED,
        )
        assert reopened_entry.data == {"pull_request": pull_request.id}
        assert reopened_entry.date_added >= self.now
        assert reopened_entry.source == BACKFILL_PR_LIFECYCLE_SOURCE

        derived = process_group_log(self.group.id)
        assert derived.data["has_open_fix_pr"] is True
        assert derived.progress == IssueProgressState.FIX_PROPOSED

        assert self._backfill_pr_lifecycle() == 0

    def test_backfills_reopen_for_locked_pull_request(self) -> None:
        pull_request = self._create_linked_pull_request(state=PullRequestLifecycleState.LOCKED)
        self.create_group_action_log_entry(
            group=self.group,
            type=GroupActionType.PULL_REQUEST_CLOSED,
            data={"pull_request": str(pull_request.id), "has_other_open_prs": False},
            date_added=self.now - timedelta(seconds=90),
        )

        assert self._backfill_pr_lifecycle() == 1
        assert GroupActionLogEntry.objects.filter(
            group_id=self.group.id,
            type=GroupActionType.PULL_REQUEST_REOPENED,
        ).exists()

    def test_skips_reopen_for_open_pull_request_without_terminal_action(self) -> None:
        pull_request = self._create_linked_pull_request(state=PullRequestLifecycleState.OPEN)
        self.create_group_action_log_entry(
            group=self.group,
            type=GroupActionType.PULL_REQUEST_REOPENED,
            data={"pull_request": pull_request.id},
            date_added=self.now - timedelta(minutes=1),
        )

        assert self._backfill_pr_lifecycle() == 0
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_skips_reopen_for_pull_request_with_unknown_state(self) -> None:
        pull_request = self._create_linked_pull_request(state=None)
        self.create_group_action_log_entry(
            group=self.group,
            type=GroupActionType.PULL_REQUEST_CLOSED,
            data={"pull_request": pull_request.id, "has_other_open_prs": False},
            date_added=self.now - timedelta(minutes=1),
        )

        assert self._backfill_pr_lifecycle() == 0
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_idempotent_on_rerun(self) -> None:
        self._create_linked_pull_request(
            state=PullRequestLifecycleState.MERGED,
            merged_at=self.now - timedelta(minutes=1),
        )

        first_count = self._backfill_pr_lifecycle()
        second_count = self._backfill_pr_lifecycle()

        assert first_count == 1
        assert second_count == 0
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_skips_non_resolving_pull_request_link(self) -> None:
        self._create_linked_pull_request(
            state=PullRequestLifecycleState.MERGED,
            relationship=GroupLink.Relationship.references,
            merged_at=self.now - timedelta(minutes=1),
        )

        assert self._backfill_pr_lifecycle() == 0

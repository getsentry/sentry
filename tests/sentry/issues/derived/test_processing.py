from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry.issues.derived.processing import process_group_log
from sentry.issues.derived.recording import record
from sentry.issues.derived.types import (
    AutofixPrCreatedAction,
    CommentAction,
    FetchAction,
    ResolvedInPullRequestAction,
    SetResolvedAction,
    SetUnresolvedAction,
    ViewAction,
)
from sentry.models.group import Group
from sentry.models.groupderiveddata import GroupDerivedData
from sentry.models.issueactionlog import IssueActionLog
from sentry.testutils.cases import APITestCase, TestCase


class ProcessGroupLogTest(TestCase):
    def test_records_and_processes(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        record(
            group_id=group.id,
            action=SetResolvedAction(resolution_type="in_next_release"),
            user_id=user.id,
        )

        entries = list(IssueActionLog.objects.filter(group_id=group.id).order_by("id"))
        assert len(entries) == 3
        assert entries[0].type == 0  # VIEW
        assert entries[2].type == 4  # SET_RESOLVED
        assert entries[2].data == {"resolution_type": "in_next_release"}
        assert entries[0].user_id == user.id

        derived = process_group_log(group.id)
        assert derived.cursor_id == entries[-1].id
        assert isinstance(derived.data, dict)

    def test_incremental_processing(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        first_cursor = derived.cursor_id

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.cursor_id > first_cursor

    def test_noop_when_no_new_entries(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        old_updated = derived.date_updated

        derived = process_group_log(group.id)
        assert derived.date_updated == old_updated

    def test_process_group_log_only_affects_target(self) -> None:
        """process_group_log for one group doesn't advance another group's cursor."""
        group_a = self.create_group()
        group_b = self.create_group()
        user = self.user

        # record() processes inline, so both get derived data immediately.
        record(group_id=group_a.id, action=ViewAction(), user_id=user.id)
        record(group_id=group_b.id, action=ViewAction(), user_id=user.id)

        cursor_b = GroupDerivedData.objects.get(group_id=group_b.id).cursor_id

        # New entry only for group_a, processed via explicit call.
        IssueActionLog.objects.create(group_id=group_a.id, type=0, data={})
        process_group_log(group_a.id)

        # group_b's cursor should be unchanged.
        assert GroupDerivedData.objects.get(group_id=group_b.id).cursor_id == cursor_b

    def test_last_seen_tracks_most_recent_view(self) -> None:
        group = self.create_group()
        user = self.user
        now = timezone.now()

        # Insert an old entry directly to avoid inline processing at the wrong time.
        IssueActionLog.objects.create(
            group_id=group.id,
            type=0,
            user_id=user.id,
            data={},
            date_added=now - timedelta(hours=1),
        )
        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        latest_entry = IssueActionLog.objects.filter(group_id=group.id).order_by("-id")[0]

        # Reprocess from scratch so both entries are seen in order.
        GroupDerivedData.objects.filter(group_id=group.id).delete()
        derived = process_group_log(group.id)
        assert derived.data["last_seen"] == latest_entry.date_added.timestamp()

    def test_last_seen_ignores_non_view_actions(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=CommentAction(message="hello"), user_id=user.id)
        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)

        derived = process_group_log(group.id)
        assert derived.data["last_seen"] is None

    def test_last_seen_incremental(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        first_seen = derived.data["last_seen"]

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["last_seen"] > first_seen

    def test_batched_processing(self) -> None:
        group = self.create_group()
        user = self.user

        for _ in range(5):
            record(group_id=group.id, action=ViewAction(), user_id=user.id)

        # Process in batches of 2 — should take 3 batches (2+2+1)
        derived = process_group_log(group.id, batch_size=2)

        entries = list(IssueActionLog.objects.filter(group_id=group.id).order_by("id"))
        assert derived.cursor_id == entries[-1].id
        assert len(entries) == 5

    def test_system_action_no_user(self) -> None:
        group = self.create_group()

        record(group_id=group.id, action=SetResolvedAction(resolution_type="auto"))

        entry = IssueActionLog.objects.get(group_id=group.id)
        assert entry.user_id is None

    def test_status_starts_open(self) -> None:
        group = self.create_group()

        record(group_id=group.id, action=ViewAction(), user_id=self.user.id)
        derived = process_group_log(group.id)
        assert derived.data["status"] == "open"

    def test_resolve_closes(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    def test_unresolve_reopens(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        record(group_id=group.id, action=SetUnresolvedAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["status"] == "open"

    def test_duplicate_resolve_ignored(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    def test_duplicate_unresolve_ignored(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=SetUnresolvedAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["status"] == "open"

    def test_status_toggle(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        record(group_id=group.id, action=SetUnresolvedAction(), user_id=user.id)
        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    def test_recent_viewers_tracks_user(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        viewers = derived.data["recent_viewers"]
        assert str(user.id) in viewers

    def test_recent_viewers_multiple_users(self) -> None:
        group = self.create_group()
        user_a = self.user
        user_b = self.create_user()

        record(group_id=group.id, action=ViewAction(), user_id=user_a.id)
        record(group_id=group.id, action=ViewAction(), user_id=user_b.id)
        derived = process_group_log(group.id)
        viewers = derived.data["recent_viewers"]
        assert str(user_a.id) in viewers
        assert str(user_b.id) in viewers

    def test_recent_viewers_updates_timestamp(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        viewers = derived.data["recent_viewers"]
        assert len(viewers) == 1
        assert str(user.id) in viewers

    def test_recent_viewers_expires_stale(self) -> None:
        group = self.create_group()
        user_old = self.user
        user_new = self.create_user()
        now = timezone.now()

        # Insert the old entry directly to avoid inline processing at the wrong timestamp.
        IssueActionLog.objects.create(
            group_id=group.id,
            type=0,
            user_id=user_old.id,
            data={},
            date_added=now - timedelta(days=60),
        )
        record(group_id=group.id, action=ViewAction(), user_id=user_new.id)

        # Reprocess from scratch to pick up the backdated entry.
        GroupDerivedData.objects.filter(group_id=group.id).delete()
        derived = process_group_log(group.id)
        viewers = derived.data["recent_viewers"]
        assert str(user_old.id) not in viewers
        assert str(user_new.id) in viewers

    def test_recent_viewers_ignores_no_user(self) -> None:
        group = self.create_group()

        record(group_id=group.id, action=ViewAction())
        derived = process_group_log(group.id)
        assert derived.data["recent_viewers"] == {}

    # --- recent_fetched ---

    def test_recent_fetched_tracks_user_and_tool(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=FetchAction(tool="claude"), user_id=user.id)
        derived = process_group_log(group.id)
        fetched = derived.data["recent_fetched"]
        assert str(user.id) in fetched
        assert fetched[str(user.id)]["tool"] == "claude"

    def test_recent_fetched_expires_stale(self) -> None:
        group = self.create_group()
        user_old = self.user
        user_new = self.create_user()
        now = timezone.now()

        IssueActionLog.objects.create(
            group_id=group.id,
            type=3,
            user_id=user_old.id,
            data={"tool": "curl"},
            date_added=now - timedelta(days=60),
        )
        record(group_id=group.id, action=FetchAction(tool="claude"), user_id=user_new.id)

        GroupDerivedData.objects.filter(group_id=group.id).delete()
        derived = process_group_log(group.id)
        fetched = derived.data["recent_fetched"]
        assert str(user_old.id) not in fetched
        assert str(user_new.id) in fetched

    def test_recent_fetched_ignores_no_user(self) -> None:
        group = self.create_group()

        record(group_id=group.id, action=FetchAction(tool="claude"))
        derived = process_group_log(group.id)
        assert derived.data["recent_fetched"] == {}

    # --- working_on ---

    def test_working_on_includes_viewer(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        working = derived.data["working_on"]
        assert str(user.id) in working
        assert working[str(user.id)]["tool"] is None

    def test_working_on_includes_fetcher_with_tool(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=FetchAction(tool="claude"), user_id=user.id)
        derived = process_group_log(group.id)
        working = derived.data["working_on"]
        assert str(user.id) in working
        assert working[str(user.id)]["tool"] == "claude"

    def test_working_on_merges_view_and_fetch(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        record(group_id=group.id, action=FetchAction(tool="claude"), user_id=user.id)
        derived = process_group_log(group.id)
        working = derived.data["working_on"]
        assert len(working) == 1
        assert working[str(user.id)]["tool"] == "claude"

    def test_working_on_empty_when_closed(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["working_on"] == {}

    def test_working_on_resets_on_reopen(self) -> None:
        group = self.create_group()
        user_before = self.user
        user_after = self.create_user()

        record(group_id=group.id, action=ViewAction(), user_id=user_before.id)
        record(group_id=group.id, action=SetResolvedAction(), user_id=user_before.id)
        record(group_id=group.id, action=SetUnresolvedAction(), user_id=user_before.id)
        # Only user_after views after reopen
        record(group_id=group.id, action=ViewAction(), user_id=user_after.id)
        derived = process_group_log(group.id)
        working = derived.data["working_on"]
        assert str(user_after.id) in working
        assert str(user_before.id) not in working

    def test_working_on_since_preserved(self) -> None:
        group = self.create_group()
        user = self.user

        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        first_since = derived.data["working_on"][str(user.id)]["since"]

        # Second view shouldn't move "since" forward
        record(group_id=group.id, action=ViewAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["working_on"][str(user.id)]["since"] == first_since

    # --- autofix / resolved_in_pull_request ---

    def test_resolved_in_pull_request_closes(self) -> None:
        group = self.create_group()
        user = self.user

        record(
            group_id=group.id,
            action=ResolvedInPullRequestAction(pr_id="PR-1"),
            user_id=user.id,
        )
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    def test_autofix_pr_tracked(self) -> None:
        group = self.create_group()

        record(
            group_id=group.id,
            action=AutofixPrCreatedAction(pr_id="PR-1", agent="seer"),
        )
        derived = process_group_log(group.id)
        assert "PR-1" in derived.data["autofix_prs"]

    def test_was_autofixed_when_resolved_by_autofix_pr(self) -> None:
        group = self.create_group()
        user = self.user

        record(
            group_id=group.id,
            action=AutofixPrCreatedAction(pr_id="PR-1", agent="seer"),
        )
        record(
            group_id=group.id,
            action=ResolvedInPullRequestAction(pr_id="PR-1"),
            user_id=user.id,
        )
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is True

    def test_not_autofixed_when_resolved_by_different_pr(self) -> None:
        group = self.create_group()
        user = self.user

        record(
            group_id=group.id,
            action=AutofixPrCreatedAction(pr_id="PR-1", agent="seer"),
        )
        record(
            group_id=group.id,
            action=ResolvedInPullRequestAction(pr_id="PR-99"),
            user_id=user.id,
        )
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is False

    def test_not_autofixed_when_manually_resolved(self) -> None:
        group = self.create_group()
        user = self.user

        record(
            group_id=group.id,
            action=AutofixPrCreatedAction(pr_id="PR-1", agent="seer"),
        )
        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is False

    def test_was_autofixed_stays_true_after_reopen(self) -> None:
        group = self.create_group()
        user = self.user

        record(
            group_id=group.id,
            action=AutofixPrCreatedAction(pr_id="PR-1", agent="seer"),
        )
        record(
            group_id=group.id,
            action=ResolvedInPullRequestAction(pr_id="PR-1"),
            user_id=user.id,
        )
        record(group_id=group.id, action=SetUnresolvedAction(), user_id=user.id)
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is True

    def test_not_autofixed_when_already_closed(self) -> None:
        """RESOLVED_IN_PULL_REQUEST on an already-closed issue doesn't trigger was_autofixed."""
        group = self.create_group()
        user = self.user

        record(
            group_id=group.id,
            action=AutofixPrCreatedAction(pr_id="PR-1", agent="seer"),
        )
        record(group_id=group.id, action=SetResolvedAction(), user_id=user.id)
        # Issue is already closed; this RESOLVED_IN_PULL_REQUEST is a no-op on status
        record(
            group_id=group.id,
            action=ResolvedInPullRequestAction(pr_id="PR-1"),
            user_id=user.id,
        )
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is False


class IssueActionLogDebugEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-issue-action-log-debug"
    method = "post"

    def _post_events(self, events: list[dict[str, Any]]) -> Any:
        return self.get_response(
            self.organization.slug,
            events=events,
        )

    def test_query_autofixed_groups_via_api(self) -> None:
        """
        Three groups with messy, realistic event streams. All three have
        autofix PRs created, manual resolves, unresolves, comments, and
        views mixed in. Only group 1 actually gets closed by its autofix PR.
        Verifies the pipeline correctly identifies just that one.
        """
        self.login_as(self.user)
        user_a = self.user
        user_b = self.create_user()
        groups = [self.create_group() for _ in range(3)]

        # Phase 1: all three get investigated — views, fetches, comments,
        # and autofix PRs are created for all of them.
        phase1 = []
        for g in groups:
            phase1.extend(
                [
                    {"action": "view", "group_id": g.id, "user_id": user_a.id},
                    {
                        "action": "fetch",
                        "group_id": g.id,
                        "user_id": user_b.id,
                        "action_data": {"tool": "claude"},
                    },
                    {
                        "action": "comment",
                        "group_id": g.id,
                        "user_id": user_a.id,
                        "action_data": {"message": "investigating"},
                    },
                    {
                        "action": "autofix_pr_created",
                        "group_id": g.id,
                        "action_data": {"pr_id": f"PR-{g.id}", "agent": "seer"},
                    },
                    {
                        "action": "comment",
                        "group_id": g.id,
                        "user_id": user_b.id,
                        "action_data": {"message": "seer opened a PR"},
                    },
                ]
            )
        response = self._post_events(phase1)
        assert response.status_code == 201

        # Phase 2: group 0 gets manually resolved, then reopened, then
        # manually resolved again. The autofix PR is never the closer.
        response = self._post_events(
            [
                {"action": "set_resolved", "group_id": groups[0].id, "user_id": user_a.id},
                {
                    "action": "comment",
                    "group_id": groups[0].id,
                    "user_id": user_a.id,
                    "action_data": {"message": "fixed it manually"},
                },
                {"action": "set_unresolved", "group_id": groups[0].id, "user_id": user_b.id},
                {
                    "action": "comment",
                    "group_id": groups[0].id,
                    "user_id": user_b.id,
                    "action_data": {"message": "nope, still broken"},
                },
                {"action": "view", "group_id": groups[0].id, "user_id": user_a.id},
                {"action": "set_resolved", "group_id": groups[0].id, "user_id": user_a.id},
            ]
        )
        assert response.status_code == 201

        # Phase 3: group 1 gets resolved by its autofix PR — but not before
        # some back-and-forth.
        response = self._post_events(
            [
                {"action": "view", "group_id": groups[1].id, "user_id": user_a.id},
                {
                    "action": "comment",
                    "group_id": groups[1].id,
                    "user_id": user_a.id,
                    "action_data": {"message": "let's see if seer's PR works"},
                },
                {
                    "action": "resolved_in_pull_request",
                    "group_id": groups[1].id,
                    "user_id": user_b.id,
                    "action_data": {"pr_id": f"PR-{groups[1].id}"},
                },
                {
                    "action": "comment",
                    "group_id": groups[1].id,
                    "user_id": user_b.id,
                    "action_data": {"message": "PR merged, closing"},
                },
            ]
        )
        assert response.status_code == 201

        # Phase 4: group 2 also gets resolved by a PR, but it's a different
        # (non-autofix) PR. Then more activity after.
        response = self._post_events(
            [
                {
                    "action": "resolved_in_pull_request",
                    "group_id": groups[2].id,
                    "user_id": user_a.id,
                    "action_data": {"pr_id": "PR-manual-999"},
                },
                {
                    "action": "comment",
                    "group_id": groups[2].id,
                    "user_id": user_a.id,
                    "action_data": {"message": "closed by a human PR"},
                },
                {"action": "set_unresolved", "group_id": groups[2].id, "user_id": user_b.id},
                {"action": "view", "group_id": groups[2].id, "user_id": user_b.id},
                {
                    "action": "comment",
                    "group_id": groups[2].id,
                    "user_id": user_b.id,
                    "action_data": {"message": "regressed again"},
                },
            ]
        )
        assert response.status_code == 201

        for g in groups:
            process_group_log(g.id)

        # Only group 1 was autofixed — query via Group JOIN to primary derived data
        autofixed = list(
            Group.objects.filter(
                groupderiveddata__primary=True,
                groupderiveddata__data__was_autofixed=True,
            ).values_list("id", flat=True)
        )
        assert autofixed == [groups[1].id]

    def test_rejects_invalid_action(self) -> None:
        self.login_as(self.user)
        group = self.create_group()
        response = self._post_events([{"action": "bogus", "group_id": group.id}])
        assert response.status_code == 400

    def test_rejects_bad_action_data(self) -> None:
        self.login_as(self.user)
        group = self.create_group()
        # CommentAction requires 'message'
        response = self._post_events(
            [
                {"action": "comment", "group_id": group.id, "user_id": self.user.id},
            ]
        )
        assert response.status_code == 400

    def test_rejects_wrong_org_group(self) -> None:
        self.login_as(self.user)
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)
        response = self._post_events(
            [
                {"action": "view", "group_id": other_group.id, "user_id": self.user.id},
            ]
        )
        assert response.status_code == 400

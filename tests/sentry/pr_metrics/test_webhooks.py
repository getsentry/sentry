from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.core.cache import cache

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.issues.constants import ISSUE_VIEW_CACHE_KEY_TTL, cache_key_for_issue_view
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import (
    PullRequestActivity,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestMetrics,
)
from sentry.pr_metrics.webhooks import (
    handle_activity,
    handle_attribution,
    handle_comment,
    handle_emission,
    handle_metrics,
    handle_review,
    handle_review_comment,
    handle_review_thread,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.analytics import get_event_count
from sentry.testutils.silo import cell_silo_test

MODULE = "sentry.pr_metrics.webhooks"


@with_feature("organizations:pr-metrics-attribution")
@cell_silo_test
class HandleWebhookForPrMetricsTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
            title="Fix the bug",
            message="Closes TICKET-1",
        )
        self.base_pr_payload: dict[str, Any] = {
            "number": 42,
            "title": "Fix the bug",
            "body": "Closes TICKET-1",
        }

    def _call(
        self,
        action: str = "opened",
        user_id: int = 999,
        changes: dict[str, Any] | None = None,
    ) -> None:
        payload = dict(self.base_pr_payload)
        payload["user"] = {"id": user_id, "login": "testbot"}
        event: dict[str, Any] = {"action": action, "pull_request": payload}
        if changes is not None:
            event["changes"] = changes
        handle_attribution(
            github_event=GithubWebhookType.PULL_REQUEST,
            event=event,
            organization=self.organization,
            repo=self.repo,
        )

    # --- App ID attribution ---

    def test_seer_app_user_emits_sentry_app_attribution(self) -> None:
        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_type == PullRequestAttributionSignalType.SENTRY_APP
        assert attr.source == PullRequestAttributionSource.WEBHOOK_DATA
        assert attr.is_valid is True
        assert attr.signal_details is None

    def test_sentry_app_user_emits_sentry_app_attribution(self) -> None:
        self._call(user_id=settings.SENTRY_GITHUB_APP_USER_ID)

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_type == PullRequestAttributionSignalType.SENTRY_APP
        assert attr.source == PullRequestAttributionSource.WEBHOOK_DATA
        assert attr.is_valid is True
        assert attr.signal_details is None

    def test_unknown_user_no_attribution_created(self) -> None:
        self._call(user_id=99999)

        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()

    def test_app_attribution_only_written_on_opened(self) -> None:
        # reopened and edited should not create a second app attribution row
        self._call(action="reopened", user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)
        self._call(
            action="edited",
            user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID,
            changes={"body": {"from": "old body"}},
        )

        assert not PullRequestAttribution.objects.filter(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
        ).exists()

    # --- Action gate ---

    def test_irrelevant_actions_skipped(self) -> None:
        for action in (
            "synchronize",
            "closed",
            "merged",
            "labeled",
            "assigned",
            "reopened",
            "edited",
        ):
            self._call(action=action, user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()

    # --- Idempotency and redelivery ---

    def test_idempotent_on_repeated_webhooks(self) -> None:
        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)
        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        assert PullRequestAttribution.objects.filter(pull_request=self.pr).count() == 1

    def test_redelivery_revives_invalidated_signal(self) -> None:
        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)
        PullRequestAttribution.objects.filter(pull_request=self.pr).update(is_valid=False)

        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.is_valid is True

    # --- MCP attribution ---

    def test_mcp_attribution_recorded_when_referenced_issue_viewed_via_mcp(self) -> None:
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pr.id,
        )
        cache.set(cache_key_for_issue_view(group.id, "mcp"), "cursor", ISSUE_VIEW_CACHE_KEY_TTL)

        with self.feature("organizations:mcp-issue-view-attribution"):
            self._call(user_id=999)

        attr = PullRequestAttribution.objects.get(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.MCP,
        )
        assert attr.source == PullRequestAttributionSource.WEBHOOK_DATA
        assert attr.signal_details == {"group_ids": {str(group.id): "cursor"}}

    def test_mcp_attribution_not_recorded_without_cache_hit(self) -> None:
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pr.id,
        )

        with self.feature("organizations:mcp-issue-view-attribution"):
            self._call(user_id=999)

        assert not PullRequestAttribution.objects.filter(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.MCP,
        ).exists()

    def test_mcp_attribution_not_recorded_without_group_link(self) -> None:
        with self.feature("organizations:mcp-issue-view-attribution"):
            self._call(user_id=999)

        assert not PullRequestAttribution.objects.filter(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.MCP,
        ).exists()

    def test_mcp_and_app_attribution_coexist(self) -> None:
        group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pr.id,
        )
        cache.set(cache_key_for_issue_view(group.id, "mcp"), "cursor", ISSUE_VIEW_CACHE_KEY_TTL)

        with self.feature("organizations:mcp-issue-view-attribution"):
            self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        assert PullRequestAttribution.objects.filter(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
        ).exists()
        assert PullRequestAttribution.objects.filter(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.MCP,
        ).exists()

    # --- Feature flag ---

    def test_feature_flag_off_skips_attribution(self) -> None:
        with self.feature({"organizations:pr-metrics-attribution": False}):
            self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()

    # --- Error handling ---

    def test_missing_pr_logs_warning_and_does_not_raise(self) -> None:
        event = {
            "action": "opened",
            "pull_request": {
                "number": 9999,
                "title": "",
                "body": "",
                "user": {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
            },
        }
        with patch(f"{MODULE}.logger") as mock_logger:
            handle_attribution(
                github_event=GithubWebhookType.PULL_REQUEST,
                event=event,
                organization=self.organization,
                repo=self.repo,
            )

        mock_logger.warning.assert_called_once_with(
            "github.pr_metrics.pr_not_found",
            extra={"repository_id": self.repo.id, "pr_number": 9999},
        )
        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()


HEAD_SHA = "a" * 40
MERGE_SHA = "b" * 40
OPENED_AT = datetime(2020, 6, 4, 9, 0, 0, tzinfo=timezone.utc)  # past year avoids S015
CLOSED_AT = datetime(2020, 6, 4, 10, 0, 0, tzinfo=timezone.utc)


@with_feature("organizations:pr-metrics-emit")
@with_feature("organizations:pr-metrics-activity")
@cell_silo_test
class HandleWebhookForPrMetricsEmissionTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )
        PullRequestAttribution.objects.create(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=True,
        )
        # The metrics processor persists the counters before emission runs.
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, additions=1, deletions=2, is_assigned=True
        )

    def _payload(self) -> dict[str, Any]:
        # Emission reads every fact off the stored PR row; the payload is only
        # used to resolve the PR by number.
        return {"number": 42}

    def _call(self, *, action: str = "closed", merged: bool = True) -> None:
        if action == "closed":
            # PullRequestEventWebhook._handle persists every lifecycle fact on the
            # PR row before the emission processor runs; emit reads it there.
            self.pull_request.update(
                head_commit_sha=HEAD_SHA,
                opened_at=OPENED_AT,
                closed_at=CLOSED_AT,
                merged_at=CLOSED_AT if merged else None,
                merge_commit_sha=MERGE_SHA if merged else None,
                draft=False,
            )
        handle_emission(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": action, "pull_request": self._payload()},
            organization=self.organization,
            repo=self.repo,
        )

    @patch("sentry.analytics.record")
    def test_emits_on_merge(self, mock_record: MagicMock) -> None:
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        row = mock_record.call_args_list[-1].args[0]
        assert row.close_action == "merged"
        assert row.verdict == "merged_unchanged"

    @patch("sentry.analytics.record")
    def test_emits_on_close_unmerged(self, mock_record: MagicMock) -> None:
        self._call(merged=False)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        row = mock_record.call_args_list[-1].args[0]
        assert row.close_action == "closed"
        assert row.verdict == "closed_unmerged"

    def _add_synchronize(self) -> None:
        # A push to the PR branch after it opened — makes a merge non-deterministic.
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="sync-1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={},
        )

    def test_claims_verdict_on_metrics_row(self) -> None:
        with patch("sentry.analytics.record"):
            self._call(merged=True)
        metrics = PullRequestMetrics.objects.get(pull_request=self.pull_request)
        assert metrics.verdict == "merged_unchanged"

    @patch("sentry.analytics.record")
    def test_skips_emit_when_judge_needed(self, mock_record: MagicMock) -> None:
        # A merge with later commits can't be settled deterministically — it needs
        # a judge. The forward isn't wired, so it's skipped and no verdict is set.
        self._add_synchronize()
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None

    @patch("sentry.analytics.record")
    def test_skips_emit_when_metrics_row_missing(self, mock_record: MagicMock) -> None:
        # A missing metrics row (handle_metrics failed) is deferred to a judge, not
        # silently dropped as a redelivery — for a merge as much as a close.
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).delete()
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch("sentry.analytics.record")
    def test_ignores_non_terminal_actions(self, mock_record: MagicMock) -> None:
        self._call(action="opened")
        self._call(action="edited")
        self._call(action="synchronize")
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch("sentry.analytics.record")
    def test_does_nothing_when_flag_off(self, mock_record: MagicMock) -> None:
        with self.feature({"organizations:pr-metrics-emit": False}):
            self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch("sentry.analytics.record")
    def test_skips_emit_when_activity_tracking_disabled(self, mock_record: MagicMock) -> None:
        # Without activity tracking the commits-after-open signal is absent, so the
        # verdict can't be settled deterministically — defer rather than emit a
        # possibly-wrong merged_unchanged. No verdict is claimed either.
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None

    @patch("sentry.analytics.record")
    def test_skips_untracked_pr(self, mock_record: MagicMock) -> None:
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).delete()
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0
        # No verdict is claimed for an untracked PR, so the redelivery guard stays open.
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None

    @patch("sentry.analytics.record")
    def test_untracked_pr_emits_once_attribution_lands(self, mock_record: MagicMock) -> None:
        # An untracked PR claims no verdict; once attribution arrives (e.g. a Seer
        # backfill), a later delivery still emits — the claim was never burned.
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).delete()
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

        PullRequestAttribution.objects.create(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=True,
        )
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_unchanged"
        )

    @patch("sentry.analytics.record")
    def test_redelivery_dropped_after_first_terminal_event(self, mock_record: MagicMock) -> None:
        self._call(merged=True)
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_judge_needed_pr_never_emits_on_redelivery(self, mock_record: MagicMock) -> None:
        # A judge-needed PR writes no verdict, so every redelivery re-evaluates to
        # "needs judge" and skips — it never emits a row from this path.
        self._add_synchronize()
        self._call(merged=True)
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch(f"{MODULE}.logger")
    @patch("sentry.analytics.record")
    def test_missing_pr_logs_warning_and_does_not_emit(
        self, mock_record: MagicMock, mock_logger: MagicMock
    ) -> None:
        # A close webhook can arrive before the PR row exists (race).
        handle_emission(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": "closed", "pull_request": {"number": 9999, "merged": True}},
            organization=self.organization,
            repo=self.repo,
        )
        mock_logger.warning.assert_called_once_with(
            "github.pr_metrics.pr_not_found",
            extra={"repository_id": self.repo.id, "pr_number": 9999},
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0


@with_feature("organizations:pr-metrics-emit")
@cell_silo_test
class HandleWebhookForPrMetricsCountersTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key="42"
        )

    def _call(self, *, action: str = "opened", **counters: Any) -> None:
        payload: dict[str, Any] = {"number": 42, **counters}
        handle_metrics(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": action, "pull_request": payload},
            organization=self.organization,
            repo=self.repo,
        )

    def test_creates_metrics_row_from_payload(self) -> None:
        self._call(
            additions=10,
            deletions=4,
            changed_files=2,
            commits=3,
            comments=1,
            review_comments=5,
            assignees=[{"login": "octocat"}],
        )

        metrics = PullRequestMetrics.objects.get(pull_request=self.pull_request)
        assert metrics.additions == 10
        assert metrics.deletions == 4
        assert metrics.files_changed == 2
        assert metrics.commits_count == 3
        assert metrics.comments_count == 1
        assert metrics.review_comments_count == 5
        assert metrics.is_assigned is True

    def test_absent_counts_default_to_zero(self) -> None:
        self._call()

        metrics = PullRequestMetrics.objects.get(pull_request=self.pull_request)
        assert metrics.additions == 0
        assert metrics.review_comments_count == 0
        assert metrics.is_assigned is False

    def test_refreshes_existing_row_without_forking(self) -> None:
        self._call(action="opened", additions=1)
        self._call(action="synchronize", additions=20, deletions=7)

        metrics = PullRequestMetrics.objects.get(pull_request=self.pull_request)
        assert metrics.additions == 20
        assert metrics.deletions == 7
        assert PullRequestMetrics.objects.filter(pull_request=self.pull_request).count() == 1

    def test_preserves_seer_only_columns_on_update(self) -> None:
        # The webhook owns the activity counters; the judge path owns verdict /
        # reviews_count / participants_count. An update must not stomp them.
        PullRequestMetrics.objects.create(
            pull_request=self.pull_request, reviews_count=3, participants_count=2
        )
        self._call(additions=9)

        metrics = PullRequestMetrics.objects.get(pull_request=self.pull_request)
        assert metrics.additions == 9
        assert metrics.reviews_count == 3
        assert metrics.participants_count == 2

    def test_does_nothing_when_flag_off(self) -> None:
        with self.feature({"organizations:pr-metrics-emit": False}):
            self._call(additions=5)
        assert not PullRequestMetrics.objects.filter(pull_request=self.pull_request).exists()

    def test_missing_pr_writes_nothing(self) -> None:
        handle_metrics(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": "opened", "pull_request": {"number": 9999, "additions": 1}},
            organization=self.organization,
            repo=self.repo,
        )
        assert PullRequestMetrics.objects.count() == 0


@with_feature("organizations:pr-metrics-activity")
@cell_silo_test
class HandleWebhookForPrMetricsActivityTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
            title="Fix the bug",
            message="Closes TICKET-1",
        )

    def _call(
        self,
        action: str = "opened",
        webhook_id: str | None = "delivery-1",
        merged: bool = False,
        head_sha: str = "abc123",
        base_sha: str = "def456",
        additions: int = 10,
        deletions: int = 5,
        changed_files: int = 3,
        commits: int = 2,
        comments: int = 0,
        review_comments: int = 0,
        before: str | None = None,
        after: str | None = None,
        changes: dict[str, Any] | None = None,
        label: dict[str, Any] | None = None,
        extra_event: dict[str, Any] | None = None,
    ) -> None:
        pull_request: dict[str, Any] = {
            "number": 42,
            "title": "Fix the bug",
            "body": "Closes TICKET-1",
            "merged": merged,
            "merge_commit_sha": "merge-sha" if merged else None,
            "merged_by": {"id": 999, "login": "testuser"} if merged else None,
            "head": {"sha": head_sha},
            "base": {"sha": base_sha},
            "additions": additions,
            "deletions": deletions,
            "changed_files": changed_files,
            "commits": commits,
            "comments": comments,
            "review_comments": review_comments,
            "user": {"id": 999, "login": "testuser"},
        }
        event: dict[str, Any] = {
            "action": action,
            "pull_request": pull_request,
            "sender": {"id": 999, "login": "testuser", "type": "User"},
        }
        if before is not None:
            event["before"] = before
        if after is not None:
            event["after"] = after
        if changes is not None:
            event["changes"] = changes
        if label is not None:
            event["label"] = label
        if extra_event is not None:
            event.update(extra_event)
        handle_activity(
            github_event=GithubWebhookType.PULL_REQUEST,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    # --- Activity row creation ---

    def test_opened_writes_opened_activity(self) -> None:
        self._call(action="opened")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.OPENED
        assert activity.webhook_id == "delivery-1"

    def test_opened_payload_captures_size_fields(self) -> None:
        self._call(action="opened", additions=20, deletions=8, changed_files=4, commits=3)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["additions"] == 20
        assert activity.payload["deletions"] == 8
        assert activity.payload["changed_files"] == 4
        assert activity.payload["commits"] == 3

    def test_closed_unmerged_writes_closed_activity_with_metrics(self) -> None:
        self._call(
            action="closed",
            merged=False,
            additions=5,
            deletions=2,
            changed_files=1,
            commits=1,
            comments=3,
            review_comments=7,
        )

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.CLOSED
        assert activity.payload["merged"] is False
        assert activity.payload["additions"] == 5
        assert activity.payload["comments"] == 3
        assert activity.payload["review_comments"] == 7
        assert activity.payload["merged_by"] is None

    def test_closed_merged_writes_merged_activity_with_metrics(self) -> None:
        self._call(
            action="closed",
            merged=True,
            additions=20,
            deletions=3,
            changed_files=4,
            commits=5,
            comments=2,
            review_comments=4,
        )

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.MERGED
        assert activity.payload["merged"] is True
        assert activity.payload["additions"] == 20
        assert activity.payload["commits"] == 5
        assert activity.payload["comments"] == 2
        assert activity.payload["review_comments"] == 4
        assert activity.payload["merged_by"] == "testuser"

    def test_reopened_writes_reopened_activity_with_size_fields(self) -> None:
        self._call(action="reopened", additions=5, deletions=2, changed_files=1, commits=1)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.REOPENED
        assert activity.payload["additions"] == 5
        assert activity.payload["deletions"] == 2
        assert activity.payload["changed_files"] == 1
        assert activity.payload["commits"] == 1

    def test_synchronize_writes_synchronized_activity(self) -> None:
        self._call(action="synchronize", before="old-sha", after="new-sha")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.SYNCHRONIZED
        assert activity.payload["before_sha"] == "old-sha"
        assert activity.payload["after_sha"] == "new-sha"

    def test_edited_writes_edited_activity_with_changed_fields(self) -> None:
        self._call(
            action="edited", changes={"body": {"from": "old body"}, "title": {"from": "old"}}
        )

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.EDITED
        assert activity.payload["changed_fields"] == ["body", "title"]

    def test_edited_with_no_changes_dict_writes_empty_changed_fields(self) -> None:
        self._call(action="edited")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.EDITED
        assert activity.payload["changed_fields"] == []

    def test_labeled_writes_labeled_activity_with_label_info(self) -> None:
        self._call(action="labeled", label={"name": "bug", "color": "d73a4a"})

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.LABELED
        assert activity.payload["label_name"] == "bug"
        assert "label_color" not in activity.payload

    def test_unlabeled_writes_unlabeled_activity_with_label_info(self) -> None:
        self._call(action="unlabeled", label={"name": "bug", "color": "d73a4a"})

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.UNLABELED
        assert activity.payload["label_name"] == "bug"
        assert "label_color" not in activity.payload

    # --- Payload sanitisation ---

    def test_opened_payload_contains_common_structural_fields(self) -> None:
        self._call(action="opened", head_sha="abc123", base_sha="def456")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["action"] == "opened"
        assert activity.payload["sender_login"] == "testuser"
        assert activity.payload["head_sha"] == "abc123"
        assert activity.payload["base_sha"] == "def456"

    def test_payload_never_contains_title_or_body(self) -> None:
        for action, kw in [
            ("opened", {}),
            ("closed", {"webhook_id": "d-closed"}),
            ("reopened", {"webhook_id": "d-reopened"}),
            ("synchronize", {"webhook_id": "d-sync", "before": "old", "after": "new"}),
        ]:
            self._call(action=action, **kw)  # type: ignore[arg-type]
            activity = PullRequestActivity.objects.get(
                pull_request=self.pr, webhook_id=kw.get("webhook_id", "delivery-1")
            )
            assert "title" not in activity.payload
            assert "body" not in activity.payload

    def test_edited_payload_stores_changed_field_names_not_values(self) -> None:
        # changed_fields should be the keys of event["changes"], not the old text values
        self._call(
            action="edited",
            changes={"body": {"from": "very sensitive old body text"}},
        )

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["changed_fields"] == ["body"]
        assert "very sensitive old body text" not in str(activity.payload)

    # --- Idempotency ---

    def test_redelivery_with_same_webhook_id_does_not_duplicate(self) -> None:
        self._call(action="opened", webhook_id="delivery-abc")
        self._call(action="opened", webhook_id="delivery-abc")

        assert PullRequestActivity.objects.filter(pull_request=self.pr).count() == 1

    def test_different_webhook_ids_create_separate_rows(self) -> None:
        self._call(action="opened", webhook_id="delivery-1")
        self._call(action="synchronize", webhook_id="delivery-2")

        assert PullRequestActivity.objects.filter(pull_request=self.pr).count() == 2

    def test_no_activity_written_without_webhook_id(self) -> None:
        self._call(action="opened", webhook_id=None)

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    # --- Review requests ---

    def test_review_requested_writes_activity_for_individual(self) -> None:
        self._call(
            action="review_requested",
            webhook_id="delivery-rr",
            extra_event={"requested_reviewer": {"id": 77, "login": "reviewer"}},
        )

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.REVIEW_REQUESTED
        assert activity.payload["is_team_review"] is False

    def test_review_requested_writes_activity_for_team(self) -> None:
        self._call(
            action="review_requested",
            webhook_id="delivery-rr-team",
            extra_event={"requested_team": {"id": 5, "name": "backend"}},
        )

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["is_team_review"] is True

    def test_review_request_removed_writes_activity(self) -> None:
        self._call(action="review_request_removed", webhook_id="delivery-rrr")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.REVIEW_REQUEST_REMOVED
        assert activity.payload["is_team_review"] is False

    def test_review_request_removed_team_review(self) -> None:
        self._call(
            action="review_request_removed",
            webhook_id="delivery-rrr-team",
            extra_event={"requested_team": {"name": "backend"}},
        )

        activity = PullRequestActivity.objects.get(
            pull_request=self.pr, webhook_id="delivery-rrr-team"
        )
        assert activity.payload["is_team_review"] is True

    # --- Draft / ready ---

    def test_converted_to_draft_writes_activity(self) -> None:
        self._call(action="converted_to_draft", webhook_id="delivery-draft")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.CONVERTED_TO_DRAFT

    def test_ready_for_review_writes_activity(self) -> None:
        self._call(action="ready_for_review", webhook_id="delivery-rfr")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.READY_FOR_REVIEW

    # --- Assigned / unassigned ---

    def test_assigned_writes_activity_with_assignee_login(self) -> None:
        self._call(
            action="assigned",
            webhook_id="delivery-assign",
            extra_event={"assignee": {"id": 42, "login": "dev"}},
        )

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.ASSIGNED
        assert activity.payload["assignee_login"] == "dev"

    def test_unassigned_writes_activity_with_assignee_login(self) -> None:
        self._call(
            action="unassigned",
            webhook_id="delivery-unassign",
            extra_event={"assignee": {"id": 42, "login": "dev"}},
        )

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.UNASSIGNED
        assert activity.payload["assignee_login"] == "dev"

    # --- sender_type in base payload ---

    def test_bot_sender_type_stored_in_payload(self) -> None:
        self._call(action="opened", extra_event={"sender": {"login": "testbot", "type": "Bot"}})

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["sender_type"] == "Bot"

    def test_human_sender_type_stored_in_payload(self) -> None:
        self._call(action="opened", extra_event={"sender": {"login": "testuser", "type": "User"}})

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["sender_type"] == "User"

    # --- Feature flag interactions ---

    def test_attribution_flag_only_does_not_write_activity(self) -> None:
        with self.feature(
            {
                "organizations:pr-metrics-activity": False,
                "organizations:pr-metrics-attribution": True,
            }
        ):
            self._call(action="opened")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    # --- Unhandled actions ---

    def test_unhandled_actions_do_not_write_activity(self) -> None:
        for action in ("auto_merge_enabled", "milestoned", "demilestoned"):
            self._call(action=action, webhook_id=f"delivery-{action}")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()


@with_feature("organizations:pr-metrics-activity")
@cell_silo_test
class HandleCommentForPrMetricsTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
        )

    def _call(
        self,
        action: str = "created",
        sender_type: str = "User",
        author_association: str = "NONE",
        webhook_id: str | None = "delivery-1",
        is_pr_comment: bool = True,
    ) -> None:
        issue: dict[str, Any] = {"number": 42}
        if is_pr_comment:
            issue["pull_request"] = {"url": "https://github.com/org/repo/pull/42"}
        event: dict[str, Any] = {
            "action": action,
            "issue": issue,
            "sender": {"id": 999, "login": "testuser", "type": sender_type},
            "comment": {"id": 1, "author_association": author_association},
        }
        handle_comment(
            github_event=GithubWebhookType.ISSUE_COMMENT,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def test_comment_created_writes_activity(self) -> None:
        self._call(action="created")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.COMMENT_CREATED
        assert activity.webhook_id == "delivery-1"

    def test_comment_edited_writes_activity(self) -> None:
        self._call(action="edited")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.COMMENT_EDITED

    def test_bot_sender_type_stored(self) -> None:
        self._call(sender_type="Bot")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["sender_type"] == "Bot"

    def test_user_sender_type_stored(self) -> None:
        self._call(sender_type="User")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["sender_type"] == "User"

    def test_plain_issue_comment_skipped(self) -> None:
        self._call(is_pr_comment=False)

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_redelivery_deduplicated(self) -> None:
        self._call(webhook_id="delivery-abc")
        self._call(webhook_id="delivery-abc")

        assert PullRequestActivity.objects.filter(pull_request=self.pr).count() == 1

    def test_author_association_stored(self) -> None:
        self._call(author_association="MEMBER")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["author_association"] == "MEMBER"

    def test_no_activity_without_webhook_id(self) -> None:
        self._call(webhook_id=None)

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_unknown_pr_number_logs_warning_and_does_not_raise(self) -> None:
        event: dict[str, Any] = {
            "action": "created",
            "issue": {
                "number": 9999,
                "pull_request": {"url": "https://github.com/org/repo/pull/9999"},
            },
            "sender": {"id": 123, "login": "testuser", "type": "User"},
            "comment": {"author_association": "NONE"},
        }
        with patch(f"{MODULE}.logger") as mock_logger:
            handle_comment(
                github_event=GithubWebhookType.ISSUE_COMMENT,
                event=event,
                organization=self.organization,
                repo=self.repo,
                github_delivery_id="delivery-unknown",
            )

        mock_logger.warning.assert_called_once_with(
            "github.pr_metrics.comment.pr_not_found",
            extra={"repository_id": self.repo.id, "issue_number": 9999},
        )
        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_feature_flag_off_skips_comment(self) -> None:
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_deleted_action_skipped(self) -> None:
        self._call(action="deleted", webhook_id="delivery-del")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_regular_comment_has_is_review_false(self) -> None:
        self._call(action="created")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["is_review"] is False


@with_feature("organizations:pr-metrics-activity")
@cell_silo_test
class HandleReviewForPrMetricsTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
        )

    def _call(
        self,
        action: str = "submitted",
        review_state: str = "approved",
        review_id: int = 100,
        webhook_id: str | None = "delivery-1",
    ) -> None:
        event: dict[str, Any] = {
            "action": action,
            "review": {
                "id": review_id,
                "state": review_state,
                "user": {"id": 77, "login": "reviewer"},
            },
            "pull_request": {"number": 42},
            "sender": {"id": 77, "login": "reviewer", "type": "User"},
        }
        handle_review(
            github_event=GithubWebhookType.PULL_REQUEST_REVIEW,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def test_submitted_writes_review_submitted_activity(self) -> None:
        self._call(review_state="approved")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.REVIEW_SUBMITTED
        assert activity.payload["review_state"] == "approved"
        assert activity.payload["review_id"] == 100
        assert activity.payload["sender_login"] == "reviewer"

    def test_changes_requested_state(self) -> None:
        self._call(review_state="changes_requested")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.payload["review_state"] == "changes_requested"

    def test_non_submitted_actions_skipped(self) -> None:
        self._call(action="edited")
        self._call(action="dismissed")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_flag_off_skips_review(self) -> None:
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_no_activity_without_webhook_id(self) -> None:
        self._call(webhook_id=None)

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_unknown_pr_number_logs_warning_and_does_not_raise(self) -> None:
        event: dict[str, Any] = {
            "action": "submitted",
            "review": {"id": 100, "state": "approved"},
            "pull_request": {"number": 9999},
            "sender": {"id": 77, "login": "reviewer", "type": "User"},
        }
        with patch(f"{MODULE}.logger") as mock_logger:
            handle_review(
                github_event=GithubWebhookType.PULL_REQUEST_REVIEW,
                event=event,
                organization=self.organization,
                repo=self.repo,
                github_delivery_id="delivery-x",
            )

        mock_logger.warning.assert_called_once_with(
            "github.pr_metrics.pr_not_found",
            extra={"repository_id": self.repo.id, "pr_number": 9999},
        )
        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()


@with_feature("organizations:pr-metrics-activity")
@cell_silo_test
class HandleReviewCommentForPrMetricsTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
        )

    def _call(
        self,
        action: str = "created",
        review_id: int = 100,
        author_association: str = "CONTRIBUTOR",
        webhook_id: str | None = "delivery-1",
    ) -> None:
        event: dict[str, Any] = {
            "action": action,
            "comment": {
                "id": 1,
                "pull_request_review_id": review_id,
                "author_association": author_association,
            },
            "pull_request": {"number": 42},
            "sender": {"id": 77, "login": "reviewer", "type": "User"},
        }
        handle_review_comment(
            github_event=GithubWebhookType.PULL_REQUEST_REVIEW_COMMENT,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def test_created_writes_comment_created_activity(self) -> None:
        self._call(action="created", review_id=42)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.COMMENT_CREATED
        assert activity.payload["is_review"] is True
        assert activity.payload["review_id"] == 42
        assert activity.payload["sender_login"] == "reviewer"

    def test_edited_writes_comment_edited_activity(self) -> None:
        self._call(action="edited")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.COMMENT_EDITED
        assert activity.payload["is_review"] is True

    def test_deleted_action_skipped(self) -> None:
        self._call(action="deleted")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_flag_off_skips_review_comment(self) -> None:
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_redelivery_deduplicated(self) -> None:
        self._call(webhook_id="delivery-abc")
        self._call(webhook_id="delivery-abc")

        assert PullRequestActivity.objects.filter(pull_request=self.pr).count() == 1

    def test_unknown_pr_number_logs_warning_and_does_not_raise(self) -> None:
        event: dict[str, Any] = {
            "action": "created",
            "comment": {"id": 1, "pull_request_review_id": 100, "author_association": "NONE"},
            "pull_request": {"number": 9999},
            "sender": {"id": 77, "login": "reviewer", "type": "User"},
        }
        with patch(f"{MODULE}.logger") as mock_logger:
            handle_review_comment(
                github_event=GithubWebhookType.PULL_REQUEST_REVIEW_COMMENT,
                event=event,
                organization=self.organization,
                repo=self.repo,
                github_delivery_id="delivery-x",
            )

        mock_logger.warning.assert_called_once_with(
            "github.pr_metrics.pr_not_found",
            extra={"repository_id": self.repo.id, "pr_number": 9999},
        )
        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()


@with_feature("organizations:pr-metrics-activity")
@cell_silo_test
class HandleReviewThreadForPrMetricsTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
        )

    def _call(
        self,
        action: str = "resolved",
        thread_id: str = "MDExOlB1bGxSZXF1ZXN0UmV2aWV3VGhyZWFkNTU=",
        webhook_id: str | None = "delivery-1",
    ) -> None:
        event: dict[str, Any] = {
            "action": action,
            "thread": {"node_id": thread_id},
            "pull_request": {"number": 42},
            "sender": {"id": 77, "login": "reviewer", "type": "User"},
        }
        handle_review_thread(
            github_event=GithubWebhookType.PULL_REQUEST_REVIEW_THREAD,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def test_resolved_writes_resolved_activity(self) -> None:
        self._call(action="resolved")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.REVIEW_THREAD_RESOLVED
        assert activity.payload["thread_id"] == "MDExOlB1bGxSZXF1ZXN0UmV2aWV3VGhyZWFkNTU="
        assert activity.payload["is_resolved"] is True

    def test_unresolved_writes_unresolved_activity(self) -> None:
        self._call(action="unresolved", webhook_id="delivery-2")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.REVIEW_THREAD_UNRESOLVED
        assert activity.payload["is_resolved"] is False

    def test_unknown_action_skipped(self) -> None:
        self._call(action="created")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_flag_off_skips_thread_event(self) -> None:
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_no_activity_without_webhook_id(self) -> None:
        self._call(webhook_id=None)

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_unknown_pr_number_logs_warning_and_does_not_raise(self) -> None:
        event: dict[str, Any] = {
            "action": "resolved",
            "thread": {"node_id": "MDEx=="},
            "pull_request": {"number": 9999},
            "sender": {"id": 77, "login": "reviewer", "type": "User"},
        }
        with patch(f"{MODULE}.logger") as mock_logger:
            handle_review_thread(
                github_event=GithubWebhookType.PULL_REQUEST_REVIEW_THREAD,
                event=event,
                organization=self.organization,
                repo=self.repo,
                github_delivery_id="delivery-x",
            )

        mock_logger.warning.assert_called_once_with(
            "github.pr_metrics.pr_not_found",
            extra={"repository_id": self.repo.id, "pr_number": 9999},
        )
        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

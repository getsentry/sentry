from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import orjson
from django.conf import settings
from django.core.cache import cache

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.issues.constants import ISSUE_VIEW_CACHE_KEY_TTL, cache_key_for_issue_view
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestActivity,
    PullRequestActivityType,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestLifecycleState,
    PullRequestMetrics,
    PullRequestVerdict,
)
from sentry.pr_metrics.tasks import emit_pr_metrics_cooldown_task
from sentry.pr_metrics.webhooks import (
    handle_activity,
    handle_attribution,
    handle_check_run,
    handle_check_suite,
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
        html_url: str | None = None,
    ) -> None:
        payload = dict(self.base_pr_payload)
        payload["user"] = {"id": user_id, "login": "testbot"}
        if html_url is not None:
            payload["html_url"] = html_url
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

    def test_app_attribution_not_written_on_non_terminal_actions(self) -> None:
        self._call(action="synchronize", user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)
        self._call(action="labeled", user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        assert not PullRequestAttribution.objects.filter(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
        ).exists()

    def test_app_attribution_written_on_closed(self) -> None:
        # A Sentry-authored PR that never got a row at open (e.g. opened before the
        # flag, or resolving no issues) is still attributed at the terminal close
        # event so it can be tracked for emission.
        self._call(action="closed", user_id=settings.SENTRY_GITHUB_APP_USER_ID)

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_type == PullRequestAttributionSignalType.SENTRY_APP
        assert attr.source == PullRequestAttributionSource.WEBHOOK_DATA
        assert attr.is_valid is True

    def test_app_attribution_idempotent_across_open_then_close(self) -> None:
        self._call(action="opened", user_id=settings.SENTRY_GITHUB_APP_USER_ID)
        self._call(action="closed", user_id=settings.SENTRY_GITHUB_APP_USER_ID)

        assert (
            PullRequestAttribution.objects.filter(
                pull_request=self.pr,
                signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            ).count()
            == 1
        )

    # --- Action gate ---

    def test_irrelevant_actions_skipped(self) -> None:
        for action in (
            "synchronize",
            "labeled",
            "assigned",
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

    # --- Local Seer run lookup (supplements the regex-based GroupLink match) ---

    def test_app_attribution_includes_seer_run_group_id(self) -> None:
        group = self.create_group(project=self.project)
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=555)
        self.create_seer_agent_run(run=run, group=group)
        self.create_seer_run_pull_request(run=run, pull_request=self.pr)

        self._call(
            user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID,
            html_url="https://github.com/org/repo/pull/42",
        )

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_details == {
            "pr_url": "https://github.com/org/repo/pull/42",
            "group_ids": [group.id],
            "run_id": 555,
        }

    def test_app_attribution_unions_regex_and_seer_run_group_ids(self) -> None:
        regex_group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=regex_group.id,
            project_id=regex_group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pr.id,
        )
        seer_group = self.create_group(project=self.project)
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=777)
        self.create_seer_agent_run(run=run, group=seer_group)
        self.create_seer_run_pull_request(run=run, pull_request=self.pr)

        self._call(
            user_id=settings.SENTRY_GITHUB_APP_USER_ID,
            html_url="https://github.com/org/repo/pull/42",
        )

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_details is not None
        assert attr.signal_details["group_ids"] == sorted([regex_group.id, seer_group.id])
        assert attr.signal_details["run_id"] == 777

    def test_app_attribution_without_seer_run_link_falls_back_to_regex(self) -> None:
        regex_group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group_id=regex_group.id,
            project_id=regex_group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pr.id,
        )

        self._call(
            user_id=settings.SENTRY_GITHUB_APP_USER_ID,
            html_url="https://github.com/org/repo/pull/42",
        )

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_details is not None
        assert attr.signal_details["group_ids"] == [regex_group.id]
        assert attr.signal_details["run_id"] is None

    def test_app_attribution_seer_run_without_agent_row_yields_no_group_id(self) -> None:
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=888)
        self.create_seer_run_pull_request(run=run, pull_request=self.pr)

        self._call(
            user_id=settings.SENTRY_GITHUB_APP_USER_ID,
            html_url="https://github.com/org/repo/pull/42",
        )

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.signal_details is not None
        assert attr.signal_details["group_ids"] == []
        assert attr.signal_details["run_id"] == 888

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

    def test_missing_pr_logs_unresolved_and_does_not_raise(self) -> None:
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

        mock_logger.info.assert_called_once_with(
            "pr_metrics.pull_request.unresolved",
            extra={
                "github_event": GithubWebhookType.PULL_REQUEST,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "repo_name": self.repo.name,
                "pr_number": 9999,
                "github_delivery_id": None,
                "reason": "missing_opened_at",
            },
        )
        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()


HEAD_SHA = "a" * 40
MERGE_SHA = "b" * 40
OPENED_AT = datetime(2020, 6, 4, 9, 0, 0, tzinfo=timezone.utc)  # past year avoids S015
CLOSED_AT = datetime(2020, 6, 4, 10, 0, 0, tzinfo=timezone.utc)


@with_feature("organizations:pr-metrics-emit")
@with_feature(["organizations:pr-metrics-activity", "organizations:gen-ai-features"])
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

    def _run_scheduled_cooldown(self) -> None:
        # Emission is deferred: handle_emission only claims WAITING_EVENT_COOLDOWN and
        # schedules the cooldown task. Run that task now, as it would fire after the
        # window, so these end-to-end tests observe the eventual emit/forward. Only
        # run it when the claim was actually won (mirrors production, where the task
        # exists only if it was scheduled).
        claimed = PullRequestMetrics.objects.filter(
            pull_request=self.pull_request,
            verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN,
        ).exists()
        if claimed:
            emit_pr_metrics_cooldown_task(
                pull_request_id=self.pull_request.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

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
        # Suppress the real enqueue; _run_scheduled_cooldown drives the task instead.
        with patch(f"{MODULE}.emit_pr_metrics_cooldown_task.apply_async"):
            handle_emission(
                github_event=GithubWebhookType.PULL_REQUEST,
                event={"action": action, "pull_request": self._payload()},
                organization=self.organization,
                repo=self.repo,
            )
        self._run_scheduled_cooldown()

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
        assert row.diagnosis_labels is None

    def _add_check_suite(self, *, conclusion: str, webhook_id: str) -> None:
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id=webhook_id,
            event_type=PullRequestActivityType.CHECK_SUITE_COMPLETED,
            payload={"conclusion": conclusion, "app_slug": "github-actions", "check_runs_count": 1},
        )

    @patch("sentry.analytics.record")
    def test_closed_unmerged_with_failing_ci_sets_diagnosis_label(
        self, mock_record: MagicMock
    ) -> None:
        self._add_check_suite(conclusion="failure", webhook_id="check-1")
        self._call(merged=False)
        row = mock_record.call_args_list[-1].args[0]
        assert row.verdict == "closed_unmerged"
        assert row.diagnosis_labels == ["ci_failing_at_close"]

    @patch("sentry.analytics.record")
    def test_closed_unmerged_with_passing_ci_has_no_diagnosis_label(
        self, mock_record: MagicMock
    ) -> None:
        self._add_check_suite(conclusion="success", webhook_id="check-1")
        self._call(merged=False)
        row = mock_record.call_args_list[-1].args[0]
        assert row.verdict == "closed_unmerged"
        assert row.diagnosis_labels is None

    @patch("sentry.analytics.record")
    def test_merged_with_failing_ci_has_no_diagnosis_label(self, mock_record: MagicMock) -> None:
        # The deterministic CI-failure label is scoped to CLOSED_UNMERGED; a clean
        # merge never carries it even if a check suite failed along the way.
        self._add_check_suite(conclusion="failure", webhook_id="check-1")
        self._call(merged=True)
        row = mock_record.call_args_list[-1].args[0]
        assert row.verdict == "merged_unchanged"
        assert row.diagnosis_labels is None

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
        # a judge. With pr-metrics-judge off (this class), the forward is skipped
        # and no verdict is set.
        self._add_synchronize()
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None

    @patch("sentry.analytics.record")
    def test_recreates_missing_metrics_row_when_claiming_cooldown(
        self, mock_record: MagicMock
    ) -> None:
        # The cooldown claim get_or_creates the metrics row, so a missing row (e.g.
        # handle_metrics failed) is recreated at claim time rather than deferred as a
        # judge case. The deferred task then settles on the present (empty) row — a
        # clean merge still resolves to merged_unchanged.
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).delete()
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_unchanged"
        )

    @patch("sentry.analytics.record")
    def test_ignores_non_terminal_actions(self, mock_record: MagicMock) -> None:
        self._call(action="opened")
        self._call(action="synchronize")
        self._call(action="labeled")
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
    def test_emits_without_seer_access(self, mock_record: MagicMock) -> None:
        # Seer access is no longer required for activity tracking, so the
        # commits-after-open signal is present regardless — a clean merge can
        # still resolve to merged_unchanged without Seer access.
        with self.feature({"organizations:gen-ai-features": False}):
            self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert (
            PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict
            == "merged_unchanged"
        )

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
        # With pr-metrics-judge off, a judge-needed PR writes no verdict, so every
        # redelivery re-evaluates to "needs judge" and skips — never emitting here.
        self._add_synchronize()
        self._call(merged=True)
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch(f"{MODULE}.logger")
    @patch("sentry.analytics.record")
    def test_missing_pr_logs_unresolved_and_does_not_emit(
        self, mock_record: MagicMock, mock_logger: MagicMock
    ) -> None:
        # A close webhook can arrive before the PR row exists (race).
        handle_emission(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": "closed", "pull_request": {"number": 9999, "merged": True}},
            organization=self.organization,
            repo=self.repo,
        )
        mock_logger.info.assert_called_once_with(
            "pr_metrics.pull_request.unresolved",
            extra={
                "github_event": GithubWebhookType.PULL_REQUEST,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "repo_name": self.repo.name,
                "pr_number": 9999,
                "github_delivery_id": None,
                "reason": "missing_opened_at",
            },
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0


@with_feature("organizations:pr-metrics-emit")
@with_feature(["organizations:pr-metrics-activity", "organizations:gen-ai-features"])
@cell_silo_test
class HandleWebhookForPrMetricsCooldownTest(TestCase):
    """The webhook-side scheduling of deferred emission and its cooldown claim."""

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
        PullRequestMetrics.objects.create(pull_request=self.pull_request, additions=1)
        self.pull_request.update(
            head_commit_sha=HEAD_SHA,
            opened_at=OPENED_AT,
            closed_at=CLOSED_AT,
            merged_at=CLOSED_AT,
            merge_commit_sha=MERGE_SHA,
            draft=False,
        )

    def _handle(self) -> None:
        handle_emission(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": "closed", "pull_request": {"number": 42}},
            organization=self.organization,
            repo=self.repo,
        )

    def _verdict(self) -> str | None:
        return PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict

    @patch("sentry.analytics.record")
    @patch(f"{MODULE}.emit_pr_metrics_cooldown_task.apply_async")
    def test_claims_cooldown_and_schedules_task(
        self, mock_apply_async: MagicMock, mock_record: MagicMock
    ) -> None:
        self._handle()

        assert self._verdict() == "waiting_event_cooldown"
        mock_apply_async.assert_called_once_with(
            kwargs={
                "pull_request_id": self.pull_request.id,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
            },
            countdown=3600,
        )
        # Nothing is emitted synchronously — the deferred task does that.
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch(f"{MODULE}.emit_pr_metrics_cooldown_task.apply_async")
    def test_redelivery_during_cooldown_schedules_once(self, mock_apply_async: MagicMock) -> None:
        self._handle()
        self._handle()
        # The second delivery finds the row already claimed and no-ops.
        assert mock_apply_async.call_count == 1

    @patch(f"{MODULE}.emit_pr_metrics_cooldown_task.apply_async")
    def test_untracked_pr_does_not_schedule(self, mock_apply_async: MagicMock) -> None:
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).delete()
        self._handle()
        assert mock_apply_async.call_count == 0
        assert self._verdict() is None

    @patch(f"{MODULE}.emit_pr_metrics_cooldown_task.apply_async")
    def test_enqueue_failure_releases_cooldown(self, mock_apply_async: MagicMock) -> None:
        # If the claim commits but the enqueue fails, the sentinel is released so a
        # redelivery can reschedule rather than the PR sticking in cooldown.
        mock_apply_async.side_effect = RuntimeError("broker down")
        self._handle()
        assert self._verdict() is None

    @patch("sentry.analytics.record")
    @patch(f"{MODULE}.emit_pr_metrics_cooldown_task.apply_async")
    def test_reopened_during_cooldown_releases_and_does_not_emit(
        self, mock_apply_async: MagicMock, mock_record: MagicMock
    ) -> None:
        self._handle()
        assert self._verdict() == "waiting_event_cooldown"

        # Reopened before the window elapsed: the PR is no longer terminal.
        self.pull_request.update(closed_at=None, merged_at=None)
        emit_pr_metrics_cooldown_task(
            pull_request_id=self.pull_request.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        assert self._verdict() is None
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch("sentry.analytics.record")
    @patch(f"{MODULE}.emit_pr_metrics_cooldown_task.apply_async")
    def test_deferred_task_emits_after_window(
        self, mock_apply_async: MagicMock, mock_record: MagicMock
    ) -> None:
        self._handle()
        emit_pr_metrics_cooldown_task(
            pull_request_id=self.pull_request.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert self._verdict() == "merged_unchanged"

    @patch("sentry.analytics.record")
    def test_task_drops_when_pull_request_gone(self, mock_record: MagicMock) -> None:
        # The lookup is scoped by (id, organization_id, repository_id) together, so
        # a real PR whose repository_id no longer matches (e.g. re-parented between
        # enqueue and run) is indistinguishable from one that vanished outright —
        # both raise PullRequest.DoesNotExist on this compound filter. No PR, no
        # PullRequestMetrics row to release: the sentinel is left untouched rather
        # than guessed at from pull_request_id alone.
        self.pull_request.metrics.update(verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN)

        emit_pr_metrics_cooldown_task(
            pull_request_id=self.pull_request.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id + 999,
        )

        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0
        assert self._verdict() == "waiting_event_cooldown"

    @patch("sentry.analytics.record")
    def test_task_drops_when_organization_gone(self, mock_record: MagicMock) -> None:
        # The PR lookup is itself scoped by organization_id, so to reach the
        # Organization lookup (rather than failing the PR lookup first), the PR's
        # own organization_id must point at the now-missing org.
        missing_organization_id = self.organization.id + 999
        self.pull_request.update(organization_id=missing_organization_id)
        self.pull_request.metrics.update(verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN)

        emit_pr_metrics_cooldown_task(
            pull_request_id=self.pull_request.id,
            organization_id=missing_organization_id,
            repository_id=self.repo.id,
        )

        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0
        assert self._verdict() is None


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

    def test_singular_assignee_key_counts_as_assigned(self) -> None:
        # GitHub uses "assignees" (list) on most events but "assignee" (object) on
        # assigned/unassigned events — both should mark the PR as assigned.
        self._call(assignee={"login": "octocat"})

        metrics = PullRequestMetrics.objects.get(pull_request=self.pull_request)
        assert metrics.is_assigned is True

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
        auto_merge: dict[str, Any] | None = None,
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
            "auto_merge": auto_merge,
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

    def test_synchronize_writes_synchronized_activity(self) -> None:
        self._call(action="synchronize", before="old-sha", after="new-sha")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.SYNCHRONIZED
        assert activity.payload["before_sha"] == "old-sha"
        assert activity.payload["after_sha"] == "new-sha"

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
            ("synchronize", {"webhook_id": "d-sync", "before": "old", "after": "new"}),
        ]:
            self._call(action=action, **kw)  # type: ignore[arg-type]
            activity = PullRequestActivity.objects.get(
                pull_request=self.pr, webhook_id=kw.get("webhook_id", "delivery-1")
            )
            assert "title" not in activity.payload
            assert "body" not in activity.payload

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

    # --- sender_type in opened payload ---

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

    # --- Merge-intent signals ---

    def test_auto_merge_enabled_writes_activity_with_method(self) -> None:
        self._call(action="auto_merge_enabled", auto_merge={"merge_method": "squash"})

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.AUTO_MERGE_ENABLED
        assert activity.payload["merge_method"] == "squash"

    def test_auto_merge_disabled_writes_activity(self) -> None:
        self._call(action="auto_merge_disabled", auto_merge=None)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.AUTO_MERGE_DISABLED

    def test_enqueued_writes_activity(self) -> None:
        self._call(action="enqueued")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.ENQUEUED

    def test_dequeued_writes_activity_with_reason(self) -> None:
        self._call(action="dequeued", extra_event={"reason": "MERGE_CONFLICT"})

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.DEQUEUED
        assert activity.payload["reason"] == "MERGE_CONFLICT"

    def test_closed_unmerged_writes_closed_activity_with_sender(self) -> None:
        self._call(action="closed", merged=False)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.CLOSED
        assert activity.payload["sender_login"] == "testuser"
        assert activity.payload["sender_type"] == "User"

    def test_closed_merged_writes_merged_activity_with_sender(self) -> None:
        self._call(action="closed", merged=True)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.MERGED
        assert activity.payload["sender_login"] == "testuser"
        assert activity.payload["sender_type"] == "User"

    def test_terminal_event_written_despite_terminal_state(self) -> None:
        # The close/merge webhook stamps the terminal state before this runs, so
        # the terminal row (recording the closer) must still be written even though
        # the PR's state already reads terminal.
        self.pr.state = PullRequestLifecycleState.MERGED
        self.pr.save()

        self._call(action="closed", merged=True)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.MERGED

    def test_terminal_pr_activity_stops_once_verdict_claimed(self) -> None:
        # Not short-circuiting CLOSED/MERGED means a stray later event could be
        # recorded; the verdict gate bounds that once the PR is settled.
        self.pr.state = PullRequestLifecycleState.MERGED
        self.pr.save()
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="merged_unchanged")

        self._call(action="synchronize", before="a", after="b")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    # --- Unhandled actions ---

    def test_unhandled_actions_do_not_write_activity(self) -> None:
        for action in ("milestoned", "demilestoned", "locked", "unlocked"):
            self._call(action=action, webhook_id=f"delivery-{action}")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_activity_written_without_seer_access(self) -> None:
        with self.feature({"organizations:gen-ai-features": False}):
            self._call(action="opened")

        assert PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_verdict_claimed_skips_activity(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="merged_unchanged")

        self._call(action="opened")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_judge_in_progress_verdict_skips_activity(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="judge_in_progress")

        self._call(action="synchronize", before="abc", after="def")

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

    def test_comment_edited_skipped(self) -> None:
        self._call(action="edited", webhook_id="delivery-edit")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

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

    def test_unknown_pr_number_logs_unresolved_and_does_not_raise(self) -> None:
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

        mock_logger.info.assert_called_once_with(
            "pr_metrics.pull_request.unresolved",
            extra={
                "github_event": GithubWebhookType.ISSUE_COMMENT,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "repo_name": self.repo.name,
                "pr_number": 9999,
                "github_delivery_id": "delivery-unknown",
                "reason": "missing_opened_at",
            },
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

    def test_comment_written_without_seer_access(self) -> None:
        with self.feature({"organizations:gen-ai-features": False}):
            self._call()

        assert PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_recent_missing_pr_creates_stub_and_writes_activity(self) -> None:
        # A comment can be delivered before the PR's `opened` webhook writes the
        # row (race). For a recently-opened PR we stub the row so the activity is
        # not dropped; the `pull_request` event later enriches it.
        event: dict[str, Any] = {
            "action": "created",
            "issue": {
                "number": 9999,
                "title": "Racing PR",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "pull_request": {"url": "https://github.com/org/repo/pull/9999"},
            },
            "sender": {"id": 123, "login": "testuser", "type": "User"},
            "comment": {"id": 1, "author_association": "NONE"},
        }
        handle_comment(
            github_event=GithubWebhookType.ISSUE_COMMENT,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id="delivery-race",
        )

        pr = PullRequest.objects.get(repository_id=self.repo.id, key="9999")
        assert pr.title == "Racing PR"
        assert pr.opened_at is not None
        activity = PullRequestActivity.objects.get(pull_request=pr)
        assert activity.event_type == PullRequestActivityType.COMMENT_CREATED
        assert activity.webhook_id == "delivery-race"

    def test_old_missing_pr_is_not_stubbed(self) -> None:
        # A comment on a PR opened before our ingestion window: no `opened` event
        # will arrive to enrich a stub, so we skip it rather than track a partial.
        # Reported as `predates_ingestion` — a known-but-old timestamp, distinct from
        # the `missing_opened_at` miss of a payload with no parseable timestamp.
        event: dict[str, Any] = {
            "action": "created",
            "issue": {
                "number": 9999,
                "title": "Old PR",
                "created_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(),
                "pull_request": {"url": "https://github.com/org/repo/pull/9999"},
            },
            "sender": {"id": 123, "login": "testuser", "type": "User"},
            "comment": {"id": 1, "author_association": "NONE"},
        }
        with patch(f"{MODULE}.logger") as mock_logger:
            handle_comment(
                github_event=GithubWebhookType.ISSUE_COMMENT,
                event=event,
                organization=self.organization,
                repo=self.repo,
                github_delivery_id="delivery-old",
            )

        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="9999").exists()
        assert mock_logger.info.call_args.kwargs["extra"]["reason"] == "predates_ingestion"

    def test_verdict_claimed_skips_comment(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="merged_unchanged")

        self._call()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()


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

    def test_dismissed_writes_review_dismissed_activity(self) -> None:
        # GitHub reports the dismissed review's state as "dismissed"; the review_id
        # is what lets the judge correlate back to the earlier submitted row.
        self._call(action="dismissed", review_state="dismissed", review_id=100)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.REVIEW_DISMISSED
        assert activity.payload["review_id"] == 100
        assert activity.payload["sender_login"] == "reviewer"

    def test_unhandled_review_action_skipped(self) -> None:
        self._call(action="edited")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_flag_off_skips_review(self) -> None:
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_no_activity_without_webhook_id(self) -> None:
        self._call(webhook_id=None)

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_unknown_pr_number_logs_unresolved_and_does_not_raise(self) -> None:
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

        mock_logger.info.assert_called_once_with(
            "pr_metrics.pull_request.unresolved",
            extra={
                "github_event": GithubWebhookType.PULL_REQUEST_REVIEW,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "repo_name": self.repo.name,
                "pr_number": 9999,
                "github_delivery_id": "delivery-x",
                "reason": "missing_opened_at",
            },
        )
        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_review_written_without_seer_access(self) -> None:
        with self.feature({"organizations:gen-ai-features": False}):
            self._call()

        assert PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_verdict_claimed_skips_review(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="merged_unchanged")

        self._call()

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

    def test_edited_skipped(self) -> None:
        self._call(action="edited", webhook_id="delivery-edit")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

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

    def test_unknown_pr_number_logs_unresolved_and_does_not_raise(self) -> None:
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

        mock_logger.info.assert_called_once_with(
            "pr_metrics.pull_request.unresolved",
            extra={
                "github_event": GithubWebhookType.PULL_REQUEST_REVIEW_COMMENT,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "repo_name": self.repo.name,
                "pr_number": 9999,
                "github_delivery_id": "delivery-x",
                "reason": "missing_opened_at",
            },
        )
        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_review_comment_written_without_seer_access(self) -> None:
        with self.feature({"organizations:gen-ai-features": False}):
            self._call()

        assert PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_verdict_claimed_skips_review_comment(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="merged_unchanged")

        self._call()

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

    def test_unknown_pr_number_logs_unresolved_and_does_not_raise(self) -> None:
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

        mock_logger.info.assert_called_once_with(
            "pr_metrics.pull_request.unresolved",
            extra={
                "github_event": GithubWebhookType.PULL_REQUEST_REVIEW_THREAD,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "repo_name": self.repo.name,
                "pr_number": 9999,
                "github_delivery_id": "delivery-x",
                "reason": "missing_opened_at",
            },
        )
        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_thread_event_written_without_seer_access(self) -> None:
        with self.feature({"organizations:gen-ai-features": False}):
            self._call()

        assert PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_verdict_claimed_skips_thread_event(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="merged_unchanged")

        self._call()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()


@with_feature("organizations:pr-metrics-activity")
@cell_silo_test
class HandleCheckEventsForPrMetricsTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(self.project, provider="integrations:github", external_id="99")
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
        )

    def _pull_request_refs(
        self,
        pr_numbers: tuple[int, ...],
        foreign_pr_numbers: tuple[int, ...] = (),
    ) -> list[dict[str, Any]]:
        """Build a check payload's ``pull_requests`` array.

        Same-repo entries carry this repo's id as ``base.repo.id``. Foreign
        entries (a PR that lives in another repo but merges this repo's branch —
        e.g. a fork syncing from upstream) carry a different ``base.repo.id`` and
        must be skipped by the handler.
        """
        same = [
            {"number": n, "base": {"repo": {"id": int(self.repo.external_id)}}} for n in pr_numbers
        ]
        foreign = [{"number": n, "base": {"repo": {"id": 999999}}} for n in foreign_pr_numbers]
        return same + foreign

    def _call_suite(
        self,
        action: str = "completed",
        conclusion: str = "success",
        head_sha: str = "headsha1",
        app_slug: str = "github-actions",
        check_runs_count: int = 4,
        pr_numbers: tuple[int, ...] = (42,),
        foreign_pr_numbers: tuple[int, ...] = (),
        webhook_id: str | None = "delivery-1",
    ) -> None:
        event: dict[str, Any] = {
            "action": action,
            "check_suite": {
                "head_sha": head_sha,
                "status": "completed",
                "conclusion": conclusion,
                "app": {"slug": app_slug},
                "latest_check_runs_count": check_runs_count,
                "pull_requests": self._pull_request_refs(pr_numbers, foreign_pr_numbers),
            },
            "sender": {"id": 5, "login": "ci-bot", "type": "Bot"},
        }
        handle_check_suite(
            github_event=GithubWebhookType.CHECK_SUITE,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    def _call_run(
        self,
        action: str = "completed",
        conclusion: str = "failure",
        check_name: str = "build",
        head_sha: str = "headsha1",
        app_slug: str = "github-actions",
        pr_numbers: tuple[int, ...] = (42,),
        foreign_pr_numbers: tuple[int, ...] = (),
        webhook_id: str | None = "delivery-1",
    ) -> None:
        event: dict[str, Any] = {
            "action": action,
            "check_run": {
                "name": check_name,
                "head_sha": head_sha,
                "status": "completed",
                "conclusion": conclusion,
                "app": {"slug": app_slug},
                "pull_requests": self._pull_request_refs(pr_numbers, foreign_pr_numbers),
            },
            "sender": {"id": 5, "login": "ci-bot", "type": "Bot"},
        }
        handle_check_run(
            github_event=GithubWebhookType.CHECK_RUN,
            event=event,
            organization=self.organization,
            repo=self.repo,
            github_delivery_id=webhook_id,
        )

    # --- check_suite ---

    def test_check_suite_completed_writes_activity(self) -> None:
        self._call_suite(conclusion="success", app_slug="github-actions", check_runs_count=6)

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.CHECK_SUITE_COMPLETED
        assert activity.webhook_id == "delivery-1"
        assert activity.payload["conclusion"] == "success"
        assert activity.payload["app_slug"] == "github-actions"
        assert activity.payload["check_runs_count"] == 6

    def test_check_suite_non_completed_action_skipped(self) -> None:
        for action in ("requested", "rerequested"):
            self._call_suite(action=action, webhook_id=f"delivery-{action}")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_suite_writes_row_per_referenced_pr(self) -> None:
        other_pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="77",
        )
        self._call_suite(pr_numbers=(42, 77))

        assert PullRequestActivity.objects.filter(pull_request=self.pr).count() == 1
        assert PullRequestActivity.objects.filter(pull_request=other_pr).count() == 1

    def test_check_suite_duplicate_pr_numbers_deduped(self) -> None:
        self._call_suite(pr_numbers=(42, 42))

        assert PullRequestActivity.objects.filter(pull_request=self.pr).count() == 1

    def test_check_suite_without_prs_writes_nothing(self) -> None:
        self._call_suite(pr_numbers=())

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_suite_missing_pr_creates_stub_and_writes_activity(self) -> None:
        # A check can be delivered before the PR's `opened` event writes the row.
        # Check payloads carry no PR timestamp, so we stub on a `now` proxy (rather
        # than drop the CI status) — the same out-of-order race the stub exists for.
        self._call_suite(pr_numbers=(9999,))

        pr = PullRequest.objects.get(repository_id=self.repo.id, key="9999")
        assert pr.opened_at is not None
        activity = PullRequestActivity.objects.get(pull_request=pr)
        assert activity.event_type == PullRequestActivityType.CHECK_SUITE_COMPLETED

    def test_check_suite_skips_pull_request_from_other_repo(self) -> None:
        # GitHub lists a PR on our check when their heads match (head_sha +
        # head_branch). A PR that merges this repo's default branch into another
        # repo (head here, base elsewhere — e.g. a fork syncing from upstream)
        # rides along on every default-branch check, but its number belongs to the
        # other repo. It must not resolve against ours, even when the number
        # collides with one of our PRs (here, key "42").
        self._call_suite(pr_numbers=(), foreign_pr_numbers=(42,))

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_suite_resolves_only_same_repo_pull_requests(self) -> None:
        self._call_suite(pr_numbers=(42,), foreign_pr_numbers=(77,))

        assert PullRequestActivity.objects.filter(pull_request=self.pr).count() == 1
        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="77").exists()

    def test_check_suite_no_activity_without_webhook_id(self) -> None:
        self._call_suite(webhook_id=None)

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_suite_redelivery_deduplicated(self) -> None:
        self._call_suite(webhook_id="delivery-dup")
        self._call_suite(webhook_id="delivery-dup")

        assert PullRequestActivity.objects.filter(pull_request=self.pr).count() == 1

    def test_check_suite_flag_off_skips(self) -> None:
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call_suite()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_suite_written_without_seer_access(self) -> None:
        with self.feature({"organizations:gen-ai-features": False}):
            self._call_suite()

        assert PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    # --- check_run ---

    def test_check_run_completed_writes_activity(self) -> None:
        self._call_run(conclusion="failure", check_name="lint", app_slug="github-actions")

        activity = PullRequestActivity.objects.get(pull_request=self.pr)
        assert activity.event_type == PullRequestActivityType.CHECK_RUN_COMPLETED
        assert activity.payload["check_name"] == "lint"
        assert activity.payload["conclusion"] == "failure"
        assert activity.payload["app_slug"] == "github-actions"

    def test_check_run_non_completed_action_skipped(self) -> None:
        for action in ("created", "rerequested", "requested_action"):
            self._call_run(action=action, webhook_id=f"delivery-{action}")

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_run_without_prs_writes_nothing(self) -> None:
        self._call_run(pr_numbers=())

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_run_skips_pull_request_from_other_repo(self) -> None:
        self._call_run(pr_numbers=(), foreign_pr_numbers=(42,))

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_run_flag_off_skips(self) -> None:
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call_run()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_suite_verdict_claimed_skips(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="closed_unmerged")

        self._call_suite()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_suite_cooldown_verdict_allows_late_check(self) -> None:
        PullRequestMetrics.objects.create(
            pull_request=self.pr,
            verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN,
        )

        self._call_suite()

        assert PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_run_verdict_claimed_skips(self) -> None:
        PullRequestMetrics.objects.create(pull_request=self.pr, verdict="closed_unmerged")

        self._call_run()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_run_cooldown_verdict_allows_late_check(self) -> None:
        PullRequestMetrics.objects.create(
            pull_request=self.pr,
            verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN,
        )

        self._call_run()

        assert PullRequestActivity.objects.filter(pull_request=self.pr).exists()

    def test_check_suite_judge_in_progress_skips(self) -> None:
        PullRequestMetrics.objects.create(
            pull_request=self.pr,
            verdict=PullRequestVerdict.JUDGE_IN_PROGRESS,
        )

        self._call_suite()

        assert not PullRequestActivity.objects.filter(pull_request=self.pr).exists()


@with_feature("organizations:pr-metrics-emit")
@with_feature("organizations:pr-metrics-activity")
@with_feature(["organizations:pr-metrics-judge", "organizations:gen-ai-features"])
@cell_silo_test
class HandleWebhookForPrMetricsJudgeForwardTest(TestCase):
    """The needs-judge branch with pr-metrics-judge on: claim the sentinel and forward."""

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
        # A merge with a later commit can't be settled deterministically, so the
        # emission path defers it to a judge.
        PullRequestMetrics.objects.create(pull_request=self.pull_request, additions=1)
        PullRequestActivity.objects.create(
            pull_request=self.pull_request,
            webhook_id="sync-1",
            event_type=PullRequestActivityType.SYNCHRONIZED,
            payload={},
        )

    def _run_scheduled_cooldown(self) -> None:
        # Emission is deferred: handle_emission only claims WAITING_EVENT_COOLDOWN and
        # schedules the cooldown task, which is where the judge fork now runs. Drive
        # that task as it would fire after the window, but only when the claim was won.
        claimed = PullRequestMetrics.objects.filter(
            pull_request=self.pull_request,
            verdict=PullRequestVerdict.WAITING_EVENT_COOLDOWN,
        ).exists()
        if claimed:
            emit_pr_metrics_cooldown_task(
                pull_request_id=self.pull_request.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

    def _call(self) -> None:
        self.pull_request.update(
            head_commit_sha=HEAD_SHA,
            opened_at=OPENED_AT,
            closed_at=CLOSED_AT,
            merged_at=CLOSED_AT,
            merge_commit_sha=MERGE_SHA,
            draft=False,
        )
        # Suppress the real enqueue; _run_scheduled_cooldown drives the task instead.
        with patch(f"{MODULE}.emit_pr_metrics_cooldown_task.apply_async"):
            handle_emission(
                github_event=GithubWebhookType.PULL_REQUEST,
                event={"action": "closed", "pull_request": {"number": 42}},
                organization=self.organization,
                repo=self.repo,
            )
        self._run_scheduled_cooldown()

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_claims_sentinel_and_enqueues_forward(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._call()
        # No row is emitted from the webhook; Seer's callback emits it later.
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "judge_in_progress"
        )
        mock_delay.assert_called_once_with(
            pull_request_id=self.pull_request.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_redelivery_forwards_only_once(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._call()
        self._call()
        # The sentinel claim coalesces the redelivery, so Seer is forwarded to once.
        assert mock_delay.call_count == 1

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_forwards_when_metrics_row_missing(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        # A missing metrics row is recreated when the cooldown is claimed; the
        # deferred task then still forwards (the later commit makes the merge
        # non-deterministic regardless of the freshly-created row).
        PullRequestMetrics.objects.filter(pull_request=self.pull_request).delete()
        self._call()
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "judge_in_progress"
        )
        mock_delay.assert_called_once()

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_enqueue_failure_releases_claim_for_retry(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        # If the claim commits but the task enqueue fails, the sentinel is released
        # so the PR doesn't stick in judge_in_progress with no task to settle it.
        mock_delay.side_effect = RuntimeError("broker down")
        self._call()
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None

        # A later webhook redelivery can then re-forward.
        mock_delay.side_effect = None
        self._call()
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "judge_in_progress"
        )
        assert mock_delay.call_count == 2

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_untracked_pr_is_not_forwarded(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        # The tracking gate runs before the judge fork: an untracked PR is dropped
        # without claiming the sentinel or forwarding.
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).delete()
        self._call()
        assert mock_delay.call_count == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_no_seer_access_skips_judge(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        # Without Seer access the judge path is not eligible regardless of attribution.
        with self.feature({"organizations:gen-ai-features": False}):
            self._call()
        assert mock_delay.call_count == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_ineligible_attribution_emits_merged_with_iteration(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        # Only SENTRY_APP and SEER_DELEGATED_* attributions qualify for the judge.
        # A PR tracked only via MCP or REFERENCED_ISSUE settles locally instead of
        # being dropped: merged with a later commit becomes MERGED_WITH_ITERATION,
        # the same label the judge would use, even though no judge looked at it.
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).update(
            signal_type=PullRequestAttributionSignalType.MCP
        )
        self._call()
        assert mock_delay.call_count == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_with_iteration"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_ineligible_attribution_emits_without_seer_access(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        # The fallback never talks to Seer, so an org's Seer-access consent gate
        # (gen-ai-features / hide_ai_features) must not block it — only the actual
        # forward-to-Seer branch, reached for judge-eligible attribution, needs it.
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).update(
            signal_type=PullRequestAttributionSignalType.MCP
        )
        with self.feature({"organizations:gen-ai-features": False}):
            self._call()
        assert mock_delay.call_count == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict == (
            "merged_with_iteration"
        )
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_ineligible_attribution_redelivery_emits_once(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        # The same NULL-verdict claim that guards the deterministic path also
        # guards the fallback emit, so a redelivered close/merge settles once.
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).update(
            signal_type=PullRequestAttributionSignalType.MCP
        )
        self._call()
        self._call()
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch(f"{MODULE}.forward_pr_to_seer_task.delay")
    @patch("sentry.analytics.record")
    def test_ineligible_attribution_stays_unemitted_when_indeterminate(
        self, mock_record: MagicMock, mock_delay: MagicMock
    ) -> None:
        # Without activity tracking, select_verdict can't tell whether push
        # activity happened at all (INDETERMINATE), not just that it's genuinely
        # ambiguous (NEEDS_JUDGE). The fallback only trusts the latter, so an
        # ineligible-attribution PR here is left unemitted, same as before the
        # fallback existed — guessing would risk mislabeling an iterated PR as
        # unchanged.
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).update(
            signal_type=PullRequestAttributionSignalType.MCP
        )
        with self.feature({"organizations:pr-metrics-activity": False}):
            self._call()
        assert mock_delay.call_count == 0
        assert PullRequestMetrics.objects.get(pull_request=self.pull_request).verdict is None
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0


MATCH_RPC = "sentry.pr_metrics.webhooks.make_match_coding_agent_pr_request"


@with_feature(["organizations:pr-metrics-attribution", "organizations:gen-ai-features"])
@cell_silo_test
class HandleDelegatedAgentDetectionTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(
            self.project, name="org/repo", provider="integrations:github", external_id="99"
        )
        self.pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="42",
        )
        self.group = self.create_group(project=self.project)
        GroupLink.objects.create(
            group=self.group,
            project=self.project,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            linked_id=self.pr.id,
        )

    def _call(
        self,
        *,
        action: str = "opened",
        login: str = "a-human",
        user_id: int = 999,
        head_ref: str = "feature/x",
        head_sha: str = "headsha123",
        number: int = 42,
        html_url: str = "https://github.com/org/repo/pull/42",
    ) -> None:
        payload: dict[str, Any] = {
            "number": number,
            "user": {"id": user_id, "login": login},
            "head": {"ref": head_ref, "sha": head_sha},
            "html_url": html_url,
        }
        handle_attribution(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": action, "pull_request": payload},
            organization=self.organization,
            repo=self.repo,
        )

    def _mock_seer(self, status: int = 202, body: dict[str, Any] | None = None) -> Any:
        mock_response = MagicMock()
        mock_response.status = status
        mock_response.data = orjson.dumps(body) if body is not None else b""
        return patch(MATCH_RPC, return_value=mock_response)

    def _mock_org_check(self) -> Any:
        return patch(f"{MODULE}.org_has_coding_agent_for_provider", return_value=True)

    def _candidate_outcome(self, mock_incr: MagicMock) -> dict[str, str] | None:
        """The tags of the single ``delegated_agent.candidate`` funnel emission."""
        calls = [
            c
            for c in mock_incr.call_args_list
            if c.args and c.args[0] == "pr_metrics.delegated_agent.candidate"
        ]
        assert len(calls) == 1
        return calls[0].kwargs.get("tags")

    # --- Candidate detection calls Seer ---

    def test_claude_branch_prefix_sends_to_seer(self) -> None:
        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(head_ref="claude/fix-the-bug")

        mock_rpc.assert_called_once()
        body = mock_rpc.call_args.args[0]
        assert body.provider == "claude_code"
        assert body.head_branch == "claude/fix-the-bug"
        assert body.organization_id == self.organization.id
        assert body.pull_request_id == self.pr.id
        assert body.group_ids == [self.group.id]
        assert body.repo.provider == "integrations:github"
        assert body.repo.external_id == "99"

    def test_copilot_branch_prefix_sends_to_seer(self) -> None:
        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(head_ref="copilot/fix-the-bug")

        mock_rpc.assert_called_once()
        assert mock_rpc.call_args.args[0].provider == "github_copilot"

    def test_copilot_author_login_sends_to_seer(self) -> None:
        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(login="copilot-swe-agent[bot]", head_ref="some-branch")

        mock_rpc.assert_called_once()
        assert mock_rpc.call_args.args[0].provider == "github_copilot"

    def test_branch_prefix_takes_precedence_over_author(self) -> None:
        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(login="copilot-swe-agent[bot]", head_ref="claude/fix")

        mock_rpc.assert_called_once()
        assert mock_rpc.call_args.args[0].provider == "claude_code"

    def test_sent_metric_incremented_on_success(self) -> None:
        with (
            self._mock_org_check(),
            self._mock_seer(status=202),
            patch(f"{MODULE}.metrics.incr") as mock_incr,
        ):
            self._call(head_ref="claude/fix")

        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "sent",
        }

    # --- Synchronous match (200) ---

    def test_sync_match_records_attribution_in_process(self) -> None:
        body = {
            "run_id": 123,
            "agent_id": "agent-1",
            "signal_type": PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE.value,
            "match_path": "some/path",
        }
        with (
            self._mock_org_check(),
            self._mock_seer(status=200, body=body),
            patch(f"{MODULE}.metrics.incr") as mock_incr,
        ):
            self._call(head_ref="claude/fix")

        attribution = PullRequestAttribution.objects.get(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
            source=PullRequestAttributionSource.SEER_DATA,
        )
        assert attribution.signal_details == {
            "agent_id": "agent-1",
            "pr_url": "https://github.com/org/repo/pull/42",
            "run_id": 123,
        }
        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "sync_matched",
        }

    def test_sync_match_bad_body_records_error_outcome(self) -> None:
        with (
            self._mock_org_check(),
            self._mock_seer(status=200, body={"not": "a match"}),
            patch(f"{MODULE}.metrics.incr") as mock_incr,
        ):
            self._call(head_ref="claude/fix")

        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "seer_error_bad_body",
        }
        assert not PullRequestAttribution.objects.filter(
            pull_request=self.pr, source=PullRequestAttributionSource.SEER_DATA
        ).exists()

    def test_sync_match_bad_signal_type_records_error_outcome(self) -> None:
        body = {
            "run_id": 123,
            "agent_id": "agent-1",
            "signal_type": "not_a_real_signal_type",
            "match_path": "some/path",
        }
        with (
            self._mock_org_check(),
            self._mock_seer(status=200, body=body),
            patch(f"{MODULE}.metrics.incr") as mock_incr,
        ):
            self._call(head_ref="claude/fix")

        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "seer_error_bad_body",
        }

    def test_sync_match_idempotent_across_open_then_close(self) -> None:
        # Re-checked on close, like the SENTRY_APP case — a PR matched on open
        # must not gain a second attribution row when re-matched on close.
        body = {
            "run_id": 123,
            "agent_id": "agent-1",
            "signal_type": PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE.value,
            "match_path": "some/path",
        }
        with self._mock_org_check(), self._mock_seer(status=200, body=body):
            self._call(action="opened", head_ref="claude/fix")
            self._call(action="closed", head_ref="claude/fix")

        assert (
            PullRequestAttribution.objects.filter(
                pull_request=self.pr,
                signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
                source=PullRequestAttributionSource.SEER_DATA,
            ).count()
            == 1
        )

    # --- Error handling ---

    def test_seer_non_2xx_logs_warning_and_error_metric(self) -> None:
        with (
            self._mock_org_check(),
            self._mock_seer(status=500),
            patch(f"{MODULE}.metrics.incr") as mock_incr,
        ):
            self._call(head_ref="claude/fix")

        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "seer_error_bad_status",
        }

    def test_seer_exception_logs_warning_and_error_metric(self) -> None:
        with (
            self._mock_org_check(),
            patch(MATCH_RPC, side_effect=Exception("network error")),
            patch(f"{MODULE}.metrics.incr") as mock_incr,
        ):
            self._call(head_ref="claude/fix")

        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "seer_error_exception",
        }

    def test_seer_exception_does_not_propagate(self) -> None:
        with self._mock_org_check(), patch(MATCH_RPC, side_effect=Exception("network error")):
            self._call(head_ref="claude/fix")  # must not raise

    # --- Non-candidates do not call Seer ---

    def test_non_candidate_branch_and_author_does_not_call_seer(self) -> None:
        with self._mock_seer() as mock_rpc:
            self._call(login="a-human", head_ref="feature/x")

        mock_rpc.assert_not_called()

    def test_non_opened_or_closed_action_does_not_call_seer(self) -> None:
        for action in ("synchronize", "labeled", "assigned"):
            with self._mock_seer() as mock_rpc:
                self._call(action=action, head_ref="claude/fix")
                mock_rpc.assert_not_called()

    def test_closed_action_sends_to_seer(self) -> None:
        # Re-checked on close, mirroring the SENTRY_APP author attribution — an
        # out-of-order or missed "opened" webhook shouldn't lose the match.
        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(action="closed", head_ref="claude/fix")

        mock_rpc.assert_called_once()
        assert mock_rpc.call_args.args[0].provider == "claude_code"

    # --- Gating ---

    def test_attribution_flag_off_does_not_call_seer(self) -> None:
        with self._mock_seer() as mock_rpc:
            with self.feature({"organizations:pr-metrics-attribution": False}):
                self._call(head_ref="claude/fix")

        mock_rpc.assert_not_called()

    def test_no_matching_integration_does_not_call_seer(self) -> None:
        with patch(f"{MODULE}.org_has_coding_agent_for_provider", return_value=False):
            with self._mock_seer() as mock_rpc:
                self._call(head_ref="claude/fix")

        mock_rpc.assert_not_called()

    def test_missing_pr_does_not_call_seer(self) -> None:
        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(head_ref="claude/fix", number=9999)

        mock_rpc.assert_not_called()

    def test_no_linked_groups_does_not_call_seer(self) -> None:
        GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=self.pr.id,
        ).delete()

        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(head_ref="claude/fix")

        mock_rpc.assert_not_called()

    def test_repo_missing_provider_does_not_call_seer(self) -> None:
        self.repo.provider = None
        self.repo.save()

        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(head_ref="claude/fix")

        mock_rpc.assert_not_called()

    def test_repo_missing_external_id_does_not_call_seer(self) -> None:
        self.repo.external_id = None
        self.repo.save()

        with self._mock_org_check(), self._mock_seer() as mock_rpc:
            self._call(head_ref="claude/fix")

        mock_rpc.assert_not_called()

    def test_repo_name_without_slash_does_not_call_seer(self) -> None:
        self.repo.name = "repowithoutseparator"
        self.repo.save()

        with self._mock_seer() as mock_rpc:
            self._call(head_ref="claude/fix")

        mock_rpc.assert_not_called()

    # --- Funnel drop-off metrics ---
    #
    # Each stage that drops a PR before the Seer match used to return silently;
    # these lock in the ``delegated_agent.candidate`` outcome it now records.

    def test_app_authored_non_candidate_records_no_provider_hint(self) -> None:
        # Claude opens PRs as the Sentry app with no ``claude/`` branch here, so
        # there's no hint — the load-bearing blind spot. Only app-authored PRs
        # are counted, keyed as provider "unknown".
        with patch(f"{MODULE}.metrics.incr") as mock_incr:
            self._call(
                user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID,
                head_ref="feature/x",
            )

        assert self._candidate_outcome(mock_incr) == {
            "provider": "unknown",
            "outcome": "no_provider_hint",
        }

    def test_human_non_candidate_records_nothing(self) -> None:
        # An ordinary human PR with no hint must not enter the funnel at all,
        # else the metric drowns in non-agent PRs.
        with patch(f"{MODULE}.metrics.incr") as mock_incr:
            self._call(user_id=999, login="a-human", head_ref="feature/x")

        assert not any(
            c.args and c.args[0] == "pr_metrics.delegated_agent.candidate"
            for c in mock_incr.call_args_list
        )

    def test_no_org_integration_records_outcome(self) -> None:
        with (
            patch(f"{MODULE}.org_has_coding_agent_for_provider", return_value=False),
            patch(f"{MODULE}.metrics.incr") as mock_incr,
        ):
            self._call(head_ref="claude/fix")

        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "no_org_integration",
        }

    def test_no_linked_groups_records_outcome(self) -> None:
        GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=self.pr.id,
        ).delete()

        with self._mock_org_check(), patch(f"{MODULE}.metrics.incr") as mock_incr:
            self._call(head_ref="claude/fix")

        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "no_group_ids",
        }

    def test_bad_repo_name_records_outcome(self) -> None:
        self.repo.name = "repowithoutseparator"
        self.repo.save()

        with self._mock_org_check(), patch(f"{MODULE}.metrics.incr") as mock_incr:
            self._call(head_ref="claude/fix")

        assert self._candidate_outcome(mock_incr) == {
            "provider": "claude_code",
            "outcome": "bad_repo",
        }

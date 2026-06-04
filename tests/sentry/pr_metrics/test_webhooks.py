from __future__ import annotations

from unittest.mock import patch

from django.conf import settings
from django.utils import timezone

from sentry.analytics.events.pr_metrics_events import PrCloseMetricsEvent
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.pr_metrics.webhooks import handle_attribution, handle_emission
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.analytics import get_event_count
from sentry.testutils.silo import cell_silo_test


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
        self.base_pr_payload: dict = {
            "number": 42,
            "title": "Fix the bug",
            "body": "Closes TICKET-1",
        }

    def _call(
        self,
        action: str = "opened",
        user_id: int = 999,
        title: str | None = None,
        body: str | None = None,
        changes: dict | None = None,
    ) -> None:
        payload = dict(self.base_pr_payload)
        payload["user"] = {"id": user_id, "login": "testbot"}
        if title is not None:
            payload["title"] = title
        if body is not None:
            payload["body"] = body
        event: dict = {"action": action, "pull_request": payload}
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
        for action in ("synchronize", "closed", "merged", "labeled", "assigned"):
            self._call(action=action, user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()

    # --- Idempotency and redelivery ---

    def test_idempotent_on_repeated_webhooks(self) -> None:
        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)
        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        assert PullRequestAttribution.objects.filter(pull_request=self.pr).count() == 1

    def test_redelivery_with_new_group_updates_signal_details(self) -> None:
        group1 = self.create_group(project=self.project)
        url1 = f"http://testserver/issues/{group1.id}"
        self._call(body=f"Fixes {url1}")

        group2 = self.create_group(project=self.project)
        url2 = f"http://testserver/issues/{group2.id}"
        self._call(body=f"Fixes {url1} and also Fixes {url2}")

        attr = PullRequestAttribution.objects.get(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
        )
        assert attr.signal_details is not None
        assert set(attr.signal_details["group_ids"]) == {group1.id, group2.id}
        assert attr.is_valid is True

    def test_redelivery_revives_invalidated_signal(self) -> None:
        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)
        PullRequestAttribution.objects.filter(pull_request=self.pr).update(is_valid=False)

        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        attr = PullRequestAttribution.objects.get(pull_request=self.pr)
        assert attr.is_valid is True

    # --- Referenced issue attribution ---

    def test_referenced_issue_via_url(self) -> None:
        group = self.create_group(project=self.project)
        url = f"http://testserver/issues/{group.id}"

        self._call(body=f"Fixes {url}")

        attr = PullRequestAttribution.objects.get(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
        )
        assert attr.source == PullRequestAttributionSource.WEBHOOK_DATA
        assert attr.signal_details == {"group_ids": [group.id]}

    def test_referenced_issue_group_ids_are_sorted(self) -> None:
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        url1 = f"http://testserver/issues/{group1.id}"
        url2 = f"http://testserver/issues/{group2.id}"

        self._call(body=f"Fixes {url1} and also Fixes {url2}")

        attr = PullRequestAttribution.objects.get(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
        )
        assert attr.signal_details is not None
        stored_ids = attr.signal_details["group_ids"]
        assert stored_ids == sorted(stored_ids)
        assert set(stored_ids) == {group1.id, group2.id}

    def test_no_issue_reference_no_referenced_issue_attribution(self) -> None:
        self._call(title="Refactor internals", body="No issues here.")

        assert not PullRequestAttribution.objects.filter(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
        ).exists()

    def test_seer_app_and_referenced_issue_both_written(self) -> None:
        group = self.create_group(project=self.project)
        url = f"http://testserver/issues/{group.id}"

        self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID, body=f"Fixes {url}")

        signal_types = set(
            PullRequestAttribution.objects.filter(pull_request=self.pr).values_list(
                "signal_type", flat=True
            )
        )
        assert signal_types == {
            PullRequestAttributionSignalType.SENTRY_APP,
            PullRequestAttributionSignalType.REFERENCED_ISSUE,
        }

    # --- reopened / edited refresh ---

    def test_reopened_refreshes_referenced_issue_attribution(self) -> None:
        group = self.create_group(project=self.project)
        url = f"http://testserver/issues/{group.id}"
        self._call(body=f"Fixes {url}")

        group2 = self.create_group(project=self.project)
        url2 = f"http://testserver/issues/{group2.id}"
        self._call(action="reopened", body=f"Fixes {url} and Fixes {url2}")

        attr = PullRequestAttribution.objects.get(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
        )
        assert attr.signal_details is not None
        assert set(attr.signal_details["group_ids"]) == {group.id, group2.id}
        assert attr.is_valid is True

    def test_edited_with_body_change_refreshes_referenced_issue_attribution(self) -> None:
        group = self.create_group(project=self.project)
        url = f"http://testserver/issues/{group.id}"
        self._call(body=f"Fixes {url}")

        group2 = self.create_group(project=self.project)
        url2 = f"http://testserver/issues/{group2.id}"
        self._call(
            action="edited",
            body=f"Fixes {url} and Fixes {url2}",
            changes={"body": {"from": f"Fixes {url}"}},
        )

        attr = PullRequestAttribution.objects.get(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
        )
        assert attr.signal_details is not None
        assert set(attr.signal_details["group_ids"]) == {group.id, group2.id}

    def test_edited_without_description_change_skips_refresh(self) -> None:
        group = self.create_group(project=self.project)
        url = f"http://testserver/issues/{group.id}"
        self._call(body=f"Fixes {url}")

        # edited but only labels changed — no body/title in changes
        self._call(action="edited", changes={"label": {"name": "bug"}})

        assert PullRequestAttribution.objects.filter(pull_request=self.pr).count() == 1

    def test_edited_removes_issue_reference_invalidates_attribution(self) -> None:
        group = self.create_group(project=self.project)
        url = f"http://testserver/issues/{group.id}"
        self._call(body=f"Fixes {url}")

        self._call(
            action="edited",
            body="No issue reference anymore.",
            changes={"body": {"from": f"Fixes {url}"}},
        )

        attr = PullRequestAttribution.objects.get(
            pull_request=self.pr,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
        )
        assert attr.is_valid is False

    # --- Feature flag ---

    def test_feature_flag_off_skips_attribution(self) -> None:
        with self.feature({"organizations:pr-metrics-attribution": False}):
            self._call(user_id=settings.SEER_AUTOFIX_GITHUB_APP_USER_ID)

        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()

    # --- Error handling ---

    def test_missing_pr_logs_warning_and_does_not_raise(self) -> None:
        module = "sentry.pr_metrics.webhooks"
        event = {
            "action": "opened",
            "pull_request": {
                "number": 9999,
                "title": "",
                "body": "",
                "user": {"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
            },
        }
        with patch(f"{module}.logger") as mock_logger:
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


MODULE = "sentry.pr_metrics.webhooks"
HEAD_SHA = "a" * 40
MERGE_SHA = "b" * 40


@with_feature("organizations:pr-metrics-emit")
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

    def _payload(self, *, merged: bool = True) -> dict:
        return {
            "number": 42,
            "merged": merged,
            "merge_commit_sha": MERGE_SHA,
            "head": {"sha": HEAD_SHA},
        }

    def _call(self, *, action: str = "closed", merged: bool = True) -> None:
        handle_emission(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": action, "pull_request": self._payload(merged=merged)},
            organization=self.organization,
            repo=self.repo,
        )

    @patch("sentry.analytics.record")
    def test_emits_on_merge(self, mock_record) -> None:
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert mock_record.call_args_list[-1].args[0].close_action == "merged"

    @patch("sentry.analytics.record")
    def test_emits_on_close_unmerged(self, mock_record) -> None:
        self._call(merged=False)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1
        assert mock_record.call_args_list[-1].args[0].close_action == "closed"

    @patch(f"{MODULE}.needs_judge", return_value=True)
    @patch("sentry.analytics.record")
    def test_falls_back_to_immediate_emit_when_judge_needed(
        self, mock_record, _needs_judge
    ) -> None:
        # Until the judge path is wired, a judge-needed PR still emits immediately.
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_ignores_non_terminal_actions(self, mock_record) -> None:
        self._call(action="opened")
        self._call(action="edited")
        self._call(action="synchronize")
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch("sentry.analytics.record")
    def test_does_nothing_when_flag_off(self, mock_record) -> None:
        with self.feature({"organizations:pr-metrics-emit": False}):
            self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch("sentry.analytics.record")
    def test_skips_untracked_pr(self, mock_record) -> None:
        PullRequestAttribution.objects.filter(pull_request=self.pull_request).delete()
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch("sentry.analytics.record")
    def test_redelivery_dropped_after_first_terminal_event(self, mock_record) -> None:
        # The DB-side guard claims the PR's terminal transition on the first
        # close/merge; a redelivered webhook finds it already closed and is
        # dropped before emit.
        self._call(merged=True)
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch(f"{MODULE}.needs_judge", return_value=True)
    @patch("sentry.analytics.record")
    def test_redelivery_dropped_before_judge_fork(self, mock_record, _needs_judge) -> None:
        # The guard sits *before* the needs_judge() fork, so a redelivery never
        # re-launches the (pricey) judge path either — the whole point of the
        # guard landing before the judge path is wired.
        self._call(merged=True)
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 1

    @patch("sentry.analytics.record")
    def test_records_merge_lifecycle_state(self, mock_record) -> None:
        handle_emission(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={
                "action": "closed",
                "pull_request": {
                    "number": 42,
                    "merged": True,
                    "merge_commit_sha": MERGE_SHA,
                    "head": {"sha": HEAD_SHA},
                    "closed_at": "2024-01-02T03:04:05Z",
                    "merged_at": "2024-01-02T03:04:05Z",
                },
            },
            organization=self.organization,
            repo=self.repo,
        )
        self.pull_request.refresh_from_db()
        assert self.pull_request.state == "merged"
        assert self.pull_request.closed_at is not None
        assert self.pull_request.merged_at is not None

    @patch("sentry.analytics.record")
    def test_records_closed_unmerged_lifecycle_state(self, mock_record) -> None:
        self._call(merged=False)
        self.pull_request.refresh_from_db()
        assert self.pull_request.state == "closed"
        assert self.pull_request.closed_at is not None
        # An unmerged close leaves merged_at null.
        assert self.pull_request.merged_at is None

    @patch("sentry.analytics.record")
    def test_already_closed_pr_is_dropped(self, mock_record) -> None:
        # A PR whose terminal event was recorded before this webhook arrives
        # (e.g. a much-delayed redelivery) is dropped: closed_at is already set.
        self.pull_request.update(closed_at=timezone.now(), state="closed")
        self._call(merged=True)
        assert get_event_count(mock_record, PrCloseMetricsEvent) == 0

    @patch(f"{MODULE}.logger")
    @patch("sentry.analytics.record")
    def test_missing_pr_logs_warning_and_does_not_emit(self, mock_record, mock_logger) -> None:
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

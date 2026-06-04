from __future__ import annotations

from unittest.mock import patch

from django.conf import settings

from sentry.integrations.github.pr_metrics_webhook_processors import (
    handle_webhook_for_pr_metrics,
)
from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
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
        if title is not None:
            payload["title"] = title
        if body is not None:
            payload["body"] = body
        event: dict = {"action": action, "pull_request": payload}
        if changes is not None:
            event["changes"] = changes
        handle_webhook_for_pr_metrics(
            organization=self.organization,
            action=action,
            pull_request=payload,
            github_user={"id": user_id, "login": "testbot"},
            repository_id=self.repo.id,
            event=event,
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
        module = "sentry.integrations.github.pr_metrics_webhook_processors"
        with patch(f"{module}.logger") as mock_logger:
            handle_webhook_for_pr_metrics(
                organization=self.organization,
                action="opened",
                pull_request={"number": 9999, "title": "", "body": ""},
                github_user={"id": settings.SEER_AUTOFIX_GITHUB_APP_USER_ID},
                repository_id=self.repo.id,
                event={"action": "opened"},
            )

        mock_logger.warning.assert_called_once_with(
            "github.pr_metrics.attribution.pr_not_found",
            extra={"repository_id": self.repo.id, "pr_number": 9999},
        )
        assert not PullRequestAttribution.objects.filter(pull_request=self.pr).exists()

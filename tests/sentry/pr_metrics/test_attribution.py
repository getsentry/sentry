from typing import Any
from unittest.mock import Mock, patch

from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.pr_metrics.attribution import (
    attribute_seer_created_pull_requests,
    recompute_pull_request_attribution,
    record_attribution_signal,
    record_referenced_issue_signal,
)
from sentry.pr_metrics.types import ReferencedIssueWebhookKey
from sentry.testutils.cases import TestCase

REPO_NAME = "getsentry/sentry"


def _warning_events(mock_logger: Mock) -> list[str]:
    return [call.args[0] for call in mock_logger.warning.call_args_list]


class AttributeSeerCreatedPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")

    def _payload(
        self,
        pr_number: int = 42,
        pr_url: str = "https://github.com/getsentry/sentry/pull/42",
        provider: str = "github",
    ) -> list[dict[str, Any]]:
        return [
            {
                "provider": provider,
                "repo_name": REPO_NAME,
                "pull_request": {"pr_id": 999, "pr_number": pr_number, "pr_url": pr_url},
            }
        ]

    def _attribute(
        self, pull_requests: list[dict[str, Any]], *, organization: Organization | None = None
    ) -> None:
        attribute_seer_created_pull_requests(
            organization=organization or self.organization,
            pull_requests=pull_requests,
            run_id=123,
            group_id=self.group.id,
        )

    def test_creates_pull_request_and_sentry_app_attribution(self) -> None:
        self._attribute(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert pull_request.organization_id == self.organization.id

        attribution = PullRequestAttribution.objects.get(pull_request=pull_request)
        assert attribution.signal_type == PullRequestAttributionSignalType.SENTRY_APP
        assert attribution.source == PullRequestAttributionSource.SEER_DATA
        assert attribution.is_valid is True
        assert attribution.signal_details == {
            "run_id": 123,
            "group_id": self.group.id,
            "pr_url": "https://github.com/getsentry/sentry/pull/42",
        }

    def test_is_idempotent_on_redelivery(self) -> None:
        self._attribute(self._payload())
        self._attribute(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").count() == 1
        assert PullRequestAttribution.objects.filter(pull_request=pull_request).count() == 1

    def test_reuses_existing_pull_request(self) -> None:
        existing = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
            title="Pre-existing from SCM webhook",
        )

        self._attribute(self._payload())

        existing.refresh_from_db()
        # The find-or-create must not clobber fields set by the SCM webhook.
        assert existing.title == "Pre-existing from SCM webhook"
        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").count() == 1
        assert PullRequestAttribution.objects.filter(pull_request=existing).count() == 1

    def test_skips_and_warns_when_repository_not_found(self) -> None:
        with patch("sentry.pr_metrics.attribution.logger") as mock_logger:
            self._attribute(
                [
                    {
                        "provider": "github",
                        "repo_name": "getsentry/does-not-exist",
                        "pull_request": {"pr_id": 1, "pr_number": 7, "pr_url": "https://x/7"},
                    }
                ]
            )

        assert not PullRequest.objects.filter(repository_id=self.repo.id).exists()
        assert not PullRequestAttribution.objects.exists()
        assert "seer.pr_attribution.repo_not_found" in _warning_events(mock_logger)

    def test_skips_other_orgs_repository(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(other_project, name=REPO_NAME, provider="integrations:github")

        self._attribute(self._payload(), organization=other_org)

        # Resolved against the other org's repo, never this org's same-named repo.
        assert not PullRequest.objects.filter(repository_id=self.repo.id).exists()
        assert PullRequest.objects.filter(repository_id=other_repo.id).exists()

    def test_resolves_by_provider_when_name_collides(self) -> None:
        gitlab_repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:gitlab")

        self._attribute(self._payload(provider="github"))

        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()
        assert not PullRequest.objects.filter(repository_id=gitlab_repo.id).exists()

    def test_resolves_unknown_provider_when_unambiguous(self) -> None:
        self._attribute(self._payload(provider="unknown"))

        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()

    def test_treats_uppercase_unknown_as_sentinel(self) -> None:
        with patch("sentry.pr_metrics.attribution.logger") as mock_logger:
            self._attribute(self._payload(provider="UNKNOWN"))

        # "UNKNOWN" must be treated as the unknown sentinel, not a real provider:
        # the single same-named repo resolves and no unrecognized warning fires.
        assert PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()
        assert "seer.pr_attribution.unrecognized_provider" not in _warning_events(mock_logger)

    def test_skips_unknown_provider_when_ambiguous(self) -> None:
        self.create_repo(self.project, name=REPO_NAME, provider="integrations:gitlab")

        with patch("sentry.pr_metrics.attribution.logger") as mock_logger:
            self._attribute(self._payload(provider="unknown"))

        # Two same-named repos under different providers — refuse to guess, warn.
        assert not PullRequest.objects.exists()
        assert not PullRequestAttribution.objects.exists()
        assert "seer.pr_attribution.repo_ambiguous" in _warning_events(mock_logger)

    def test_warns_on_unrecognized_provider(self) -> None:
        with patch("sentry.pr_metrics.attribution.logger") as mock_logger:
            self._attribute(self._payload(provider="subversion"))

        # An unmapped provider is flagged so it can be fixed upstream in Seer.
        assert "seer.pr_attribution.unrecognized_provider" in _warning_events(mock_logger)

    def test_one_entry_failure_does_not_drop_the_batch(self) -> None:
        payload = self._payload(pr_number=1) + self._payload(pr_number=2)

        with (
            patch(
                "sentry.pr_metrics.attribution.record_attribution_signal",
                side_effect=[RuntimeError("boom"), None],
            ) as mock_record,
            patch("sentry.pr_metrics.attribution.logger") as mock_logger,
        ):
            self._attribute(payload)

        # The second entry is still attempted after the first one raises.
        assert mock_record.call_count == 2
        exception_events = [call.args[0] for call in mock_logger.exception.call_args_list]
        assert "seer.pr_attribution.record_failed" in exception_events

    def test_skips_entries_missing_fields(self) -> None:
        self._attribute(
            [
                {"provider": "unknown", "pull_request": {"pr_number": 1}},  # no repo_name
                {"provider": "unknown", "repo_name": REPO_NAME, "pull_request": {}},  # no pr_number
            ]
        )

        assert not PullRequestAttribution.objects.exists()


class RecordAttributionSignalTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME)
        self.pull_request = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
        )

    def _record_seer_signal(self, **kwargs: Any) -> PullRequestAttribution:
        return record_attribution_signal(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            **kwargs,
        )

    def test_updates_details_on_redelivery(self) -> None:
        first = self._record_seer_signal(
            signal_details={"run_id": 1, "group_id": 2, "pr_url": "https://x/1"}
        )
        second = self._record_seer_signal(
            signal_details={"run_id": 1, "group_id": 2, "pr_url": "https://x/2"}
        )

        assert first.id == second.id
        second.refresh_from_db()
        assert second.signal_details is not None
        assert second.signal_details["pr_url"] == "https://x/2"

    def test_revives_invalidated_signal(self) -> None:
        attribution = self._record_seer_signal()
        attribution.update(is_valid=False)

        self._record_seer_signal()

        attribution.refresh_from_db()
        assert attribution.is_valid is True


class RecomputePullRequestAttributionTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME)
        self.pull_request = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
        )

    def _add(self, signal_type: str, is_valid: bool = True) -> None:
        PullRequestAttribution.objects.create(
            pull_request=self.pull_request,
            signal_type=signal_type,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            is_valid=is_valid,
        )

    def test_returns_none_without_signals(self) -> None:
        assert recompute_pull_request_attribution(self.pull_request) is None

    def test_picks_highest_confidence_signal(self) -> None:
        self._add(PullRequestAttributionSignalType.REFERENCED_ISSUE)
        self._add(PullRequestAttributionSignalType.SENTRY_APP)
        self._add(PullRequestAttributionSignalType.MCP)

        assert (
            recompute_pull_request_attribution(self.pull_request)
            == PullRequestAttributionSignalType.SENTRY_APP
        )

    def test_ignores_invalid_signals(self) -> None:
        self._add(PullRequestAttributionSignalType.SENTRY_APP, is_valid=False)
        self._add(PullRequestAttributionSignalType.REFERENCED_ISSUE)

        assert (
            recompute_pull_request_attribution(self.pull_request)
            == PullRequestAttributionSignalType.REFERENCED_ISSUE
        )


class RecordReferencedIssueSignalTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME)
        self.pull_request = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key="42",
        )

    def _get_attr(self) -> PullRequestAttribution:
        return PullRequestAttribution.objects.get(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
        )

    # --- Flat key path ---

    def test_flat_key_first_valid_write_creates_row(self) -> None:
        result = record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[1, 2],
        )

        assert result is not None
        attr = self._get_attr()
        assert attr.signal_details == {"pr_body": [1, 2]}
        assert attr.is_valid is True

    def test_flat_key_empty_group_ids_on_first_write_returns_none(self) -> None:
        result = record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[],
        )

        assert result is None
        assert not PullRequestAttribution.objects.filter(pull_request=self.pull_request).exists()

    def test_flat_key_subsequent_write_replaces_key(self) -> None:
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[1, 2],
        )
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[3, 4],
        )

        attr = self._get_attr()
        assert attr.signal_details == {"pr_body": [3, 4]}

    def test_replace_false_on_first_write_creates_row_from_new_ids(self) -> None:
        # No existing row — replace=False should still create the row using the new IDs.
        result = record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PUSH,
            group_ids=[1, 2],
            replace=False,
        )

        assert result is not None
        attr = self._get_attr()
        assert attr.signal_details == {"push": [1, 2]}

    def test_replace_false_unions_ids_with_existing(self) -> None:
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PUSH,
            group_ids=[1, 2],
        )
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PUSH,
            group_ids=[3],
            replace=False,
        )

        attr = self._get_attr()
        assert attr.signal_details == {"push": [1, 2, 3]}

    def test_replace_false_with_empty_ids_preserves_existing(self) -> None:
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PUSH,
            group_ids=[1],
        )
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PUSH,
            group_ids=[],
            replace=False,
        )

        attr = self._get_attr()
        assert attr.signal_details == {"push": [1]}
        assert attr.is_valid is True

    def test_flat_key_clearing_last_key_sets_is_valid_false(self) -> None:
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[1],
        )
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[],
        )

        attr = self._get_attr()
        assert attr.is_valid is False

    def test_flat_key_clearing_one_key_while_another_still_has_ids_leaves_is_valid_true(
        self,
    ) -> None:
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[1],
        )
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PUSH,
            group_ids=[2],
        )
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[],
        )

        attr = self._get_attr()
        assert attr.is_valid is True
        assert attr.signal_details is not None
        assert attr.signal_details.get("push") == [2]

    def test_flat_key_cleared_key_absent_from_stored_signal_details(self) -> None:
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[1],
        )
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PUSH,
            group_ids=[2],
        )
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PR_BODY,
            group_ids=[],
        )

        attr = self._get_attr()
        # Empty keys are pruned on write — cleared pr_body should be absent.
        assert attr.signal_details == {"push": [2]}
        assert "pr_body" not in attr.signal_details

    # --- Legacy format migration ---

    def test_legacy_format_promoted_on_next_write(self) -> None:
        # Seed an existing row using the approved helper to avoid direct Model.objects.create.
        record_attribution_signal(
            pull_request=self.pull_request,
            signal_type=PullRequestAttributionSignalType.REFERENCED_ISSUE,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
            signal_details={"group_ids": [1, 2]},
        )

        # Now trigger a new write — the legacy format should be promoted.
        record_referenced_issue_signal(
            pull_request=self.pull_request,
            webhook_key=ReferencedIssueWebhookKey.PUSH,
            group_ids=[3],
        )

        attr = self._get_attr()
        assert attr.signal_details is not None
        # Legacy group_ids becomes pr_body; new key is merged in.
        assert attr.signal_details.get("pr_body") == [1, 2]
        assert attr.signal_details.get("push") == [3]
        assert "group_ids" not in attr.signal_details

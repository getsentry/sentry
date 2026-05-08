from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from scm.types import (
    CreatePullRequestReactionProtocol,
    ProviderName,
    PullRequestAction,
    PullRequestBranch,
    PullRequestEventData,
)

from sentry.models.repositorysettings import CodeReviewSettings, CodeReviewTrigger
from sentry.scm.types import PullRequestEvent, SubscriptionEventSentryMeta
from sentry.seer.code_review.metrics import WebhookFilteredReason
from sentry.seer.code_review.preflight import PreflightDenialReason
from sentry.seer.code_review.webhooks.scm_listeners import handle_pull_request_via_scm_stream
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode

REPO_EXTERNAL_ID = "12345"
GITLAB_HOST = "gitlab.com"


class HandlePullRequestViaScmStreamTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id=f"{GITLAB_HOST}:test-namespace",
            provider="gitlab",
            metadata={"domain_name": GITLAB_HOST},
        )
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:gitlab",
            external_id=f"{GITLAB_HOST}:{REPO_EXTERNAL_ID}",
            integration_id=self.integration.id,
        )
        self.sentry_meta: list[SubscriptionEventSentryMeta] = [
            {
                "id": None,
                "integration_id": self.integration.id,
                "organization_id": self.organization.id,
            }
        ]

    def _make_event(
        self,
        action: PullRequestAction = "opened",
        provider: ProviderName = "gitlab",
        draft: bool = False,
        head: PullRequestBranch | None = None,
        # **pr_overrides: Any,
    ) -> PullRequestEvent:
        pull_request: PullRequestEventData = {
            "repository_id": REPO_EXTERNAL_ID,
            "id": "42",
            "title": "Test PR",
            "description": "Test description",
            "head": head or {"ref": "feature", "sha": "abc123"},
            "base": {"ref": "main", "sha": None},
            "is_private_repo": False,
            "author": {"id": "100", "username": "testuser"},
            "draft": draft,
        }
        return PullRequestEvent(
            action=action,
            pull_request=pull_request,
            subscription_event={
                "event": "{}",
                "event_type_hint": "Merge Request Hook",
                "extra": {},
                "received_at": 1700000000,
                "sentry_meta": self.sentry_meta,
                "type": provider,
            },
        )

    def _handle(self, event: PullRequestEvent) -> None:
        """Run in MONOLITH so both Integration and Organization queries succeed."""
        with assume_test_silo_mode(SiloMode.MONOLITH):
            handle_pull_request_via_scm_stream(event)

    @pytest.fixture(autouse=True)
    def _mock_dependencies(self) -> Generator[None]:
        """Mocks for preflight, SCM factory, and the Seer scheduling task."""
        with (
            patch(
                "sentry.seer.code_review.webhooks.scm_listeners.CodeReviewPreflightService"
            ) as mock_preflight_cls,
            patch("sentry.seer.code_review.webhooks.scm_listeners.make_scm") as mock_make_scm,
            patch("sentry.seer.code_review.webhooks.task.schedule_scm_task") as mock_schedule,
        ):
            preflight_result = MagicMock()
            preflight_result.allowed = True
            preflight_result.denial_reason = None
            preflight_result.settings = CodeReviewSettings(
                enabled=True,
                triggers=[
                    CodeReviewTrigger.ON_READY_FOR_REVIEW,
                    CodeReviewTrigger.ON_NEW_COMMIT,
                ],
            )
            mock_preflight_cls.return_value.check.return_value = preflight_result
            mock_make_scm.return_value = MagicMock(spec=CreatePullRequestReactionProtocol)
            self.mock_preflight_cls = mock_preflight_cls
            self.mock_preflight_result = preflight_result
            self.mock_make_scm = mock_make_scm
            self.mock_schedule = mock_schedule
            yield

    # Temporary provider gating

    def test_skips_when_provider_is_github(self) -> None:
        """GitHub events return early — they go through the legacy handler path."""
        self._handle(self._make_event(provider="github"))

        self.mock_preflight_cls.assert_not_called()
        self.mock_make_scm.assert_not_called()
        self.mock_schedule.assert_not_called()

    # Preflight

    @patch("sentry.seer.code_review.webhooks.scm_listeners.record_scm_webhook_filtered")
    def test_records_filter_metric_when_preflight_denies_with_reason(
        self, mock_record: MagicMock
    ) -> None:
        self.mock_preflight_result.allowed = False
        self.mock_preflight_result.denial_reason = (
            PreflightDenialReason.ORG_NOT_ELIGIBLE_FOR_CODE_REVIEW
        )

        self._handle(self._make_event())

        mock_record.assert_called_once_with(
            "gitlab",
            "opened",
            PreflightDenialReason.ORG_NOT_ELIGIBLE_FOR_CODE_REVIEW,
        )
        self.mock_make_scm.assert_not_called()
        self.mock_schedule.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.scm_listeners.record_scm_webhook_filtered")
    def test_does_not_record_when_preflight_denies_without_reason(
        self, mock_record: MagicMock
    ) -> None:
        self.mock_preflight_result.allowed = False
        self.mock_preflight_result.denial_reason = None

        self._handle(self._make_event())

        mock_record.assert_not_called()
        self.mock_schedule.assert_not_called()

    # Action filtering

    @patch("sentry.seer.code_review.webhooks.scm_listeners.record_scm_webhook_filtered")
    def test_filters_unsupported_action(self, mock_record: MagicMock) -> None:
        self._handle(self._make_event(action="edited"))

        mock_record.assert_called_once_with(
            "gitlab", "edited", WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        self.mock_schedule.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.scm_listeners.record_scm_webhook_filtered")
    def test_filters_opened_when_ready_for_review_trigger_disabled(
        self, mock_record: MagicMock
    ) -> None:
        self.mock_preflight_result.settings = CodeReviewSettings(
            enabled=True, triggers=[CodeReviewTrigger.ON_NEW_COMMIT]
        )

        self._handle(self._make_event(action="opened"))

        mock_record.assert_called_once_with(
            "gitlab", "opened", WebhookFilteredReason.TRIGGER_DISABLED
        )
        self.mock_schedule.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.scm_listeners.record_scm_webhook_filtered")
    def test_filters_synchronize_when_new_commit_trigger_disabled(
        self, mock_record: MagicMock
    ) -> None:
        self.mock_preflight_result.settings = CodeReviewSettings(
            enabled=True, triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW]
        )

        self._handle(self._make_event(action="synchronize"))

        mock_record.assert_called_once_with(
            "gitlab", "synchronize", WebhookFilteredReason.TRIGGER_DISABLED
        )
        self.mock_schedule.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.scm_listeners.record_scm_webhook_filtered")
    def test_filters_closed_when_no_triggers_configured(self, mock_record: MagicMock) -> None:
        self.mock_preflight_result.settings = CodeReviewSettings(enabled=True, triggers=[])

        self._handle(self._make_event(action="closed"))

        mock_record.assert_called_once_with(
            "gitlab", "closed", WebhookFilteredReason.TRIGGER_DISABLED
        )
        self.mock_schedule.assert_not_called()

    def test_processes_closed_when_at_least_one_trigger_configured(self) -> None:
        self.mock_preflight_result.settings = CodeReviewSettings(
            enabled=True, triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW]
        )

        self._handle(self._make_event(action="closed"))

        self.mock_schedule.assert_called_once()

    # Draft handling

    def test_skips_draft_for_non_closed_action(self) -> None:
        self._handle(self._make_event(action="opened", draft=True))

        self.mock_make_scm.assert_not_called()
        self.mock_schedule.assert_not_called()

    def test_closed_draft_still_processes(self) -> None:
        self.mock_preflight_result.settings = CodeReviewSettings(
            enabled=True, triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW]
        )

        self._handle(self._make_event(action="closed", draft=True))

        # No reaction for closed events, but Seer is still notified
        self.mock_make_scm.assert_not_called()
        self.mock_schedule.assert_called_once()

    # Eyes reaction

    def test_adds_eyes_reaction_for_opened(self) -> None:
        self._handle(self._make_event(action="opened"))

        self.mock_make_scm.assert_called_once_with(
            self.organization.id, self.repo.id, referrer="seer"
        )
        self.mock_make_scm.return_value.create_pull_request_reaction.assert_called_once_with(
            pull_request_id="42", reaction="eyes"
        )

    def test_adds_eyes_reaction_for_ready_for_review(self) -> None:
        self._handle(self._make_event(action="ready_for_review"))

        self.mock_make_scm.return_value.create_pull_request_reaction.assert_called_once_with(
            pull_request_id="42", reaction="eyes"
        )

    def test_adds_eyes_reaction_for_synchronize(self) -> None:
        self._handle(self._make_event(action="synchronize"))

        self.mock_make_scm.return_value.create_pull_request_reaction.assert_called_once_with(
            pull_request_id="42", reaction="eyes"
        )

    def test_does_not_add_reaction_for_closed(self) -> None:
        self.mock_preflight_result.settings = CodeReviewSettings(
            enabled=True, triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW]
        )

        self._handle(self._make_event(action="closed"))

        self.mock_make_scm.assert_not_called()

    # Seer forwarding

    def test_forwards_to_seer_with_correct_args(self) -> None:
        event = self._make_event(action="opened")

        self._handle(event)

        self.mock_schedule.assert_called_once()
        kwargs = self.mock_schedule.call_args.kwargs
        assert kwargs["pull_request_event"] is event
        assert kwargs["organization"].id == self.organization.id
        assert kwargs["repo"].id == self.repo.id
        assert kwargs["target_commit_sha"] == "abc123"
        tags = kwargs["tags"]
        assert tags["scm_provider"] == "gitlab"
        assert tags["scm_event_action"] == "opened"
        assert tags["sentry_organization_id"] == str(self.organization.id)
        assert tags["sentry_organization_slug"] == self.organization.slug
        assert tags["sentry_integration_id"] == str(self.integration.id)

    def test_skips_when_missing_sha(self) -> None:
        """If the head SHA is unavailable, we cannot ask Seer to review anything."""
        self._handle(self._make_event(action="opened", head={"ref": "feature", "sha": None}))

        self.mock_schedule.assert_not_called()

from unittest import mock

from sentry.models.organizationcontributors import OrganizationContributors
from sentry.scm.types import PullRequestEvent, SubscriptionEvent
from sentry.seer.code_review.scm.handler import handle_pull_request_for_code_review
from sentry.testutils.cases import TestCase


def _make_subscription_event(
    provider: str = "gitlab",
    organization_id: int = 1,
    integration_id: int = 1,
    repository_id: int = 1,
) -> SubscriptionEvent:
    return {
        "event_type_hint": "Merge Request Hook",
        "event": "{}",
        "extra": {"repository_id": repository_id},
        "received_at": 1700000000,
        "sentry_meta": [
            {
                "id": None,
                "integration_id": integration_id,
                "organization_id": organization_id,
            },
        ],
        "type": provider,
    }


def _make_pr_event(
    action: str = "opened",
    provider: str = "gitlab",
    organization_id: int | None = None,
    integration_id: int | None = None,
    repository_id: int | None = None,
    subscription_event: SubscriptionEvent | None = None,
) -> PullRequestEvent:
    if subscription_event is None:
        subscription_event = _make_subscription_event(
            provider=provider,
            organization_id=organization_id or 1,
            integration_id=integration_id or 1,
            repository_id=repository_id or 1,
        )
    return PullRequestEvent(
        action=action,
        pull_request={
            "id": "42",
            "title": "Test MR",
            "description": "A test merge request",
            "head": {"ref": "feature", "sha": "abc123"},
            "base": {"ref": "main", "sha": ""},
            "is_private_repo": True,
            "author": {"id": "100", "username": "testuser"},
        },
        subscription_event=subscription_event,
    )


class TestHandlePullRequestForCodeReview(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="gitlab",
            external_id="gitlab.com:group",
        )
        self.repo = self.create_repo(
            name="group/project",
            provider="integrations:gitlab",
            integration_id=self.integration.id,
            external_id="gitlab.com:123",
        )

    def test_github_events_skipped(self):
        """GitHub events should be skipped — they use their own direct path."""
        event = _make_pr_event(provider="github")
        with mock.patch(
            "sentry.seer.code_review.scm.handler.CodeReviewPreflightService"
        ) as mock_preflight:
            handle_pull_request_for_code_review(event)
            mock_preflight.assert_not_called()

    def test_github_enterprise_events_skipped(self):
        event = _make_pr_event(provider="github_enterprise")
        with mock.patch(
            "sentry.seer.code_review.scm.handler.CodeReviewPreflightService"
        ) as mock_preflight:
            handle_pull_request_for_code_review(event)
            mock_preflight.assert_not_called()

    def test_unsupported_action_skipped(self):
        event = _make_pr_event(action="edited")
        with mock.patch(
            "sentry.seer.code_review.scm.handler.CodeReviewPreflightService"
        ) as mock_preflight:
            handle_pull_request_for_code_review(event)
            mock_preflight.assert_not_called()

    def test_missing_sentry_meta_skipped(self):
        sub_event = _make_subscription_event()
        sub_event["sentry_meta"] = None
        event = _make_pr_event(subscription_event=sub_event)
        with mock.patch(
            "sentry.seer.code_review.scm.handler.CodeReviewPreflightService"
        ) as mock_preflight:
            handle_pull_request_for_code_review(event)
            mock_preflight.assert_not_called()

    @mock.patch("sentry.seer.code_review.scm.handler.features")
    def test_feature_flag_gating(self, mock_features):
        """Without the seer-gitlab-support feature flag, events should be skipped."""
        mock_features.has.return_value = False
        event = _make_pr_event(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            repository_id=self.repo.id,
        )
        with mock.patch(
            "sentry.seer.code_review.scm.handler.CodeReviewPreflightService"
        ) as mock_preflight:
            handle_pull_request_for_code_review(event)
            mock_preflight.assert_not_called()

    @mock.patch("sentry.seer.code_review.scm.handler.features")
    @mock.patch("sentry.seer.code_review.scm.handler.CodeReviewPreflightService")
    def test_preflight_denial_stops_processing(self, mock_preflight_cls, mock_features):
        mock_features.has.return_value = True

        mock_result = mock.MagicMock()
        mock_result.allowed = False
        mock_result.denial_reason = "org_not_eligible_for_code_review"
        mock_preflight_cls.return_value.check.return_value = mock_result

        event = _make_pr_event(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            repository_id=self.repo.id,
        )
        with mock.patch(
            "sentry.seer.code_review.scm.task.schedule_scm_code_review_task"
        ) as mock_schedule:
            handle_pull_request_for_code_review(event)
            mock_schedule.assert_not_called()

    @mock.patch("sentry.seer.code_review.scm.handler.features")
    @mock.patch("sentry.seer.code_review.scm.handler.CodeReviewPreflightService")
    def test_trigger_setting_filtering(self, mock_preflight_cls, mock_features):
        """If opened trigger is not in settings, the event should be skipped."""
        mock_features.has.return_value = True

        mock_settings = mock.MagicMock()
        mock_settings.triggers = []  # No triggers configured

        mock_result = mock.MagicMock()
        mock_result.allowed = True
        mock_result.settings = mock_settings
        mock_preflight_cls.return_value.check.return_value = mock_result

        event = _make_pr_event(
            action="opened",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            repository_id=self.repo.id,
        )
        with mock.patch(
            "sentry.seer.code_review.scm.task.schedule_scm_code_review_task"
        ) as mock_schedule:
            handle_pull_request_for_code_review(event)
            mock_schedule.assert_not_called()

    @mock.patch("sentry.seer.code_review.scm.handler.features")
    @mock.patch("sentry.seer.code_review.scm.handler.CodeReviewPreflightService")
    def test_successful_task_scheduling(self, mock_preflight_cls, mock_features):
        from sentry.models.repositorysettings import CodeReviewTrigger

        mock_features.has.return_value = True

        mock_settings = mock.MagicMock()
        mock_settings.triggers = [
            CodeReviewTrigger.ON_READY_FOR_REVIEW,
            CodeReviewTrigger.ON_NEW_COMMIT,
        ]

        mock_result = mock.MagicMock()
        mock_result.allowed = True
        mock_result.settings = mock_settings
        mock_preflight_cls.return_value.check.return_value = mock_result

        event = _make_pr_event(
            action="opened",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            repository_id=self.repo.id,
        )
        with mock.patch(
            "sentry.seer.code_review.scm.task.schedule_scm_code_review_task"
        ) as mock_schedule:
            handle_pull_request_for_code_review(event)
            mock_schedule.assert_called_once_with(
                event=event,
                organization=mock.ANY,
                repo=mock.ANY,
                integration_id=self.integration.id,
            )

    @mock.patch("sentry.seer.code_review.scm.handler.features")
    @mock.patch("sentry.seer.code_review.scm.handler.CodeReviewPreflightService")
    def test_creates_organization_contributor_as_fallback(self, mock_preflight_cls, mock_features):
        """OrganizationContributors is created as a fallback before preflight runs."""
        mock_features.has.return_value = True

        mock_result = mock.MagicMock()
        mock_result.allowed = False
        mock_result.denial_reason = "some_reason"
        mock_preflight_cls.return_value.check.return_value = mock_result

        event = _make_pr_event(
            action="opened",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            repository_id=self.repo.id,
        )
        handle_pull_request_for_code_review(event)

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="100",
        )
        assert contributor.alias == "testuser"

    @mock.patch("sentry.seer.code_review.scm.handler.features")
    @mock.patch("sentry.seer.code_review.scm.handler.CodeReviewPreflightService")
    def test_does_not_duplicate_existing_contributor(self, mock_preflight_cls, mock_features):
        """If OrganizationContributors already exists, it should not be duplicated."""
        mock_features.has.return_value = True

        mock_result = mock.MagicMock()
        mock_result.allowed = False
        mock_result.denial_reason = "some_reason"
        mock_preflight_cls.return_value.check.return_value = mock_result

        # Pre-create the contributor
        OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="100",
            alias="testuser",
        )

        event = _make_pr_event(
            action="opened",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            repository_id=self.repo.id,
        )
        handle_pull_request_for_code_review(event)

        assert (
            OrganizationContributors.objects.filter(
                organization_id=self.organization.id,
                integration_id=self.integration.id,
                external_identifier="100",
            ).count()
            == 1
        )

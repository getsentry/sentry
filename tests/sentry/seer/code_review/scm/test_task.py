from unittest import mock

from sentry.scm.types import PullRequestEvent, SubscriptionEvent
from sentry.seer.code_review.scm.task import build_seer_v2_payload, schedule_scm_code_review_task
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
    organization_id: int = 1,
    integration_id: int = 1,
    repository_id: int = 1,
) -> PullRequestEvent:
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
        subscription_event=_make_subscription_event(
            provider=provider,
            organization_id=organization_id,
            integration_id=integration_id,
            repository_id=repository_id,
        ),
    )


class TestBuildSeerV2Payload(TestCase):
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

    @mock.patch("sentry.seer.code_review.scm.task.is_org_enabled_for_code_review_experiments")
    def test_opened_event_payload(self, mock_experiments):
        mock_experiments.return_value = False
        event = _make_pr_event(action="opened")
        payload = build_seer_v2_payload(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
            provider="gitlab",
        )
        assert payload is not None
        assert payload["external_owner_id"] == self.repo.external_id

        data = payload["data"]
        assert data["pr_id"] == 42
        assert data["repo"]["provider"] == "gitlab"
        assert data["repo"]["owner"] == "group"
        assert data["repo"]["name"] == "project"
        assert data["repo"]["base_commit_sha"] == "abc123"
        assert data["config"]["trigger"] == "on_ready_for_review"
        assert data["config"]["trigger_user"] == "testuser"
        assert data["config"]["trigger_user_id"] == 100
        assert data["config"]["github_rate_limit_sensitive"] is False
        assert data["experiment_enabled"] is False

    @mock.patch("sentry.seer.code_review.scm.task.is_org_enabled_for_code_review_experiments")
    def test_closed_event_has_no_experiment_flag(self, mock_experiments):
        event = _make_pr_event(action="closed")
        payload = build_seer_v2_payload(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
            provider="gitlab",
        )
        assert payload is not None
        assert "experiment_enabled" not in payload["data"]
        mock_experiments.assert_not_called()

    @mock.patch("sentry.seer.code_review.scm.task.is_org_enabled_for_code_review_experiments")
    def test_synchronize_trigger(self, mock_experiments):
        mock_experiments.return_value = True
        event = _make_pr_event(action="synchronize")
        payload = build_seer_v2_payload(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
            provider="gitlab",
        )
        assert payload is not None
        assert payload["data"]["config"]["trigger"] == "on_new_commit"

    @mock.patch("sentry.seer.code_review.scm.task.is_org_enabled_for_code_review_experiments")
    def test_provider_flows_through_to_payload(self, mock_experiments):
        """The provider string should be passed through to the Seer payload."""
        mock_experiments.return_value = False
        event = _make_pr_event(action="opened")
        payload = build_seer_v2_payload(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
            provider="gitlab",
        )
        assert payload is not None
        assert payload["data"]["repo"]["provider"] == "gitlab"

    @mock.patch("sentry.seer.code_review.scm.task.is_org_enabled_for_code_review_experiments")
    def test_subgroup_repo_name(self, mock_experiments):
        """Repos with subgroups like 'group/subgroup/project' should parse correctly."""
        mock_experiments.return_value = False
        self.repo.name = "group/subgroup/project"
        self.repo.save()

        event = _make_pr_event(action="opened")
        payload = build_seer_v2_payload(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
            provider="gitlab",
        )
        assert payload is not None
        assert payload["data"]["repo"]["owner"] == "group"
        assert payload["data"]["repo"]["name"] == "subgroup/project"


class TestScheduleScmCodeReviewTask(TestCase):
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

    @mock.patch("sentry.seer.code_review.scm.task.process_scm_code_review_event")
    @mock.patch("sentry.seer.code_review.scm.task.is_org_enabled_for_code_review_experiments")
    def test_schedules_task_for_opened(self, mock_experiments, mock_task):
        mock_experiments.return_value = False
        event = _make_pr_event(
            action="opened",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            repository_id=self.repo.id,
        )
        schedule_scm_code_review_task(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
        )
        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args.kwargs
        assert call_kwargs["seer_path"] == "/v2/code_review/review-request"
        assert call_kwargs["scm_provider"] == "gitlab"
        assert call_kwargs["organization_id"] == self.organization.id

    @mock.patch("sentry.seer.code_review.scm.task.process_scm_code_review_event")
    @mock.patch("sentry.seer.code_review.scm.task.is_org_enabled_for_code_review_experiments")
    def test_schedules_task_for_closed(self, mock_experiments, mock_task):
        mock_experiments.return_value = False
        event = _make_pr_event(
            action="closed",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            repository_id=self.repo.id,
        )
        schedule_scm_code_review_task(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
        )
        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args.kwargs
        assert call_kwargs["seer_path"] == "/v2/code_review/pr-closed"


class TestProcessScmCodeReviewEvent(TestCase):
    @mock.patch("sentry.seer.code_review.scm.task.make_seer_request")
    def test_calls_make_seer_request(self, mock_seer_request):
        from sentry.seer.code_review.scm.task import process_scm_code_review_event

        mock_seer_request.return_value = b""
        process_scm_code_review_event(
            seer_path="/v2/code_review/review-request",
            event_payload={"data": {}, "external_owner_id": "123"},
            enqueued_at_str="2024-01-01T00:00:00+00:00",
            scm_provider="gitlab",
            organization_id=1,
        )
        mock_seer_request.assert_called_once()
        call_kwargs = mock_seer_request.call_args.kwargs
        assert call_kwargs["path"] == "/v2/code_review/review-request"

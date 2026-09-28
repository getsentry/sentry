from __future__ import annotations

from collections.abc import Generator
from typing import Any
from unittest.mock import patch

import pytest

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.code_review import review_event
from sentry.integrations.cursor_origin.pull_request import PullRequestLifecycleHandler
from sentry.integrations.cursor_origin.webhook_types import PullRequestEvent
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test

INSTALLATION_ID = "i_01example"
REPO = "acme/rocket"
REPO_EXTERNAL_ID = "r_01example"
USER_ID = "user_01example"
FEATURES = {
    "organizations:gen-ai-features",
    "organizations:code-review-beta",
    "organizations:seer-cursor-origin-support",
}


def _payload(**overrides: Any) -> dict[str, Any]:
    pull_request: dict[str, Any] = {
        "id": "pr_01example",
        "number": "17",
        "state": "open",
        "draft": False,
        "merged": False,
        "title": "Add launch telemetry",
        "body": "",
        "head": {"ref": "add-telemetry", "sha": "9a41f0c3"},
        "author": {"user": {"id": USER_ID, "email": "jane@example.com", "handle": "jane"}},
        "createdAt": "2026-08-01T09:30:00Z",
        "updatedAt": "2026-08-01T10:00:00Z",
    }
    pull_request.update(overrides)
    return {"pullRequest": pull_request, "repository": {"id": REPO_EXTERNAL_ID}}


def _review(event_type: str, **overrides: Any) -> Any:
    return review_event(event_type, PullRequestEvent.from_payload(_payload(**overrides)))


class ReviewEventTest(TestCase):
    def test_events_map_to_triggers(self) -> None:
        cases = {
            "pull_request.created": CodeReviewTrigger.ON_READY_FOR_REVIEW,
            "pull_request.published": CodeReviewTrigger.ON_READY_FOR_REVIEW,
            "pull_request.head_ref.pushed": CodeReviewTrigger.ON_NEW_COMMIT,
        }
        for event_type, trigger in cases.items():
            with self.subTest(event_type=event_type):
                review = _review(event_type)
                assert review is not None
                assert review.trigger == trigger

    def test_a_close_or_merge_is_a_close(self) -> None:
        for event_type in ("pull_request.closed", "pull_request.merged"):
            with self.subTest(event_type=event_type):
                review = _review(event_type)
                assert review is not None
                assert review.is_close

    def test_other_events_start_nothing(self) -> None:
        for event_type in (
            "pull_request.metadata.updated",
            "pull_request.base_ref.updated",
            "pull_request.reopened",
        ):
            with self.subTest(event_type=event_type):
                assert _review(event_type) is None

    def test_the_review_carries_the_pull_request(self) -> None:
        review = _review("pull_request.head_ref.pushed", draft=True)

        assert review.action == "head_ref.pushed"
        assert review.pr_number == 17
        assert review.head_sha == "9a41f0c3"
        assert review.is_draft is True
        assert review.author_external_id == USER_ID
        assert review.trigger_user == "jane"

    def test_an_app_author_is_its_own_contributor(self) -> None:
        review = _review("pull_request.created", author={"app": {"id": "app_01example"}})

        assert review.author_external_id == "app_01example"


@cell_silo_test
class CodeReviewFromWebhookTest(TestCase):
    @pytest.fixture(autouse=True)
    def mock_seer_request(self) -> Generator[None]:
        with patch("sentry.seer.code_review.webhooks.task.make_seer_request") as mock_seer:
            self.mock_seer = mock_seer
            yield

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            status=ObjectStatus.ACTIVE,
        )
        self.repo = self.create_repo(
            project=self.project,
            name=REPO,
            provider="integrations:cursor_origin",
            integration_id=self.integration.id,
            external_id=REPO_EXTERNAL_ID,
        )
        self.create_repository_settings(
            repository=self.repo,
            enabled_code_review=True,
            code_review_triggers=[t.value for t in CodeReviewTrigger],
        )
        context = integration_service.organization_contexts(
            provider="cursor_origin", external_id=INSTALLATION_ID
        )
        assert context.integration is not None
        self.rpc_integration = context.integration
        self.org_integrations = context.organization_integrations

    def _handle(self, event_type: str, **overrides: Any) -> None:
        with self.tasks():
            PullRequestLifecycleHandler(event_type)(
                _payload(**overrides), "whd_01example", self.rpc_integration, self.org_integrations
            )

    @with_feature(FEATURES)
    def test_an_opened_pull_request_is_reviewed(self) -> None:
        self._handle("pull_request.created")

        self.mock_seer.assert_called_once()
        sent = self.mock_seer.call_args.kwargs
        assert sent["path"] == "/v1/code_review/review-request"
        repo = sent["payload"]["data"]["repo"]
        assert (repo["provider"], repo["owner"], repo["name"]) == (
            "cursor_origin",
            "acme",
            "rocket",
        )
        assert repo["external_id"] == REPO_EXTERNAL_ID
        assert sent["payload"]["data"]["pr_id"] == 17

    @with_feature(FEATURES)
    def test_the_author_becomes_a_contributor(self) -> None:
        self._handle("pull_request.created")

        contributor = OrganizationContributors.objects.get(organization_id=self.organization.id)
        assert contributor.provider == "cursor_origin"
        assert contributor.hostname == "cursor.com"
        assert contributor.external_identifier == USER_ID
        assert contributor.alias == "jane"

    @with_feature(FEATURES)
    def test_a_merge_tells_seer_the_pull_request_closed(self) -> None:
        self._handle("pull_request.merged", state="closed", merged=True)

        assert self.mock_seer.call_args.kwargs["path"] == "/v1/code_review/pr-closed"

    @with_feature(FEATURES)
    def test_a_title_change_is_not_reviewed(self) -> None:
        self._handle("pull_request.metadata.updated")

        self.mock_seer.assert_not_called()

    @with_feature(FEATURES)
    def test_an_app_author_is_reviewed_as_a_bot(self) -> None:
        self._handle(
            "pull_request.created",
            author={"app": {"id": "app_01example", "displayName": "Cursor"}},
        )

        self.mock_seer.assert_called_once()
        contributor = OrganizationContributors.objects.get(organization_id=self.organization.id)
        assert contributor.external_identifier == "app_01example"
        assert contributor.alias == "Cursor[bot]"
        assert contributor.is_bot

    @with_feature(FEATURES)
    def test_a_service_account_author_is_reviewed_as_a_bot(self) -> None:
        self._handle("pull_request.created", author={"serviceAccount": {"id": "sa_01example"}})

        self.mock_seer.assert_called_once()
        contributor = OrganizationContributors.objects.get(organization_id=self.organization.id)
        assert contributor.alias == "sa_01example[bot]"
        assert contributor.is_bot

    @with_feature(FEATURES)
    def test_a_deleted_organization_is_skipped(self) -> None:
        with patch(
            "sentry.integrations.cursor_origin.code_review.Organization.objects.get_from_cache",
            side_effect=Organization.DoesNotExist,
        ):
            self._handle("pull_request.created")

        self.mock_seer.assert_not_called()

    @with_feature(FEATURES - {"organizations:seer-cursor-origin-support"})
    def test_nothing_happens_without_the_origin_flag(self) -> None:
        self._handle("pull_request.created")

        self.mock_seer.assert_not_called()
        assert not OrganizationContributors.objects.exists()

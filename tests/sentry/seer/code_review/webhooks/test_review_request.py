from collections.abc import Generator, Mapping
from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import pytest

from sentry.integrations.services.integration.serial import serialize_integration
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.seer.code_review.webhooks.review_request import (
    PullRequestReviewEvent,
    request_review,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature

CODE_REVIEW_FEATURES = {"organizations:gen-ai-features", "organizations:code-review-beta"}


def _event(**overrides: object) -> PullRequestReviewEvent:
    fields: dict[str, object] = {
        "event_type": "pull_request",
        "action": "opened",
        "pr_number": 17,
        "head_sha": "9a41f0c3",
        "trigger": CodeReviewTrigger.ON_READY_FOR_REVIEW,
        "is_draft": False,
        "author_external_id": "1234",
        "trigger_user": "jane",
        "trigger_at": datetime(2026, 8, 1, 10, tzinfo=timezone.utc),
        "is_private": True,
    }
    fields.update(overrides)
    return PullRequestReviewEvent(**fields)  # type: ignore[arg-type]


class RequestReviewTest(TestCase):
    @pytest.fixture(autouse=True)
    def mock_seer_request(self) -> Generator[None]:
        with patch("sentry.seer.code_review.webhooks.task.make_seer_request") as mock_seer:
            self.mock_seer = mock_seer
            yield

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="1"
        )
        self.repo = self.create_repo(
            project=self.project,
            name="acme/rocket",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="512",
        )
        self.create_organization_contributor(
            organization=self.organization, integration=self.integration, external_identifier="1234"
        )

    def _enable(self, triggers: list[CodeReviewTrigger] | None = None) -> None:
        if triggers is None:
            triggers = [CodeReviewTrigger.ON_READY_FOR_REVIEW, CodeReviewTrigger.ON_NEW_COMMIT]
        self.create_repository_settings(
            repository=self.repo,
            enabled_code_review=True,
            code_review_triggers=[t.value for t in triggers],
        )

    def _request(self, event: PullRequestReviewEvent) -> None:
        with self.tasks():
            request_review(
                event,
                organization=self.organization,
                repo=self.repo,
                integration=serialize_integration(self.integration),
            )

    def _sent(self) -> Mapping[str, Any]:
        self.mock_seer.assert_called_once()
        return self.mock_seer.call_args.kwargs

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_review_is_sent_to_seer(self) -> None:
        self._enable()

        self._request(_event())

        sent = self._sent()
        assert sent["path"] == "/v1/code_review/review-request"
        payload = sent["payload"]
        assert payload["external_owner_id"] == "512"
        data = payload["data"]
        assert data["pr_id"] == 17
        assert data["experiment_enabled"] is True
        assert data["repo"]["provider"] == "github"
        assert (data["repo"]["owner"], data["repo"]["name"]) == ("acme", "rocket")
        assert data["repo"]["base_commit_sha"] == "9a41f0c3"
        assert data["repo"]["is_private"] is True
        assert data["config"]["trigger"] == "on_ready_for_review"
        assert data["config"]["trigger_user"] == "jane"
        assert data["config"]["trigger_at"] == "2026-08-01T10:00:00+00:00"

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_close_is_sent_to_the_closed_endpoint(self) -> None:
        self._enable()

        self._request(_event(action="closed", trigger=None))

        sent = self._sent()
        assert sent["path"] == "/v1/code_review/pr-closed"
        assert sent["payload"]["data"]["config"]["trigger"] == "unknown"

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_trigger_the_repository_has_not_enabled_is_skipped(self) -> None:
        self._enable([CodeReviewTrigger.ON_READY_FOR_REVIEW])

        self._request(_event(trigger=CodeReviewTrigger.ON_NEW_COMMIT))

        self.mock_seer.assert_not_called()

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_close_is_skipped_when_the_repository_has_no_triggers(self) -> None:
        self._enable([])

        self._request(_event(action="closed", trigger=None))

        self.mock_seer.assert_not_called()

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_draft_is_not_reviewed(self) -> None:
        self._enable()

        self._request(_event(is_draft=True))

        self.mock_seer.assert_not_called()

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_draft_still_sends_its_close(self) -> None:
        self._enable()

        self._request(_event(action="closed", trigger=None, is_draft=True))

        assert self._sent()["path"] == "/v1/code_review/pr-closed"

    @with_feature(CODE_REVIEW_FEATURES)
    def test_an_unknown_author_is_denied_by_preflight(self) -> None:
        self._enable()

        self._request(_event(author_external_id="9999"))

        self.mock_seer.assert_not_called()

    def test_nothing_is_sent_without_code_review_enabled(self) -> None:
        self._enable()

        self._request(_event())

        self.mock_seer.assert_not_called()

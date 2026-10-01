from collections.abc import Generator, Mapping
from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import pytest
from django.test import override_settings
from pydantic import ValidationError

from sentry.integrations.services.integration.serial import serialize_integration
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.seer.code_review.models import SeerCodeReviewTaskRequestForPrReview
from sentry.seer.code_review.webhooks.review_request import (
    PullRequestReviewEvent,
    request_review,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature

CODE_REVIEW_FEATURES = {"organizations:code-review-beta"}


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


@override_settings(SENTRY_SELF_HOSTED=False)
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

    def _logged(self, event: PullRequestReviewEvent) -> dict[str, dict[str, Any]]:
        with patch("sentry.seer.code_review.webhooks.review_request.logger") as logger:
            self._request(event)
        return {call.args[0]: call.kwargs["extra"] for call in logger.info.call_args_list}

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_scheduled_review_is_logged(self) -> None:
        self._enable()

        logged = self._logged(_event())

        extra = logged["code_review.review_request.scheduled"]
        assert extra["organization_id"] == self.organization.id
        assert extra["repository_id"] == self.repo.id
        assert extra["provider"] == "github"
        assert extra["pr_number"] == 17

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_denial_is_logged_with_its_reason(self) -> None:
        self._enable()

        logged = self._logged(_event(author_external_id="9999"))

        assert logged["code_review.review_request.denied"]["denial_reason"] == (
            "org_contributor_not_found"
        )

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_disabled_trigger_is_logged(self) -> None:
        self._enable([CodeReviewTrigger.ON_READY_FOR_REVIEW])

        logged = self._logged(_event(trigger=CodeReviewTrigger.ON_NEW_COMMIT))

        assert "code_review.review_request.trigger_disabled" in logged

    @with_feature(CODE_REVIEW_FEATURES)
    def test_a_skipped_draft_is_logged(self) -> None:
        self._enable()

        logged = self._logged(_event(is_draft=True))

        assert "code_review.review_request.draft_skipped" in logged

    @with_feature(CODE_REVIEW_FEATURES)
    def test_an_invalid_payload_is_logged_instead_of_scheduled(self) -> None:
        self._enable()

        with patch(
            "sentry.seer.code_review.webhooks.review_request.SeerCodeReviewTaskRequestForPrReview.parse_obj",
            side_effect=ValidationError([], SeerCodeReviewTaskRequestForPrReview),
        ):
            logged = self._logged(_event())

        self.mock_seer.assert_not_called()
        assert "code_review.review_request.invalid_payload" in logged
        assert "code_review.review_request.scheduled" not in logged

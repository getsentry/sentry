from typing import int
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import requests
from django.urls import reverse

from sentry.feedback.endpoints.organization_feedback_summary import get_summary_from_seer
from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.create_feedback import create_feedback_issue
from sentry.models.project import Project
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from tests.sentry.feedback import MockSeerResponse, mock_feedback_event


@patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
def test_get_summary_from_seer_basic(mock_make_seer_api_request: MagicMock) -> None:
    mock_make_seer_api_request.return_value = MockSeerResponse(
        200,
        json_data={"data": "Test summary of feedback"},
    )

    summary = get_summary_from_seer(["hello world"])
    assert summary == "Test summary of feedback"
    assert mock_make_seer_api_request.call_count == 1
    body = mock_make_seer_api_request.call_args[1]["body"]
    assert json.loads(body.decode("utf-8")) == {"feedbacks": ["hello world"]}


@patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
def test_get_summary_from_seer_timeout(mock_make_seer_api_request: MagicMock) -> None:
    mock_make_seer_api_request.side_effect = requests.exceptions.Timeout("Request timed out")
    assert get_summary_from_seer(["hello world"]) is None


@patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
def test_get_summary_from_seer_http_errors(mock_make_seer_api_request: MagicMock) -> None:
    for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
        mock_make_seer_api_request.return_value = MockSeerResponse(
            status=status,
            json_data={"error": "Test error"},
        )
        assert get_summary_from_seer(["hello world"]) is None


@region_silo_test
class OrganizationFeedbackSummaryTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-feedback-summary"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(
            organization=self.org, name="Sentaur Squad", members=[self.user]
        )
        self.project1 = self.create_project(teams=[self.team])
        self.project2 = self.create_project(teams=[self.team])
        self.features = {
            "organizations:user-feedback-ai-summaries": True,
            "organizations:user-feedback-ai-summaries-cache": True,
        }
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.org.slug},
        )

        # Mock patchers.
        self.mock_has_seer_access_patcher = patch(
            "sentry.feedback.endpoints.organization_feedback_summary.has_seer_access",
            return_value=True,
        )
        self.mock_get_summary_from_seer_patcher = patch(
            "sentry.feedback.endpoints.organization_feedback_summary.get_summary_from_seer",
            return_value="Test summary of feedback",
        )
        self.mock_min_feedbacks_patcher = patch(
            "sentry.feedback.endpoints.organization_feedback_summary.MIN_FEEDBACKS_TO_SUMMARIZE",
            1,
        )
        self.mock_has_seer_access = self.mock_has_seer_access_patcher.start()
        self.mock_get_summary_from_seer = self.mock_get_summary_from_seer_patcher.start()
        self.mock_min_feedbacks_patcher.start()

    def tearDown(self) -> None:
        self.mock_has_seer_access_patcher.stop()
        self.mock_get_summary_from_seer_patcher.stop()
        self.mock_min_feedbacks_patcher.stop()
        super().tearDown()

    def save_feedback(self, project: Project, message: str, dt: datetime | None = None) -> None:
        event = mock_feedback_event(project.id, message=message, dt=dt)
        create_feedback_issue(event, project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    def test_get_feedback_summary_without_feature_flag(self) -> None:
        response = self.get_error_response(self.org.slug)
        assert response.status_code == 403

    def test_get_feedback_summary_without_seer_access(self) -> None:
        self.mock_has_seer_access.return_value = False
        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)
            assert response.status_code == 403

    @patch("sentry.feedback.endpoints.organization_feedback_summary.cache")
    def test_get_feedback_summary_cache_miss(self, mock_cache: MagicMock) -> None:
        mock_cache.get.return_value = None
        self.save_feedback(self.project1, "hello")

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 1
        assert self.mock_get_summary_from_seer.call_count == 1
        assert self.mock_get_summary_from_seer.call_args[0][0] == ["hello"]
        mock_cache.set.assert_called_once()
        assert mock_cache.set.call_args[0][1] == {
            "summary": "Test summary of feedback",
            "numFeedbacksUsed": 1,
        }

    @patch("sentry.feedback.endpoints.organization_feedback_summary.cache")
    def test_get_feedback_summary_cache_hit(self, mock_cache: MagicMock) -> None:
        mock_cache.get.return_value = {
            "summary": "Test cached summary of feedback",
            "numFeedbacksUsed": 13,
        }

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test cached summary of feedback"
        assert response.data["numFeedbacksUsed"] == 13

        mock_cache.get.assert_called_once()
        mock_cache.set.assert_not_called()

    def test_get_feedback_summary_with_date_filter(self) -> None:
        # Created immediately
        self.save_feedback(self.project1, "New feedback")

        # Created ~21 days ago - will not be included in the summary
        self.save_feedback(self.project1, "Old feedback", dt=datetime.now(UTC) - timedelta(days=21))

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, statsPeriod="14d")

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 1
        assert self.mock_get_summary_from_seer.call_count == 1
        assert self.mock_get_summary_from_seer.call_args[0][0] == ["New feedback"]

    @patch("sentry.feedback.endpoints.organization_feedback_summary.cache")
    def test_get_feedback_summary_project_filter(self, mock_cache: MagicMock) -> None:
        mock_cache.get.return_value = None
        self.save_feedback(self.project1, "Project 1 feedback")

        # Created ~21 days ago - will not be included in the summary
        self.save_feedback(self.project2, "Project 2 feedback")

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, project=[self.project1.id])

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 1
        assert self.mock_get_summary_from_seer.call_count == 1
        assert set(self.mock_get_summary_from_seer.call_args[0][0]) == {"Project 1 feedback"}

        with self.feature(self.features):
            response = self.get_success_response(
                self.org.slug, project=[self.project1.id, self.project2.id]
            )

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 2
        assert self.mock_get_summary_from_seer.call_count == 2
        assert set(self.mock_get_summary_from_seer.call_args[0][0]) == {
            "Project 1 feedback",
            "Project 2 feedback",
        }

        with self.feature(self.features):
            response = self.client.get(
                f"{self.url}?project={self.project1.id}&project={self.project2.id}"
            )

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 2
        assert self.mock_get_summary_from_seer.call_count == 3
        assert set(self.mock_get_summary_from_seer.call_args[0][0]) == {
            "Project 1 feedback",
            "Project 2 feedback",
        }

    def test_get_feedback_summary_too_few_feedbacks(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is False

    @patch(
        "sentry.feedback.endpoints.organization_feedback_summary.MAX_FEEDBACKS_TO_SUMMARIZE_CHARS",
        1,
    )
    def test_get_feedback_summary_character_limit(self) -> None:
        self.save_feedback(self.project1, "a", dt=datetime.now(UTC) - timedelta(hours=3))
        self.save_feedback(self.project1, "b", dt=datetime.now(UTC) - timedelta(hours=2))
        self.save_feedback(self.project1, "c", dt=datetime.now(UTC) - timedelta(hours=1))

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 1
        assert self.mock_get_summary_from_seer.call_count == 1
        # Most recent is prioritized.
        assert self.mock_get_summary_from_seer.call_args[0][0] == ["c"]

    def test_get_summary_from_seer_failed(self) -> None:
        self.mock_get_summary_from_seer.return_value = None
        self.save_feedback(self.project1, "hello")

        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)

        assert response.status_code == 500
        assert response.data["detail"] == "Failed to generate a summary for a list of feedbacks"

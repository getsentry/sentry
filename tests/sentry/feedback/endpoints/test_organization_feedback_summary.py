from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import requests
from django.urls import reverse

from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.create_feedback import create_feedback_issue
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.feedback import MockSeerResponse, mock_feedback_event


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
        }
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.org.slug},
        )
        self.mock_has_seer_access_patcher = patch(
            "sentry.feedback.endpoints.organization_feedback_summary.has_seer_access",
            return_value=True,
        )
        self.mock_has_seer_access = self.mock_has_seer_access_patcher.start()

    def tearDown(self) -> None:
        self.mock_has_seer_access_patcher.stop()
        super().tearDown()

    def _make_valid_seer_response(self) -> MockSeerResponse:
        return MockSeerResponse(
            200,
            json_data={"data": "Test summary of feedback"},
        )

    def test_get_feedback_summary_without_feature_flag(self) -> None:
        response = self.get_error_response(self.org.slug)
        assert response.status_code == 403

    def test_get_feedback_summary_without_seer_access(self) -> None:
        self.mock_has_seer_access.return_value = False
        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)
            assert response.status_code == 403

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    def test_get_feedback_summary_basic(self, mock_make_seer_api_request: MagicMock) -> None:
        mock_make_seer_api_request.return_value = self._make_valid_seer_response()

        for _ in range(15):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 15

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    def test_get_feedback_summary_with_date_filter(
        self, mock_make_seer_api_request: MagicMock
    ) -> None:
        mock_make_seer_api_request.return_value = self._make_valid_seer_response()

        # 12 feedbacks that are created immediately
        for _ in range(12):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        # 8 feedbacks that were created ~21 days ago, which will not be included in the summary
        for _ in range(8):
            event = mock_feedback_event(self.project1.id, dt=datetime.now(UTC) - timedelta(days=21))
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        params = {
            "statsPeriod": "14d",
        }

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, **params)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 12

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    def test_get_feedback_summary_with_project_filter(
        self, mock_make_seer_api_request: MagicMock
    ) -> None:
        mock_make_seer_api_request.return_value = self._make_valid_seer_response()

        for _ in range(10):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        for _ in range(12):
            event = mock_feedback_event(self.project2.id)
            create_feedback_issue(
                event, self.project2, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        params = {
            "project": [self.project1.id],
        }

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, **params)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 10

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    def test_get_feedback_summary_with_many_project_filter_as_list(
        self, mock_make_seer_api_request: MagicMock
    ) -> None:
        mock_make_seer_api_request.return_value = self._make_valid_seer_response()

        for _ in range(10):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        for _ in range(12):
            event = mock_feedback_event(self.project2.id)
            create_feedback_issue(
                event, self.project2, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        params = {
            "project": [self.project1.id, self.project2.id],
        }

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, **params)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 22

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    def test_get_feedback_summary_with_many_project_filter_separate(
        self, mock_make_seer_api_request: MagicMock
    ) -> None:
        mock_make_seer_api_request.return_value = self._make_valid_seer_response()

        for _ in range(10):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        for _ in range(12):
            event = mock_feedback_event(self.project2.id)
            create_feedback_issue(
                event, self.project2, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.client.get(
                f"{self.url}?project={self.project1.id}&project={self.project2.id}"
            )

        assert response.status_code == 200
        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 22

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    def test_get_feedback_summary_too_few_feedbacks(
        self, mock_make_seer_api_request: MagicMock
    ) -> None:
        mock_make_seer_api_request.return_value = self._make_valid_seer_response()

        for _ in range(9):
            event = mock_feedback_event(self.project2.id)
            create_feedback_issue(
                event, self.project2, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is False

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    @patch(
        "sentry.feedback.endpoints.organization_feedback_summary.MAX_FEEDBACKS_TO_SUMMARIZE_CHARS",
        1000,
    )
    def test_get_feedback_summary_character_limit(self, mock_make_seer_api_request) -> None:
        mock_make_seer_api_request.return_value = self._make_valid_seer_response()

        # Create 9 older feedbacks with normal size, skipped due to the middle one exceeding the character limit
        for _ in range(9):
            event = mock_feedback_event(self.project1.id, dt=datetime.now(UTC) - timedelta(hours=3))
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        event = mock_feedback_event(self.project1.id, dt=datetime.now(UTC) - timedelta(hours=2))
        event["contexts"]["feedback"]["message"] = "a" * 2000
        create_feedback_issue(event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        for _ in range(12):
            event = mock_feedback_event(self.project1.id, dt=datetime.now(UTC) - timedelta(hours=1))
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["numFeedbacksUsed"] == 12

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    def test_seer_timeout(self, mock_make_seer_api_request: MagicMock) -> None:
        mock_make_seer_api_request.side_effect = requests.exceptions.Timeout("Request timed out")

        for _ in range(15):
            event = mock_feedback_event(self.project1.id)
            create_feedback_issue(
                event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)

        assert response.status_code == 500
        assert response.data["detail"] == "Failed to generate a summary for a list of feedbacks"

    @patch("sentry.feedback.endpoints.organization_feedback_summary.make_signed_seer_api_request")
    def test_seer_http_errors(self, mock_make_seer_api_request: MagicMock) -> None:
        for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
            mock_make_seer_api_request.return_value = MockSeerResponse(
                status=status, json_data={"error": "Test error"}
            )

            for _ in range(15):
                event = mock_feedback_event(self.project1.id)
                create_feedback_issue(
                    event, self.project1, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
                )

            with self.feature(self.features):
                response = self.get_error_response(self.org.slug)

            assert response.status_code == 500
            assert response.data["detail"] == "Failed to generate a summary for a list of feedbacks"

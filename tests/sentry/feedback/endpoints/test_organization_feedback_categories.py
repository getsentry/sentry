from typing import int
from datetime import datetime
from unittest.mock import patch

from django.urls import reverse

from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.create_feedback import create_feedback_issue
from sentry.feedback.usecases.label_generation import AI_LABEL_TAG_PREFIX
from sentry.models.project import Project
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.feedback import MockSeerResponse, mock_feedback_event


@region_silo_test
class OrganizationFeedbackCategoriesTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-feedback-categories"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.organization
        self.project1 = self.project
        self.project2 = self.create_project(teams=[self.team])
        self.features = {
            "organizations:user-feedback-ai-categorization-features": True,
        }
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.org.slug},
        )
        self.mock_has_seer_access_patcher = patch(
            "sentry.feedback.endpoints.organization_feedback_categories.has_seer_access",
            return_value=True,
        )
        self.mock_make_signed_seer_api_request_patcher = patch(
            "sentry.feedback.endpoints.organization_feedback_categories.make_signed_seer_api_request"
        )
        self.mock_threshold_to_get_associated_labels_patcher = patch(
            "sentry.feedback.endpoints.organization_feedback_categories.THRESHOLD_TO_GET_ASSOCIATED_LABELS",
            1,
        )
        self.mock_min_feedbacks_context_patcher = patch(
            "sentry.feedback.endpoints.organization_feedback_categories.MIN_FEEDBACKS_CONTEXT", 1
        )

        self.mock_make_signed_seer_api_request = (
            self.mock_make_signed_seer_api_request_patcher.start()
        )
        self.mock_has_seer_access = self.mock_has_seer_access_patcher.start()
        self.mock_threshold_to_get_associated_labels_patcher.start()
        self.mock_min_feedbacks_context_patcher.start()

    def tearDown(self) -> None:
        self.mock_has_seer_access_patcher.stop()
        self.mock_make_signed_seer_api_request_patcher.stop()
        self.mock_threshold_to_get_associated_labels_patcher.stop()
        self.mock_min_feedbacks_context_patcher.stop()
        super().tearDown()

    def _create_feedback(
        self,
        message: str,
        labels: list[str],
        project: Project,
        dt: datetime | None = None,
    ) -> None:
        tags = {f"{AI_LABEL_TAG_PREFIX}.label.{i}": labels[i] for i in range(len(labels))}
        event = mock_feedback_event(
            project.id,
            message=message,
            tags=tags,
            dt=dt,
        )
        create_feedback_issue(event, project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    def test_get_feedback_categories_without_feature_flag(self) -> None:
        response = self.get_error_response(self.org.slug)
        assert response.status_code == 403

    def test_get_feedback_categories_without_seer_access(self) -> None:
        self.mock_has_seer_access.return_value = False
        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)
            assert response.status_code == 403

    def test_get_feedback_categories_basic(self) -> None:
        self._create_feedback("a", ["User Interface", "Speed"], self.project1)
        self._create_feedback("b", ["Performance", "Usability", "Loading"], self.project1)
        self._create_feedback("c", ["Security", "Performance"], self.project2)
        self._create_feedback("d", ["Performance", "User Interface", "Speed"], self.project2)

        self.mock_make_signed_seer_api_request.return_value = MockSeerResponse(
            200,
            json_data={
                "data": [
                    {
                        "primaryLabel": "User Interface",
                        "associatedLabels": ["Usability"],
                    },
                    {"primaryLabel": "Performance", "associatedLabels": ["Speed", "Loading"]},
                    {"primaryLabel": "Security", "associatedLabels": []},
                    {"primaryLabel": "hallucinated", "associatedLabels": []},
                ]
            },
        )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert response.data["numFeedbacksContext"] == 4

        categories = response.data["categories"]
        assert len(categories) == 4

        assert any(category["primaryLabel"] == "User Interface" for category in categories)
        assert any(category["primaryLabel"] == "Performance" for category in categories)
        assert any(category["primaryLabel"] == "Security" for category in categories)
        assert any(category["primaryLabel"] == "hallucinated" for category in categories)

        for category in categories:
            if category["primaryLabel"] == "User Interface":
                assert category["feedbackCount"] == 3
            elif category["primaryLabel"] == "Performance":
                assert category["feedbackCount"] == 4
            elif category["primaryLabel"] == "Security":
                assert category["feedbackCount"] == 1
            elif category["primaryLabel"] == "hallucinated":
                assert category["feedbackCount"] == 0

    def test_get_feedback_categories_with_project_filter(self) -> None:
        self._create_feedback("a", ["User Interface", "Performance"], self.project1)
        self._create_feedback("b", ["Performance", "Loading"], self.project1)
        self._create_feedback("c", ["Security", "Performance"], self.project2)
        self._create_feedback("d", ["Performance", "User Interface", "Speed"], self.project2)

        self.mock_make_signed_seer_api_request.return_value = MockSeerResponse(
            200,
            json_data={
                "data": [
                    {
                        "primaryLabel": "User Interface",
                        "associatedLabels": [],
                    },
                    {"primaryLabel": "Performance", "associatedLabels": ["Loading"]},
                ]
            },
        )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, project=[self.project1.id])

        assert response.data["success"] is True
        assert response.data["numFeedbacksContext"] == 2

        categories = response.data["categories"]
        assert len(categories) == 2

        assert any(category["primaryLabel"] == "User Interface" for category in categories)
        assert any(category["primaryLabel"] == "Performance" for category in categories)

        for category in categories:
            if category["primaryLabel"] == "User Interface":
                assert category["feedbackCount"] == 1
            elif category["primaryLabel"] == "Performance":
                assert category["feedbackCount"] == 2

    @patch(
        "sentry.feedback.endpoints.organization_feedback_categories.MAX_GROUP_LABELS",
        2,
    )
    def test_max_group_labels_limit(self) -> None:
        """Test that MAX_GROUP_LABELS constant is respected when processing label groups."""
        self._create_feedback("a", ["User Interface"], self.project1)
        self._create_feedback("b", ["User Interface", "Usability"], self.project1)
        self._create_feedback("c", ["Accessibility"], self.project1)

        # Mock Seer to return a label group with more than MAX_GROUP_LABELS labels
        self.mock_make_signed_seer_api_request.return_value = MockSeerResponse(
            200,
            json_data={
                "data": [
                    {
                        "primaryLabel": "User Interface",
                        "associatedLabels": ["Usability", "Accessibility"],
                    }
                ]
            },
        )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        categories = response.data["categories"]
        assert len(categories) == 1

        assert categories[0]["primaryLabel"] == "User Interface"
        # Assert associated labels were truncated to length (MAX_GROUP_LABELS - 1)
        assert categories[0]["associatedLabels"] == ["Usability"]

    def test_filter_invalid_associated_labels_by_count_ratio(self) -> None:
        """Test that associated labels with too many feedbacks (relative to primary label) are filtered out."""
        # Create feedbacks where associated label feedbacks are >= primary label feedbacks.
        # This should cause them to be filtered out from the label group.
        self._create_feedback("a", ["User Interface", "Issues UI"], self.project1)
        self._create_feedback("b", ["Usability", "Issues UI"], self.project1)

        # XXX: the endpoint checks for assoc >= 3/4 * primary, but this test is more lenient in case the ratio changes.

        self.mock_make_signed_seer_api_request.return_value = MockSeerResponse(
            200,
            json_data={
                "data": [
                    {
                        "primaryLabel": "User Interface",
                        "associatedLabels": ["Usability", "Issues UI"],
                    }
                ]
            },
        )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        categories = response.data["categories"]
        assert len(categories) == 1
        assert categories[0]["primaryLabel"] == "User Interface"
        assert categories[0]["associatedLabels"] == []
        assert categories[0]["feedbackCount"] == 1

    def test_seer_request_error(self) -> None:
        self._create_feedback("a", ["User Interface", "Issues UI"], self.project1)
        self.mock_make_signed_seer_api_request.side_effect = Exception("seer failed")

        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)

        assert response.status_code == 500
        assert response.data["detail"] == "Failed to generate user feedback label groups"

    def test_seer_http_errors(self) -> None:
        self._create_feedback("a", ["User Interface", "Issues UI"], self.project1)
        for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
            self.mock_make_signed_seer_api_request.return_value = MockSeerResponse(
                status=status, json_data={"detail": "seer failed"}
            )

            with self.feature(self.features):
                response = self.get_error_response(self.org.slug)

            assert response.status_code == 500
            assert response.data["detail"] == "Failed to generate user feedback label groups"

    def test_fallback_to_primary_labels_when_below_threshold(self) -> None:
        """Test that when feedback count is below THRESHOLD_TO_GET_ASSOCIATED_LABELS, we fall back to primary labels only (no Seer request)."""

        with patch(
            "sentry.feedback.endpoints.organization_feedback_categories.THRESHOLD_TO_GET_ASSOCIATED_LABELS",
            2,
        ):
            self._create_feedback("a", ["User Interface", "Usability"], self.project1)

            with self.feature(self.features):
                response = self.get_success_response(self.org.slug)

            assert self.mock_make_signed_seer_api_request.call_count == 0

            assert response.data["success"] is True
            categories = response.data["categories"]
            assert len(categories) == 2

            assert any(category["primaryLabel"] == "User Interface" for category in categories)
            assert any(category["primaryLabel"] == "Usability" for category in categories)

            for category in categories:
                assert category["associatedLabels"] == []
                assert category["feedbackCount"] == 1

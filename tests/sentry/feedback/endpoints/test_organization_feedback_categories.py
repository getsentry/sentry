from typing import Any, TypedDict

import requests
import responses
from django.conf import settings
from django.urls import reverse

from sentry.feedback.usecases.label_generation import AI_LABEL_TAG_PREFIX
from sentry.issues.grouptype import FeedbackGroup
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test
from tests.sentry.issues.test_utils import SearchIssueTestMixin


def mock_seer_category_response(**kwargs) -> None:
    """Use with @responses.activate to mock Seer category generation responses."""
    responses.add(
        responses.POST,
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/label-groups",
        **kwargs,
    )


class FeedbackData(TypedDict):
    fingerprint: str
    tags: list[tuple[str, str]]
    contexts: dict[str, Any]


@region_silo_test
class OrganizationFeedbackCategoriesTest(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    endpoint = "sentry-api-0-organization-user-feedback-categories"

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
            "organizations:user-feedback-ai-categorization-features": True,
            "organizations:gen-ai-features": True,
        }
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.org.slug},
        )
        self._create_standard_feedbacks(self.project1.id)

    def _create_standard_feedbacks(self, project_id: int) -> None:
        """Create a standard set of feedbacks for testing."""
        insert_time = before_now(hours=12)

        feedback_data: list[FeedbackData] = [
            {
                "fingerprint": "feedback-1",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
                "contexts": {"feedback": {"message": "The UI is too slow and confusing"}},
            },
            {
                "fingerprint": "feedback-2",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
                "contexts": {"feedback": {"message": "Button colors are hard to see"}},
            },
            {
                "fingerprint": "feedback-3",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Usability"),
                ],
                "contexts": {"feedback": {"message": "The interface design is poor"}},
            },
            {
                "fingerprint": "feedback-4",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Speed"),
                ],
                "contexts": {"feedback": {"message": "Page load times are too slow"}},
            },
            {
                "fingerprint": "feedback-5",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Loading"),
                ],
                "contexts": {"feedback": {"message": "The app crashes frequently"}},
            },
            {
                "fingerprint": "feedback-6",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Security"),
                ],
                "contexts": {"feedback": {"message": "Login doesn't work properly"}},
            },
            {
                "fingerprint": "feedback-7",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication")],
                "contexts": {"feedback": {"message": "Password reset is broken"}},
            },
            {
                "fingerprint": "feedback-8",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Performance"),
                ],
                "contexts": {"feedback": {"message": "The interface is slow and confusing"}},
            },
            {
                "fingerprint": "feedback-9",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "User Interface"),
                ],
                "contexts": {"feedback": {"message": "Performance issues with the UI"}},
            },
            {
                "fingerprint": "feedback-10",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "User Interface"),
                ],
                "contexts": {"feedback": {"message": "Authentication problems with slow UI"}},
            },
        ]

        for data in feedback_data:
            self.store_search_issue(
                project_id=project_id,
                user_id=1,
                fingerprints=[data["fingerprint"]],
                tags=data["tags"],
                event_data={"contexts": data["contexts"]},
                override_occurrence_data={"type": FeedbackGroup.type_id},
                insert_time=insert_time,
            )

        # Create additional feedbacks in project2
        insert_time = before_now(hours=12)
        for i in range(5):
            self.store_search_issue(
                project_id=self.project2.id,
                user_id=1,
                fingerprints=[f"feedback-project2-{i}"],
                tags=[(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
                event_data={"contexts": {"feedback": {"message": f"Feedback {i} from project2"}}},
                override_occurrence_data={"type": FeedbackGroup.type_id},
                insert_time=insert_time,
            )

    @django_db_all
    def test_get_feedback_categories_without_feature_flag(self) -> None:
        response = self.get_error_response(self.org.slug)
        assert response.status_code == 404

    @django_db_all
    @responses.activate
    def test_get_feedback_categories_basic(self) -> None:
        mock_seer_category_response(
            status=200,
            json={
                "data": [
                    {
                        "primaryLabel": "User Interface",
                        "associatedLabels": ["Usability"],
                    },
                    {"primaryLabel": "Performance", "associatedLabels": ["Speed", "Loading"]},
                    {"primaryLabel": "Authentication", "associatedLabels": ["Security"]},
                ]
            },
        )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert "categories" in response.data
        assert "numFeedbacksContext" in response.data
        assert response.data["numFeedbacksContext"] == 15

        categories = response.data["categories"]
        assert len(categories) == 3

        assert any(category["primaryLabel"] == "User Interface" for category in categories)
        assert any(category["primaryLabel"] == "Performance" for category in categories)
        assert any(category["primaryLabel"] == "Authentication" for category in categories)

        for category in categories:
            assert "primaryLabel" in category
            assert "associatedLabels" in category
            assert "feedbackCount" in category
            assert isinstance(category["primaryLabel"], str)
            assert isinstance(category["associatedLabels"], list)
            assert isinstance(category["feedbackCount"], int)

            if category["primaryLabel"] == "User Interface":
                assert category["feedbackCount"] == 11
            elif category["primaryLabel"] == "Performance":
                assert category["feedbackCount"] == 4
            elif category["primaryLabel"] == "Authentication":
                assert category["feedbackCount"] == 3

    @django_db_all
    @responses.activate
    def test_get_feedback_categories_with_project_filter(self) -> None:
        mock_seer_category_response(
            status=200,
            json={
                "data": [
                    {
                        "primaryLabel": "User Interface",
                        "associatedLabels": ["Performance", "Usability"],
                    },
                    {"primaryLabel": "Authentication", "associatedLabels": ["Security", "Login"]},
                ]
            },
        )

        params = {
            "project": [self.project1.id],
        }

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug, **params)

        assert response.data["success"] is True
        assert "categories" in response.data
        assert "numFeedbacksContext" in response.data
        assert response.data["numFeedbacksContext"] == 10

        categories = response.data["categories"]
        assert len(categories) == 2

        assert any(category["primaryLabel"] == "User Interface" for category in categories)
        assert any(category["primaryLabel"] == "Authentication" for category in categories)

        for category in categories:
            assert "primaryLabel" in category
            assert "associatedLabels" in category
            assert "feedbackCount" in category
            assert isinstance(category["primaryLabel"], str)
            assert isinstance(category["associatedLabels"], list)
            assert isinstance(category["feedbackCount"], int)

            if category["primaryLabel"] == "User Interface":
                assert category["feedbackCount"] == 8
            elif category["primaryLabel"] == "Authentication":
                assert category["feedbackCount"] == 3

    @django_db_all
    @responses.activate
    def test_max_associated_labels_limit(self) -> None:
        """Test that MAX_ASSOCIATED_LABELS constant is respected when processing label groups."""
        # Mock Seer to return a label group with more than MAX_ASSOCIATED_LABELS associated labels
        mock_seer_category_response(
            status=200,
            json={
                "data": [
                    {
                        "primaryLabel": "User Interface",
                        "associatedLabels": [
                            "Usability",
                            "Design",
                            "Layout",
                            "Colors",
                            "Typography",
                            "Spacing",
                            "Alignment",
                            "Responsiveness",
                            "Accessibility",
                            "Navigation",
                            "Buttons",
                            "Forms",
                            "Extra Label 1",  # This should be truncated
                            "Extra Label 2",  # This should be truncated
                            "Extra Label 3",  # This should be truncated
                        ],
                    }
                ]
            },
        )

        with self.feature(self.features):
            response = self.get_success_response(self.org.slug)

        assert response.data["success"] is True
        assert "categories" in response.data

        categories = response.data["categories"]
        assert len(categories) == 1

        user_interface_category = categories[0]
        assert user_interface_category["primaryLabel"] == "User Interface"

        # Verify that associatedLabels is truncated to MAX_ASSOCIATED_LABELS (12)
        associated_labels = user_interface_category["associatedLabels"]
        assert (
            len(associated_labels) == 12
        ), f"Expected 12 associated labels, got {len(associated_labels)}"

        # Verify the first 12 labels are preserved
        expected_labels = [
            "Usability",
            "Design",
            "Layout",
            "Colors",
            "Typography",
            "Spacing",
            "Alignment",
            "Responsiveness",
            "Accessibility",
            "Navigation",
            "Buttons",
            "Forms",
        ]
        assert associated_labels == expected_labels

        # Verify that the extra labels beyond MAX_ASSOCIATED_LABELS are not included
        assert "Extra Label 1" not in associated_labels
        assert "Extra Label 2" not in associated_labels
        assert "Extra Label 3" not in associated_labels

    @django_db_all
    @responses.activate
    def test_seer_timeout(self) -> None:
        mock_seer_category_response(body=requests.exceptions.Timeout("Request timed out"))

        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)

        assert response.status_code == 500

    @django_db_all
    @responses.activate
    def test_seer_connection_error(self) -> None:
        mock_seer_category_response(body=requests.exceptions.ConnectionError("Connection error"))

        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)

        assert response.status_code == 500

    @django_db_all
    @responses.activate
    def test_seer_request_error(self) -> None:
        mock_seer_category_response(
            body=requests.exceptions.RequestException("Generic request error")
        )

        with self.feature(self.features):
            response = self.get_error_response(self.org.slug)

        assert response.status_code == 500

    @django_db_all
    @responses.activate
    def test_seer_http_errors(self) -> None:
        for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
            mock_seer_category_response(status=status)

            with self.feature(self.features):
                response = self.get_error_response(self.org.slug)

            assert response.status_code == 500

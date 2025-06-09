import time
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from openai.types.chat.chat_completion import ChatCompletion, Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage

from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, create_feedback_issue
from sentry.testutils.cases import APITestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test


def create_dummy_response(*args, **kwargs):
    return ChatCompletion(
        id="test",
        choices=[
            Choice(
                index=0,
                message=ChatCompletionMessage(
                    content=("Summary: Test summary of feedback"),
                    role="assistant",
                ),
                finish_reason="stop",
            )
        ],
        created=int(time.time()),
        model="gpt3.5-trubo",
        object="chat.completion",
    )


@pytest.fixture(autouse=True)
def llm_settings(set_sentry_option):
    with (
        set_sentry_option(
            "llm.provider.options",
            {"openai": {"models": ["gpt-4-turbo-1.0"], "options": {"api_key": "fake_api_key"}}},
        ),
        set_sentry_option(
            "llm.usecases.options",
            {"feedbacksummaries": {"provider": "openai", "options": {"model": "gpt-4-turbo-1.0"}}},
        ),
    ):
        yield


def mock_feedback_event(project_id: int, dt: datetime | None = None):
    if dt is None:
        dt = datetime.now(UTC)

    return {
        "project_id": project_id,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": dt.timestamp(),
        "received": dt.isoformat(),
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "Testing!!",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }


@region_silo_test
@pytest.mark.usefixtures("monkeypatch")
class OrganizationFeedbackSummaryTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-feedback-summary"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.project1 = self.create_project(teams=[self.team])
        self.project2 = self.create_project(teams=[self.team])

    @django_db_all
    @patch("sentry.llm.providers.openai.OpenAI")
    def test_get_feedback_summary_basic(self, mock_openai):
        mock_openai.return_value.chat.completions.create = create_dummy_response

        for _ in range(15):
            event = mock_feedback_event(self.project.id)
            create_feedback_issue(
                event, self.project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        response = self.get_success_response(self.org.slug)
        assert response.data["success"] is True
        assert response.data["summary"] == "Test summary of feedback"
        assert response.data["num_feedbacks_used"] == 15  # Uses all of the created feedbacks

    # @patch(
    #     "sentry.feedback.usecases.feedback_summaries.generate_summary",
    #     side_effect=create_dummy_summary_response,
    # )
    # def test_get_feedback_summary_basic(self, mock_generate_summary):
    #     """Test getting feedback summary with default parameters (7 days)"""
    #     response = self.get_success_response(self.org.slug)

    #     print("this is the print statement", response.data)

    #     assert response.data["success"] is True
    #     assert response.data["summary"] == "Test summary of feedback"
    #     assert response.data["num_feedbacks_used"] == 15  # All feedbacks within 7 days

    # @patch(
    #     "sentry.feedback.usecases.feedback_summaries.generate_summary",
    #     side_effect=create_dummy_summary_response,
    # )
    # def test_get_feedback_summary_with_date_filter(self, mock_generate_summary):
    #     """Test getting feedback summary with specific date range"""
    #     now = datetime.now(timezone.utc)
    #     params = {
    #         "statsPeriod": "2d",  # Only look at last 2 days
    #     }

    #     response = self.get_success_response(self.org.slug, **params)

    #     assert response.data["success"] is True
    #     assert response.data["summary"] == "Test summary of feedback"
    #     # Should have fewer feedbacks since we're only looking at 2 days
    #     assert response.data["num_feedbacks_used"] < 15

    # def test_get_feedback_summary_too_few_feedbacks(self):
    #     """Test getting summary when there are fewer than 10 feedbacks"""
    #     # Delete most feedbacks to get below threshold
    #     for feedback in self.feedbacks[10:]:
    #         feedback.delete()

    #     response = self.get_success_response(self.org.slug)

    #     assert response.data["summary"] is None
    #     assert response.data["sucesss"] is False
    #     assert response.data["num_feedbacks_used"] == 0

    # @patch(
    #     "sentry.feedback.usecases.feedback_summaries.generate_summary",
    #     side_effect=Exception("LLM Error"),
    # )
    # def test_get_feedback_summary_llm_error(self, mock_generate_summary):
    #     """Test handling of LLM errors"""
    #     response = self.get_error_response(self.org.slug, status_code=500)
    #     assert response.data["detail"] == "Error generating summary"

    # def test_get_feedback_summary_invalid_date_range(self):
    #     """Test handling of invalid date range parameters"""
    #     params = {
    #         "start": "invalid-date",
    #         "end": "also-invalid",
    #     }
    #     response = self.get_error_response(self.org.slug, status_code=400, **params)
    #     assert "start and end are" in response.data["detail"]

    # @patch(
    #     "sentry.feedback.usecases.feedback_summaries.generate_summary",
    #     side_effect=create_dummy_summary_response,
    # )
    # def test_get_feedback_summary_character_limit(self, mock_generate_summary):
    #     """Test that feedback messages don't exceed character limit"""
    #     # Create a feedback with very long message
    #     long_message = "a" * 1000000  # 1M characters
    #     self.create_group(
    #         project=self.project,
    #         type=FeedbackGroup.type_id,
    #         message="Long feedback",
    #         status=GroupStatus.UNRESOLVED,
    #         substatus=GroupSubStatus.NEW,
    #         first_seen=datetime.now(timezone.utc),
    #         data={"metadata": {"message": long_message}},
    #     )

    #     response = self.get_success_response(self.org.slug)

    #     assert response.data["success"] is True
    #     assert response.data["summary"] == "Test summary of feedback"
    #     # The number of feedbacks used should be limited due to character limit
    #     assert response.data["num_feedbacks_used"] < len(self.feedbacks) + 1

    # @patch(
    #     "sentry.feedback.usecases.feedback_summaries.generate_summary",
    #     side_effect=create_dummy_summary_response,
    # )
    # def test_get_feedback_summary_with_project_filter(self, mock_generate_summary):
    #     """Test getting feedback summary filtered by project"""
    #     # Create feedback in project2
    #     now = datetime.now(timezone.utc)
    #     project2_feedback = self.create_group(
    #         project=self.project2,
    #         type=FeedbackGroup.type_id,
    #         message="Project 2 feedback",
    #         status=GroupStatus.UNRESOLVED,
    #         substatus=GroupSubStatus.NEW,
    #         first_seen=now - timedelta(days=1),
    #         data={"metadata": {"message": "This is feedback from project 2"}},
    #     )

    #     response = self.get_success_response(self.org.slug, project=[self.project2.id])

    #     assert response.data["success"] is True
    #     assert response.data["summary"] is None  # Only one feedback in project2, below threshold
    #     assert response.data["num_feedbacks_used"] == 0

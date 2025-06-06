# from datetime import datetime, timedelta, timezone
# from unittest.mock import patch

# from sentry.issues.grouptype import FeedbackGroup
# from sentry.models.group import GroupStatus
# from sentry.testutils.cases import APITestCase
# from sentry.testutils.silo import region_silo_test
# from sentry.types.group import GroupSubStatus


# def create_dummy_summary_response(*args, **kwargs):
#     """Mock the AI summary response"""
#     if len(args[0]) <= 10:  # If less than 10 feedbacks, return None
#         return None
#     return "Summary: Test summary of feedback"


# @region_silo_test
# class OrganizationFeedbackSummaryTest(APITestCase):
#     endpoint = "sentry-api-0-organization-user-feedback-summary"

#     def setUp(self):
#         super().setUp()
#         self.login_as(user=self.user)
#         self.org = self.create_organization(owner=self.user)
#         self.team = self.create_team(organization=self.org)
#         self.project = self.create_project(teams=[self.team])
#         self.project2 = self.create_project(teams=[self.team])

#         # Create feedback issues with different timestamps
#         now = datetime.now(timezone.utc)
#         self.feedbacks = []
#         for i in range(15):  # Create 15 feedbacks
#             feedback = self.create_group(
#                 project=self.project,
#                 type=FeedbackGroup.type_id,
#                 message=f"Feedback {i}",
#                 status=GroupStatus.UNRESOLVED,
#                 substatus=GroupSubStatus.NEW,
#                 first_seen=now - timedelta(days=3, hours=i),  # Spread over 3 days
#                 data={"metadata": {"message": f"This is feedback message {i}"}},
#             )
#             self.feedbacks.append(feedback)

#         # Create some resolved feedbacks
#         self.resolved_feedback = self.create_group(
#             project=self.project,
#             type=FeedbackGroup.type_id,
#             message="Resolved feedback",
#             status=GroupStatus.RESOLVED,
#             first_seen=now - timedelta(days=2),
#             data={"metadata": {"message": "This is a resolved feedback"}},
#         )

#         # Create some ignored feedbacks (should be excluded)
#         self.ignored_feedback = self.create_group(
#             project=self.project,
#             type=FeedbackGroup.type_id,
#             message="Ignored feedback",
#             status=GroupStatus.IGNORED,
#             substatus=GroupSubStatus.FOREVER,
#             first_seen=now - timedelta(days=2),
#             data={"metadata": {"message": "This is an ignored feedback"}},
#         )

#     @patch(
#         "sentry.feedback.usecases.feedback_summaries.generate_summary",
#         side_effect=create_dummy_summary_response,
#     )
#     def test_get_feedback_summary_basic(self, mock_generate_summary):
#         """Test getting feedback summary with default parameters (7 days)"""
#         response = self.get_success_response(self.org.slug)

#         print("this is the print statement", response.data)

#         assert response.data["success"] is True
#         assert response.data["summary"] == "Test summary of feedback"
#         assert response.data["num_feedbacks_used"] == 15  # All feedbacks within 7 days

#     @patch(
#         "sentry.feedback.usecases.feedback_summaries.generate_summary",
#         side_effect=create_dummy_summary_response,
#     )
#     def test_get_feedback_summary_with_date_filter(self, mock_generate_summary):
#         """Test getting feedback summary with specific date range"""
#         now = datetime.now(timezone.utc)
#         params = {
#             "statsPeriod": "2d",  # Only look at last 2 days
#         }

#         response = self.get_success_response(self.org.slug, **params)

#         assert response.data["success"] is True
#         assert response.data["summary"] == "Test summary of feedback"
#         # Should have fewer feedbacks since we're only looking at 2 days
#         assert response.data["num_feedbacks_used"] < 15

#     def test_get_feedback_summary_too_few_feedbacks(self):
#         """Test getting summary when there are fewer than 10 feedbacks"""
#         # Delete most feedbacks to get below threshold
#         for feedback in self.feedbacks[10:]:
#             feedback.delete()

#         response = self.get_success_response(self.org.slug)

#         assert response.data["summary"] is None
#         assert response.data["sucesss"] is False
#         assert response.data["num_feedbacks_used"] == 0

#     @patch(
#         "sentry.feedback.usecases.feedback_summaries.generate_summary",
#         side_effect=Exception("LLM Error"),
#     )
#     def test_get_feedback_summary_llm_error(self, mock_generate_summary):
#         """Test handling of LLM errors"""
#         response = self.get_error_response(self.org.slug, status_code=500)
#         assert response.data["detail"] == "Error generating summary"

#     def test_get_feedback_summary_invalid_date_range(self):
#         """Test handling of invalid date range parameters"""
#         params = {
#             "start": "invalid-date",
#             "end": "also-invalid",
#         }
#         response = self.get_error_response(self.org.slug, status_code=400, **params)
#         assert "start and end are" in response.data["detail"]

#     @patch(
#         "sentry.feedback.usecases.feedback_summaries.generate_summary",
#         side_effect=create_dummy_summary_response,
#     )
#     def test_get_feedback_summary_character_limit(self, mock_generate_summary):
#         """Test that feedback messages don't exceed character limit"""
#         # Create a feedback with very long message
#         long_message = "a" * 1000000  # 1M characters
#         self.create_group(
#             project=self.project,
#             type=FeedbackGroup.type_id,
#             message="Long feedback",
#             status=GroupStatus.UNRESOLVED,
#             substatus=GroupSubStatus.NEW,
#             first_seen=datetime.now(timezone.utc),
#             data={"metadata": {"message": long_message}},
#         )

#         response = self.get_success_response(self.org.slug)

#         assert response.data["success"] is True
#         assert response.data["summary"] == "Test summary of feedback"
#         # The number of feedbacks used should be limited due to character limit
#         assert response.data["num_feedbacks_used"] < len(self.feedbacks) + 1

#     @patch(
#         "sentry.feedback.usecases.feedback_summaries.generate_summary",
#         side_effect=create_dummy_summary_response,
#     )
#     def test_get_feedback_summary_with_project_filter(self, mock_generate_summary):
#         """Test getting feedback summary filtered by project"""
#         # Create feedback in project2
#         now = datetime.now(timezone.utc)
#         project2_feedback = self.create_group(
#             project=self.project2,
#             type=FeedbackGroup.type_id,
#             message="Project 2 feedback",
#             status=GroupStatus.UNRESOLVED,
#             substatus=GroupSubStatus.NEW,
#             first_seen=now - timedelta(days=1),
#             data={"metadata": {"message": "This is feedback from project 2"}},
#         )

#         response = self.get_success_response(self.org.slug, project=[self.project2.id])

#         assert response.data["success"] is True
#         assert response.data["summary"] is None  # Only one feedback in project2, below threshold
#         assert response.data["num_feedbacks_used"] == 0

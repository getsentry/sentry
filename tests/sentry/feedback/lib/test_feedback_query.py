import pytest
from snuba_sdk import Column, Condition, Entity, Op, Query

from sentry.feedback.lib.query import (
    _get_ai_labels_from_tags,
    execute_query,
    query_given_labels_by_feedback_count,
    query_recent_feedbacks_with_ai_labels,
    query_top_ai_labels_by_feedback_count,
)
from sentry.feedback.usecases.label_generation import AI_LABEL_TAG_PREFIX
from sentry.issues.grouptype import FeedbackGroup
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.pytest.fixtures import django_db_all
from tests.sentry.issues.test_utils import SearchIssueTestMixin


@django_db_all
class TestFeedbackQuery(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.organization = self.project.organization

    def test_get_ai_labels_from_tags_retrieves_labels_correctly(self):
        """Test that _get_ai_labels_from_tags correctly retrieves AI labels from issues."""
        self.store_search_issue(
            project_id=self.project.id,
            user_id=1,
            fingerprints=["test-fingerprint"],
            tags=[
                (f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface"),
                (f"{AI_LABEL_TAG_PREFIX}.label.1", "Performance"),
                (f"{AI_LABEL_TAG_PREFIX}.label.2", "Authentication"),
            ],
            override_occurrence_data={"type": FeedbackGroup.type_id},  # FeedbackGroup type_id
        )

        # Create a query using the function to retrieve AI labels
        query = Query(
            match=Entity(Dataset.IssuePlatform.value),
            select=[
                _get_ai_labels_from_tags(alias="labels"),
            ],
            where=[
                Condition(Column("project_id"), Op.EQ, self.project.id),
                Condition(Column("timestamp"), Op.GTE, before_now(days=1)),
                Condition(Column("timestamp"), Op.LT, before_now(days=-1)),
                Condition(Column("occurrence_type_id"), Op.EQ, FeedbackGroup.type_id),
            ],
        )

        result = execute_query(
            query=query,
            tenant_id={"organization_id": self.organization.id},
            referrer="replays.query.viewed_by_query",  # TODO: Change this
        )

        assert len(result["data"]) == 1
        assert set(result["data"][0]["labels"]) == {
            "User Interface",
            "Performance",
            "Authentication",
        }

    def test_query_top_ai_labels_by_feedback_count(self):
        """Test that query_top_ai_labels_by_feedback_count correctly returns top labels by count."""
        # Create multiple feedback issues with different AI labels
        # Create 3 feedbacks with "User Interface" label
        for i in range(3):
            self.store_search_issue(
                project_id=self.project.id,
                user_id=1,
                fingerprints=[f"ui-feedback-{i}"],
                tags=[
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface"),
                ],
                override_occurrence_data={"type": FeedbackGroup.type_id},
            )

        for i in range(2):
            self.store_search_issue(
                project_id=self.project.id,
                user_id=1,
                fingerprints=[f"perf-feedback-{i}"],
                tags=[
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance"),
                ],
                override_occurrence_data={"type": FeedbackGroup.type_id},
            )

        self.store_search_issue(
            project_id=self.project.id,
            user_id=1,
            fingerprints=["auth-feedback"],
            tags=[
                (f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication"),
            ],
            override_occurrence_data={"type": FeedbackGroup.type_id},
        )

        self.store_search_issue(
            project_id=self.project.id,
            user_id=1,
            fingerprints=["multi-feedback"],
            tags=[
                (f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface"),
                (f"{AI_LABEL_TAG_PREFIX}.label.1", "Performance"),
            ],
            override_occurrence_data={"type": FeedbackGroup.type_id},
        )

        # Query for top 5 labels
        result = query_top_ai_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(minutes=-1),
            count=5,
        )

        # Verify the results are ordered by count (descending)
        assert len(result) == 3  # Should have 3 unique labels

        assert result[0]["tags_value"] == "User Interface"
        assert result[0]["count"] == 4

        assert result[1]["tags_value"] == "Performance"
        assert result[1]["count"] == 3

        assert result[2]["tags_value"] == "Authentication"
        assert result[2]["count"] == 1

        result_single = query_top_ai_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(minutes=-1),
            count=1,
        )

        assert len(result_single) == 1
        assert result_single[0]["tags_value"] == "User Interface"
        assert result_single[0]["count"] == 4

        # Test edge case: query with no feedbacks in time range should return empty
        result_empty = query_top_ai_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=30),
            end=before_now(days=29),
            count=5,
        )

        assert len(result_empty) == 0

        # Test edge case: query with non-existent project should return empty
        result_no_project = query_top_ai_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[99999],  # Non-existent project
            start=before_now(days=1),
            end=before_now(minutes=-1),
            count=5,
        )

        assert len(result_no_project) == 0

    def test_query_recent_feedbacks_with_ai_labels(self):
        """Test that query_recent_feedbacks_with_ai_labels correctly returns recent feedbacks with AI labels."""
        feedback_data = [
            {
                "fingerprint": "feedback-1",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
                "contexts": {"feedback": {"message": "The UI is too slow"}},
            },
            {
                "fingerprint": "feedback-2",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance")],
                "contexts": {"feedback": {"message": "The app crashes frequently"}},
            },
            {
                "fingerprint": "feedback-3",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Security"),
                ],
                "contexts": {"feedback": {"message": "Login doesn't work properly"}},
            },
            {
                "fingerprint": "feedback-4",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
                "contexts": {"feedback": {"message": "Button colors are hard to see"}},
            },
        ]

        # Create the feedback issues
        for data in feedback_data:
            self.store_search_issue(
                project_id=self.project.id,
                user_id=1,
                fingerprints=[data["fingerprint"]],
                tags=data["tags"],
                event_data={"contexts": data["contexts"]},
                override_occurrence_data={"type": FeedbackGroup.type_id},
            )

        # Query for recent feedbacks with AI labels
        result = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(days=-1),
            count=10,
        )

        # Verify that we get the expected number of feedbacks
        assert len(result) == 4

        # Verify that each feedback has labels and a feedback message
        for feedback in result:
            assert "labels" in feedback
            assert "feedback" in feedback
            assert isinstance(feedback["labels"], list)
            assert isinstance(feedback["feedback"], str)
            assert len(feedback["labels"]) > 0  # Should have at least one AI label

        # Verify specific feedback content
        feedback_messages = [f["feedback"] for f in result]
        assert "The UI is too slow" in feedback_messages
        assert "The app crashes frequently" in feedback_messages
        assert "Login doesn't work properly" in feedback_messages
        assert "Button colors are hard to see" in feedback_messages

        # Verify that feedbacks with multiple labels are handled correctly
        multi_label_feedback = next(f for f in result if len(f["labels"]) > 1)
        assert set(multi_label_feedback["labels"]) == {"Authentication", "Security"}

        # Test edge case: query with count=2 should return only the 2 most recent feedbacks
        result_limited = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(days=-1),
            count=2,
        )

        assert len(result_limited) == 2

        # Test edge case: query with no feedbacks in time range should return empty
        result_empty = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=30),
            end=before_now(days=29),
            count=10,
        )

        assert len(result_empty) == 0

        # Test edge case: query with non-existent project should return empty
        result_no_project = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[99999],  # Non-existent project
            start=before_now(days=1),
            end=before_now(days=-1),
            count=10,
        )

        assert len(result_no_project) == 0

    def test_query_given_labels_by_feedback_count(self):
        """Test that query_given_labels_by_feedback_count correctly returns feedback counts for label groups."""
        # Create multiple feedback issues with different AI labels
        feedback_data = [
            {
                "fingerprint": "feedback-1",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
            },
            {
                "fingerprint": "feedback-2",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance")],
            },
            {
                "fingerprint": "feedback-3",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Security"),
                ],
            },
            {
                "fingerprint": "feedback-4",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
            },
            {
                "fingerprint": "feedback-5",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance")],
            },
            {
                "fingerprint": "feedback-6",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Performance"),
                ],
            },
            {
                "fingerprint": "feedback-7",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication")],
            },
        ]

        # Create the feedback issues
        for data in feedback_data:
            self.store_search_issue(
                project_id=self.project.id,
                user_id=1,
                fingerprints=[data["fingerprint"]],
                tags=data["tags"],
                override_occurrence_data={"type": FeedbackGroup.type_id},
            )

        # Define label groups to test
        # Group 0: ["User Interface", "Performance"] - should count feedbacks 1, 2, 4, 5, 6 (5 total)
        # Group 1: ["Authentication", "Security"] - should count feedbacks 3, 7 (2 total)
        # Group 2: ["User Interface"] - should count feedbacks 1, 4, 6 (3 total)
        label_groups = [
            ["User Interface", "Performance"],
            ["Authentication", "Security"],
            ["User Interface"],
        ]

        # Query for feedback counts by label groups
        result = query_given_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(days=-1),
            labels_groups=label_groups,
        )

        # Verify that we get exactly one row with the expected columns
        assert len(result) == 1
        row = result[0]

        # Verify that the expected columns exist
        assert "count_if_0" in row
        assert "count_if_1" in row
        assert "count_if_2" in row

        # Verify the counts for each label group
        # Group 0: ["User Interface", "Performance"] - should count 5 feedbacks
        assert row["count_if_0"] == 5

        # Group 1: ["Authentication", "Security"] - should count 2 feedbacks
        assert row["count_if_1"] == 2

        # Group 2: ["User Interface"] - should count 3 feedbacks
        assert row["count_if_2"] == 3

        # Test edge case: empty label groups should throw a ValueError
        with pytest.raises(ValueError):
            query_given_labels_by_feedback_count(
                organization_id=self.organization.id,
                project_ids=[self.project.id],
                start=before_now(days=1),
                end=before_now(days=-1),
                labels_groups=[],
            )

        # Test edge case: label groups with no matching feedbacks
        no_match_result = query_given_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(days=-1),
            labels_groups=[["NonExistentLabel"]],
        )

        assert len(no_match_result) == 1
        assert no_match_result[0]["count_if_0"] == 0

        # Test edge case: query with no feedbacks in time range should return 0
        empty_time_result = query_given_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=30),
            end=before_now(days=29),
            labels_groups=label_groups,
        )

        assert len(empty_time_result) == 1
        assert empty_time_result[0]["count_if_0"] == 0
        assert empty_time_result[0]["count_if_1"] == 0
        assert empty_time_result[0]["count_if_2"] == 0

        # Test edge case: query with non-existent project should return 0
        no_project_result = query_given_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[99999],  # Non-existent project
            start=before_now(days=1),
            end=before_now(days=-1),
            labels_groups=label_groups,
        )

        assert len(no_project_result) == 1
        assert no_project_result[0]["count_if_0"] == 0
        assert no_project_result[0]["count_if_1"] == 0
        assert no_project_result[0]["count_if_2"] == 0

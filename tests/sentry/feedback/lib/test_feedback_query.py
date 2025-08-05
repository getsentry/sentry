from typing import Any, TypedDict

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


class FeedbackData(TypedDict):
    fingerprint: str
    tags: list[tuple[str, str]]
    contexts: dict[str, Any]


@django_db_all
class TestFeedbackQuery(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.organization = self.project.organization
        self._create_standard_feedbacks()

    def _create_standard_feedbacks(self):
        """Create a standard set of feedbacks for all tests to use."""
        feedback_data: list[FeedbackData] = [
            {
                "fingerprint": "feedback-1",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
                "contexts": {"feedback": {"message": "The UI is too slow and confusing"}},
            },
            {
                "fingerprint": "feedback-2",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance")],
                "contexts": {
                    "feedback": {"message": "The app crashes frequently when loading data"}
                },
            },
            {
                "fingerprint": "feedback-3",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Security"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.2", "User Interface"),
                ],
                "contexts": {
                    "feedback": {"message": "Login doesn't work properly and feels insecure"}
                },
            },
            {
                "fingerprint": "feedback-4",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface")],
                "contexts": {
                    "feedback": {
                        "message": "Button colors are hard to see and need better contrast"
                    }
                },
            },
            {
                "fingerprint": "feedback-5",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "Performance")],
                "contexts": {"feedback": {"message": "Page load times are too slow"}},
            },
            {
                "fingerprint": "feedback-6",
                "tags": [
                    (f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface"),
                    (f"{AI_LABEL_TAG_PREFIX}.label.1", "Performance"),
                ],
                "contexts": {
                    "feedback": {"message": "The interface is slow and the design is confusing"}
                },
            },
            {
                "fingerprint": "feedback-7",
                "tags": [(f"{AI_LABEL_TAG_PREFIX}.label.0", "Authentication")],
                "contexts": {"feedback": {"message": "Password reset functionality is broken"}},
            },
        ]

        for data in feedback_data:
            self.store_search_issue(
                project_id=self.project.id,
                user_id=1,
                fingerprints=[data["fingerprint"]],
                tags=data["tags"],
                event_data={"contexts": data["contexts"]},
                override_occurrence_data={"type": FeedbackGroup.type_id},
            )

    def test_get_ai_labels_from_tags_retrieves_labels_correctly(self):
        """Test that _get_ai_labels_from_tags correctly retrieves AI labels from issues."""
        # Create a query using the function to retrieve AI labels
        query = Query(
            match=Entity(Dataset.IssuePlatform.value),
            select=[
                _get_ai_labels_from_tags(alias="labels"),
            ],
            where=[
                Condition(Column("project_id"), Op.EQ, self.project.id),
                Condition(Column("timestamp"), Op.GTE, before_now(days=1)),
                Condition(Column("timestamp"), Op.LT, before_now(minutes=-1)),
                Condition(Column("occurrence_type_id"), Op.EQ, FeedbackGroup.type_id),
            ],
        )

        result = execute_query(
            query=query,
            tenant_id={"organization_id": self.organization.id},
            referrer="replays.query.viewed_by_query",  # TODO: Change this
        )

        assert len(result["data"]) == 7
        all_labels = set()
        for row in result["data"]:
            all_labels.update(row["labels"])

        expected_labels = {
            "User Interface",
            "Performance",
            "Authentication",
            "Security",
        }
        assert all_labels == expected_labels

    def test_query_top_ai_labels_by_feedback_count(self):
        """Test that query_top_ai_labels_by_feedback_count correctly returns top labels by count."""
        # Query for top 5 labels using our standard feedbacks
        result = query_top_ai_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(minutes=-1),
            count=5,
        )

        assert len(result) == 4

        assert result[0]["tags_value"] == "User Interface"
        assert result[0]["count"] == 4

        assert result[1]["tags_value"] == "Performance"
        assert result[1]["count"] == 3

        assert result[2]["tags_value"] == "Authentication"
        assert result[2]["count"] == 2

        assert result[3]["tags_value"] == "Security"
        assert result[3]["count"] == 1

        # Test with count=1 should return only the top label
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

        # Query with no feedbacks in time range should return empty
        result_empty = query_top_ai_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=30),
            end=before_now(days=29),
            count=5,
        )

        assert len(result_empty) == 0

        # Query with non-existent project should return empty
        result_no_project = query_top_ai_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id + 1],  # Non-existent project
            start=before_now(days=1),
            end=before_now(minutes=-1),
            count=5,
        )

        assert len(result_no_project) == 0

    def test_query_recent_feedbacks_with_ai_labels(self):
        """Test that query_recent_feedbacks_with_ai_labels correctly returns recent feedbacks with AI labels."""
        result = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(minutes=-1),
            count=10,
        )

        assert len(result) == 7

        # Verify that each feedback has labels and a feedback message
        for feedback in result:
            assert "labels" in feedback
            assert "feedback" in feedback
            assert isinstance(feedback["labels"], list)
            assert isinstance(feedback["feedback"], str)
            assert len(feedback["labels"]) > 0

        feedback_messages = [f["feedback"] for f in result]
        assert "The UI is too slow and confusing" in feedback_messages
        assert "The app crashes frequently when loading data" in feedback_messages
        assert "Login doesn't work properly and feels insecure" in feedback_messages
        assert "Button colors are hard to see and need better contrast" in feedback_messages
        assert "Page load times are too slow" in feedback_messages
        assert "The interface is slow and the design is confusing" in feedback_messages
        assert "Password reset functionality is broken" in feedback_messages

        # Query with count=2 should return only the 2 most recent feedbacks
        result_limited = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(minutes=-1),
            count=2,
        )

        assert len(result_limited) == 2

        # Query with no feedbacks in time range should return empty
        result_empty = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=30),
            end=before_now(days=29),
            count=10,
        )

        assert len(result_empty) == 0

        # Query with non-existent project should return empty
        result_no_project = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[self.project.id + 1],  # Non-existent project
            start=before_now(days=1),
            end=before_now(minutes=-1),
            count=10,
        )

        assert len(result_no_project) == 0

    def test_query_given_labels_by_feedback_count(self):
        """Test that query_given_labels_by_feedback_count correctly returns feedback counts for label groups."""
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
            end=before_now(minutes=-1),
            labels_groups=label_groups,
        )

        assert len(result) == 1
        row = result[0]

        assert "count_if_0" in row
        assert "count_if_1" in row
        assert "count_if_2" in row

        # Group 0: ["User Interface", "Performance"]
        assert row["count_if_0"] == 6

        # Group 1: ["Authentication", "Security"]
        assert row["count_if_1"] == 2

        # Group 2: ["User Interface"]
        assert row["count_if_2"] == 4

        # Empty label groups should throw a ValueError
        with pytest.raises(ValueError):
            query_given_labels_by_feedback_count(
                organization_id=self.organization.id,
                project_ids=[self.project.id],
                start=before_now(days=1),
                end=before_now(minutes=-1),
                labels_groups=[],
            )

        # Label groups with no matching feedbacks
        no_match_result = query_given_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(minutes=-1),
            labels_groups=[["NonExistentLabel"]],
        )

        assert len(no_match_result) == 1
        assert no_match_result[0]["count_if_0"] == 0

        # Query with no feedbacks in time range should return 0
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

        # Query with non-existent project should return 0
        no_project_result = query_given_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id + 1],  # Non-existent project
            start=before_now(days=1),
            end=before_now(minutes=-1),
            labels_groups=label_groups,
        )

        assert len(no_project_result) == 1
        assert no_project_result[0]["count_if_0"] == 0
        assert no_project_result[0]["count_if_1"] == 0
        assert no_project_result[0]["count_if_2"] == 0

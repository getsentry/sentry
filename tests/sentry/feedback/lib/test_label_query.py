from typing import int
from datetime import datetime

import pytest
from snuba_sdk import Column, Condition, Direction, Entity, Op, OrderBy, Query, Request

from sentry.feedback.lib.label_query import (
    _get_ai_labels_from_tags,
    query_label_group_counts,
    query_recent_feedbacks_with_ai_labels,
    query_top_ai_labels_by_feedback_count,
)
from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.create_feedback import create_feedback_issue
from sentry.feedback.usecases.label_generation import AI_LABEL_TAG_PREFIX
from sentry.issues.grouptype import FeedbackGroup
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import raw_snql_query
from tests.sentry.feedback import mock_feedback_event


class TestLabelQuery(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.organization = self.project.organization

    def _create_feedback(self, message: str, labels: list[str], dt: datetime | None = None) -> None:
        tags = {f"{AI_LABEL_TAG_PREFIX}.label.{i}": labels[i] for i in range(len(labels))}
        event = mock_feedback_event(
            self.project.id,
            message=message,
            tags=tags,
            dt=dt,
        )
        create_feedback_issue(event, self.project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    def test_get_ai_labels_from_tags_retrieves_labels_correctly(self) -> None:
        self._create_feedback(
            "a",
            ["Authentication"],
            dt=before_now(days=2),
        )
        self._create_feedback(
            "b",
            ["Authentication", "Security"],
            dt=before_now(days=1),
        )

        query = Query(
            match=Entity(Dataset.IssuePlatform.value),
            select=[
                _get_ai_labels_from_tags(alias="labels"),
            ],
            where=[
                Condition(Column("project_id"), Op.EQ, self.project.id),
                Condition(Column("timestamp"), Op.GTE, before_now(days=30)),
                Condition(Column("timestamp"), Op.LT, before_now(days=0)),
                Condition(Column("occurrence_type_id"), Op.EQ, FeedbackGroup.type_id),
            ],
            orderby=[OrderBy(Column("timestamp"), Direction.ASC)],
        )

        result = raw_snql_query(
            Request(
                dataset=Dataset.IssuePlatform.value,
                app_id="feedback-backend-web",
                query=query,
                tenant_ids={"organization_id": self.organization.id},
            ),
            referrer="feedbacks.label_query",
        )

        assert len(result["data"]) == 2
        assert {label for label in result["data"][0]["labels"]} == {"Authentication"}
        assert {label for label in result["data"][1]["labels"]} == {"Authentication", "Security"}

    def test_query_top_ai_labels_by_feedback_count(self) -> None:
        self._create_feedback(
            "UI issue 1",
            ["User Interface", "Performance"],
        )
        self._create_feedback(
            "UI issue 2",
            ["Checkout", "User Interface"],
        )
        self._create_feedback(
            "UI issue 3",
            ["Performance", "User Interface", "Colors"],
        )

        result = query_top_ai_labels_by_feedback_count(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(days=0),
            limit=3,
        )

        assert len(result) == 3

        assert result[0]["label"] == "User Interface"
        assert result[0]["count"] == 3

        assert result[1]["label"] == "Performance"
        assert result[1]["count"] == 2

        assert result[2]["label"] == "Checkout" or result[2]["label"] == "Colors"
        assert result[2]["count"] == 1

    def test_query_recent_feedbacks_with_ai_labels(self) -> None:
        self._create_feedback(
            "The UI is too slow and confusing",
            ["User Interface"],
            dt=before_now(days=3),
        )
        self._create_feedback(
            "The app crashes frequently when loading data",
            ["Performance"],
            dt=before_now(days=2),
        )
        self._create_feedback(
            "Hello",
            [],
            dt=before_now(days=1),
        )

        result = query_recent_feedbacks_with_ai_labels(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=30),
            end=before_now(days=0),
            limit=1,
        )

        assert result[0] == {
            "feedback": "The app crashes frequently when loading data",
            "labels": ["Performance"],
        }

    def test_query_label_group_counts(self) -> None:
        self._create_feedback("a", ["User Interface", "Performance"])
        self._create_feedback("b", ["Performance", "Authentication"])
        self._create_feedback("c", ["Authentication", "Security"])

        label_groups_to_expected_result = {
            ("User Interface",): 1,
            ("Performance",): 2,
            ("Security",): 1,
            ("User Interface", "Performance"): 2,
            ("Performance", "Security"): 3,
            ("Authentication", "Performance", "User Interface"): 3,
            ("Performance", "Authentication", "Security"): 3,
            ("hello",): 0,
            ("Performance", "hello"): 2,
        }

        # Query for feedback counts by label groups
        result = query_label_group_counts(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=before_now(days=1),
            end=before_now(days=0),
            labels_groups=[list(g) for g in label_groups_to_expected_result],
        )

        assert len(result) == len(label_groups_to_expected_result)
        for i, group in enumerate(label_groups_to_expected_result.keys()):
            assert result[i] == label_groups_to_expected_result[group]

        # Empty label groups should throw a ValueError
        with pytest.raises(ValueError):
            query_label_group_counts(
                organization_id=self.organization.id,
                project_ids=[self.project.id],
                start=before_now(days=1),
                end=before_now(days=0),
                labels_groups=[],
            )

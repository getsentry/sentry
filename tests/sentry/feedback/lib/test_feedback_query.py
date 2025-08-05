from snuba_sdk import Column, Condition, Entity, Op, Query

from sentry.feedback.lib.query import _get_ai_labels_from_tags, execute_query
from sentry.feedback.usecases.label_generation import AI_LABEL_TAG_PREFIX
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
        # Create an issue with AI labels using the SearchIssueTestMixin
        self.store_search_issue(
            project_id=self.project.id,
            user_id=1,
            fingerprints=["test-fingerprint"],
            tags=[
                (f"{AI_LABEL_TAG_PREFIX}.label.0", "User Interface"),
                (f"{AI_LABEL_TAG_PREFIX}.label.1", "Performance"),
                (f"{AI_LABEL_TAG_PREFIX}.label.2", "Authentication"),
            ],
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
            ],
        )

        # Execute the query
        result = execute_query(
            query=query,
            tenant_id={"organization_id": self.organization.id},
            referrer="replays.query.viewed_by_query",  # TODO: Change this
        )

        # print("\n\n\n\n RESULT", result, "\n\n\n\n")

        assert len(result["data"]) == 1
        assert set(result["data"][0]["labels"]) == {
            "User Interface",
            "Performance",
            "Authentication",
        }

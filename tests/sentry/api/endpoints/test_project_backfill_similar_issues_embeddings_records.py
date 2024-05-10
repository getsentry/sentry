from unittest.mock import patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class ProjectBackfillSimilarIssuesEmbeddingsRecordsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            "sentry-api-0-project-backfill-similar-embeddings-records",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_post_no_feature_flag(self):
        response = self.client.post(self.url, data={})
        assert response.status_code == 404, response.content

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=False,
    )
    def test_post_not_superuser(self, mock_is_active_superuser):
        response = self.client.post(self.url, data={})
        assert response.status_code == 404, response.content

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records.delay"
    )
    @with_feature("projects:similarity-embeddings-grouping")
    def test_post_success_no_last_processed_id(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(self.url, data={})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(self.project.id, None)

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records.delay"
    )
    @with_feature("projects:similarity-embeddings-grouping")
    def test_post_success_last_processed_id(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(self.url, data={"last_processed_id": "8"})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(self.project.id, 8)

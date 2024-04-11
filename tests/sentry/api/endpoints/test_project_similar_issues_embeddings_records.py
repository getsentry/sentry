from unittest.mock import patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class ProjectSimilarIssuesEmbeddingsRecords(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            "sentry-api-0-project-similar-embeddings-records",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_post_no_feature_flag(self):
        response = self.client.post(self.url, data={})
        assert response.status_code == 404, response.content

    @with_feature("projects:similarity-embeddings-grouping")
    @patch(
        "sentry.api.endpoints.project_similar_issues_embeddings_records.backfill_seer_grouping_records.delay"
    )
    def test_post_success(self, mock_backfill_seer_grouping_records):
        response = self.client.post(self.url, data={})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(self.project)

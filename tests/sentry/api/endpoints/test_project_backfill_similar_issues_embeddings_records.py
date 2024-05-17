from unittest.mock import patch

from django.test import override_settings
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
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
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
    @with_feature("projects:similarity-embeddings-backfill")
    def test_post_success_no_last_processed_index(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(self.url, data={})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(self.project.id, None, False)

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records.delay"
    )
    @with_feature("projects:similarity-embeddings-backfill")
    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    def test_post_success_no_last_processed_index_single_org(
        self, mock_backfill_seer_grouping_records
    ):
        response = self.client.post(self.url, data={})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(self.project.id, None, False)

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records.delay"
    )
    @with_feature("projects:similarity-embeddings-backfill")
    def test_post_success_last_processed_index(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(self.url, data={"last_processed_index": "8"})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(self.project.id, 8, False)

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records.delay"
    )
    @with_feature("projects:similarity-embeddings-backfill")
    def test_post_success_dry_run(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(self.url, data={"last_processed_index": "8", "dry_run": "true"})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(self.project.id, 8, True)

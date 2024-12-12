from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase


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
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records_for_project.delay"
    )
    def test_post_success_no_last_processed_id(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(self.url, data={})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(
            current_project_id=self.project.id,
            last_processed_group_id_input=None,
            only_delete=False,
            enable_ingestion=False,
            skip_processed_projects=True,
            skip_project_ids=None,
        )

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records_for_project.delay"
    )
    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    def test_post_success_no_last_processed_id_single_org(
        self, mock_backfill_seer_grouping_records
    ):
        response = self.client.post(self.url, data={})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(
            current_project_id=self.project.id,
            last_processed_group_id_input=None,
            only_delete=False,
            enable_ingestion=False,
            skip_processed_projects=True,
            skip_project_ids=None,
        )

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records_for_project.delay"
    )
    def test_post_success_last_processed_id(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(self.url, data={"last_processed_id": "8"})
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(
            current_project_id=self.project.id,
            last_processed_group_id_input=8,
            only_delete=False,
            enable_ingestion=False,
            skip_processed_projects=True,
            skip_project_ids=None,
        )

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records_for_project.delay"
    )
    def test_post_success_only_delete(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(
            self.url, data={"last_processed_id": "8", "only_delete": "true"}
        )
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(
            current_project_id=self.project.id,
            last_processed_group_id_input=8,
            only_delete=True,
            enable_ingestion=False,
            skip_processed_projects=True,
            skip_project_ids=None,
        )

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records_for_project.delay"
    )
    def test_post_success_enable_ingestion(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(
            self.url, data={"last_processed_id": "8", "enable_ingestion": "true"}
        )
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(
            current_project_id=self.project.id,
            last_processed_group_id_input=8,
            only_delete=False,
            enable_ingestion=True,
            skip_processed_projects=True,
            skip_project_ids=None,
        )

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records_for_project.delay"
    )
    def test_post_success_skip_processed_projects(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(
            self.url, data={"last_processed_id": "8", "reprocess_backfilled_projects": "true"}
        )
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(
            current_project_id=self.project.id,
            last_processed_group_id_input=8,
            only_delete=False,
            enable_ingestion=False,
            # reprocess_backfilled_projects changes the default
            skip_processed_projects=False,
            skip_project_ids=None,
        )

    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.is_active_superuser",
        return_value=True,
    )
    @patch(
        "sentry.api.endpoints.project_backfill_similar_issues_embeddings_records.backfill_seer_grouping_records_for_project.delay"
    )
    def test_post_success_skip_project_ids(
        self, mock_backfill_seer_grouping_records, mock_is_active_superuser
    ):
        response = self.client.post(
            self.url, data={"last_processed_id": "8", "skip_project_ids": [1]}
        )
        assert response.status_code == 204, response.content
        mock_backfill_seer_grouping_records.assert_called_with(
            current_project_id=self.project.id,
            last_processed_group_id_input=8,
            only_delete=False,
            enable_ingestion=False,
            skip_processed_projects=True,
            skip_project_ids=[1],
        )

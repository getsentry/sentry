from unittest.mock import patch

from django.urls import reverse
from rest_framework import status

from sentry.testutils.cases import APITestCase


class TestProjectAutofixCodebaseIndexStatus(APITestCase):
    endpoint = "sentry-api-0-project-autofix-codebase-index-status"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

    @patch(
        "sentry.api.endpoints.project_autofix_codebase_index_status.get_project_codebase_indexing_status",
        return_value="up_to_date",
    )
    def test_autofix_codebase_status_up_to_date(self, mock_get_project_codebase_indexing_status):
        response = self.client.get(
            self.url,
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"status": "up_to_date"}

    @patch(
        "sentry.api.endpoints.project_autofix_codebase_index_status.get_project_codebase_indexing_status",
        return_value="indexing",
    )
    def test_autofix_codebase_status_indexing(self, mock_get_project_codebase_indexing_status):
        response = self.client.get(
            self.url,
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"status": "indexing"}

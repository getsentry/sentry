from typing import int
from unittest.mock import MagicMock, patch

from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
class SearchAgentTranslateEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = f"/api/0/organizations/{self.organization.slug}/search-agent/translate/"

        self.seer_access_patcher = patch(
            "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.has_seer_access_with_detail",
            return_value=(True, None),
        )
        self.seer_access_patcher.start()

    def tearDown(self) -> None:
        self.seer_access_patcher.stop()
        super().tearDown()

    @patch(
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.send_translate_agentic_request"
    )
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_translate_successful(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = {"query": "transaction.duration:>1000", "status": "ok"}

        response = self.client.post(
            self.url,
            data={
                "project_ids": [self.project.id],
                "natural_language_query": "Find slow transactions",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"query": "transaction.duration:>1000", "status": "ok"}

        mock_send_request.assert_called_once_with(
            self.organization.id,
            self.organization.slug,
            [self.project.id],
            "Find slow transactions",
            strategy="Traces",
            model_name=None,
        )

    def test_translate_missing_parameters(self) -> None:
        response = self.client.post(
            self.url,
            data={
                "project_ids": [],
                "natural_language_query": "",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "project_ids" in response.data
        assert "natural_language_query" in response.data

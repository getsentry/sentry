from typing import int
from unittest.mock import MagicMock, patch

import orjson
from django.conf import settings
from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
class TestOrganizationSeerExplorerUpdate(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/123/"

    @patch("sentry.seer.endpoints.organization_seer_explorer_update.get_seer_org_acknowledgement")
    @patch("sentry.seer.endpoints.organization_seer_explorer_update.requests.post")
    def test_explorer_update_successful(
        self, mock_post: MagicMock, mock_get_seer_org_acknowledgement: MagicMock
    ) -> None:
        mock_get_seer_org_acknowledgement.return_value = True
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"run_id": 123}

        response = self.client.post(
            self.url,
            data={
                "payload": {
                    "type": "interrupt",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data == {"run_id": 123}

        # Verify the request was made to Seer
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert f"{settings.SEER_AUTOFIX_URL}/v1/automation/explorer/update" in call_args[0]

        # Verify the payload
        sent_data = orjson.loads(call_args[1]["data"])
        assert sent_data["run_id"] == "123"
        assert sent_data["payload"]["type"] == "interrupt"

    @patch("sentry.seer.endpoints.organization_seer_explorer_update.get_seer_org_acknowledgement")
    @patch("sentry.seer.endpoints.organization_seer_explorer_update.requests.post")
    def test_explorer_update_missing_payload(
        self, mock_post: MagicMock, mock_get_seer_org_acknowledgement: MagicMock
    ) -> None:
        mock_get_seer_org_acknowledgement.return_value = True

        response = self.client.post(
            self.url,
            data={},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Need a body with a payload" in str(response.data)
        mock_post.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_explorer_update.get_seer_org_acknowledgement")
    def test_explorer_update_ai_features_hidden(
        self, mock_get_seer_org_acknowledgement: MagicMock
    ) -> None:
        mock_get_seer_org_acknowledgement.return_value = True
        self.organization.update_option("sentry:hide_ai_features", True)

        response = self.client.post(
            self.url,
            data={
                "payload": {
                    "type": "interrupt",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "AI features are disabled" in str(response.data)

    @patch("sentry.seer.endpoints.organization_seer_explorer_update.get_seer_org_acknowledgement")
    def test_explorer_update_no_seer_acknowledgement(
        self, mock_get_seer_org_acknowledgement: MagicMock
    ) -> None:
        mock_get_seer_org_acknowledgement.return_value = False

        response = self.client.post(
            self.url,
            data={
                "payload": {
                    "type": "interrupt",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Seer has not been acknowledged" in str(response.data)


class TestOrganizationSeerExplorerUpdateFeatureFlags(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/123/"

    @patch("sentry.seer.endpoints.organization_seer_explorer_update.get_seer_org_acknowledgement")
    def test_explorer_update_feature_flag_disabled(
        self, mock_get_seer_org_acknowledgement: MagicMock
    ) -> None:
        mock_get_seer_org_acknowledgement.return_value = True

        response = self.client.post(
            self.url,
            data={
                "payload": {
                    "type": "interrupt",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Feature flag not enabled" in str(response.data)

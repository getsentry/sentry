from datetime import datetime
from unittest.mock import patch

import orjson
from django.conf import settings
from rest_framework import status

from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.testutils.cases import APITestCase


class TestGroupAutofixUpdate(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.url = f"/api/0/issues/{self.group.id}/autofix/update/"

    @patch(
        "sentry.api.endpoints.group_autofix_update.get_seer_org_acknowledgement", return_value=True
    )
    @patch("sentry.api.endpoints.group_autofix_update.requests.post")
    def test_autofix_update_successful(self, mock_post, mock_get_seer_org_acknowledgement):
        mock_post.return_value.status_code = 202
        mock_post.return_value.json.return_value = {}

        response = self.client.post(
            self.url,
            data={
                "run_id": 123,
                "payload": {
                    "type": "select_root_cause",
                    "cause_id": 456,
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        expected_body = orjson.dumps(
            {
                "run_id": 123,
                "payload": {
                    "type": "select_root_cause",
                    "cause_id": 456,
                },
                "invoking_user": {
                    "id": self.user.id,
                    "display_name": self.user.get_display_name(),
                },
            }
        )
        expected_url = f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/update"
        expected_headers = {
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(expected_body),
        }
        mock_post.assert_called_once_with(
            expected_url,
            data=expected_body,
            headers=expected_headers,
        )

    @patch(
        "sentry.api.endpoints.group_autofix_update.get_seer_org_acknowledgement", return_value=True
    )
    @patch("sentry.api.endpoints.group_autofix_update.requests.post")
    def test_autofix_update_failure(self, mock_post, mock_get_seer_org_acknowledgement):
        mock_post.return_value.raise_for_status.side_effect = Exception("Failed to update")

        response = self.client.post(
            self.url,
            data={
                "run_id": 123,
                "payload": {
                    "type": "select_root_cause",
                    "cause_id": 456,
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @patch(
        "sentry.api.endpoints.group_autofix_update.get_seer_org_acknowledgement", return_value=True
    )
    def test_autofix_update_missing_parameters(self, mock_get_seer_org_acknowledgement):
        response = self.client.post(self.url, data={}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @patch(
        "sentry.api.endpoints.group_autofix_update.get_seer_org_acknowledgement", return_value=False
    )
    def test_autofix_update_org_not_acknowledged(self, mock_get_seer_org_acknowledgement):
        """Test that a 403 is returned when the organization hasn't acknowledged Seer."""
        response = self.client.post(
            self.url,
            data={
                "run_id": 123,
                "payload": {
                    "type": "select_root_cause",
                    "cause_id": 456,
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert (
            response.data["error"]
            == "Seer has not been enabled for this organization. Please open an issue at sentry.io/issues and set up Seer."
        )

    @patch(
        "sentry.api.endpoints.group_autofix_update.get_seer_org_acknowledgement", return_value=True
    )
    @patch("sentry.api.endpoints.group_autofix_update.requests.post")
    def test_autofix_update_updates_last_triggered_field(
        self, mock_post, mock_get_seer_org_acknowledgement
    ):
        """Test that a successful call updates the seer_autofix_last_triggered field."""
        mock_post.return_value.status_code = 202
        mock_post.return_value.json.return_value = {}

        self.group.refresh_from_db()
        assert self.group.seer_autofix_last_triggered is None

        response = self.client.post(
            self.url,
            data={
                "run_id": 456,
                "payload": {
                    "type": "some_update",
                    "data": "value",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_202_ACCEPTED

        self.group.refresh_from_db()
        assert isinstance(self.group.seer_autofix_last_triggered, datetime)

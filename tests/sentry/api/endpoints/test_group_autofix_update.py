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

    @patch("sentry.api.endpoints.group_autofix_update.requests.post")
    def test_autofix_update_successful(self, mock_post):
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

    @patch("sentry.api.endpoints.group_autofix_update.requests.post")
    def test_autofix_update_failure(self, mock_post):
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

    def test_autofix_update_missing_parameters(self):
        response = self.client.post(self.url, data={}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

from unittest.mock import patch

from django.conf import settings
from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.utils import json


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
                    "fix_id": 789,
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_post.assert_called_once_with(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/update",
            data=json.dumps(
                {
                    "run_id": 123,
                    "payload": {
                        "type": "select_root_cause",
                        "cause_id": 456,
                        "fix_id": 789,
                    },
                }
            ).encode("utf-8"),
            headers={"content-type": "application/json;charset=utf-8"},
        )

    @patch("sentry.api.endpoints.group_autofix_update.requests.post")
    def test_autofix_update_failure(self, mock_post):
        mock_post.return_value.raise_for_status.side_effect = Exception("Failed to update")

        response = self.client.post(
            self.url,
            data=json.dumps(
                {
                    "run_id": 123,
                    "payload": {
                        "type": "select_root_cause",
                        "cause_id": 456,
                        "fix_id": 789,
                    },
                }
            ).encode("utf-8"),
            format="json",
        )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_autofix_update_missing_parameters(self):
        response = self.client.post(self.url, data={}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

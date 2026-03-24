from datetime import datetime
from unittest.mock import MagicMock, patch

import orjson
from rest_framework import status

from sentry.testutils.cases import APITestCase


class TestGroupAutofixUpdate(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.url = (
            f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/autofix/update/"
        )

    @patch("sentry.seer.endpoints.group_autofix_update.make_signed_seer_api_request")
    def test_autofix_update_successful(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 202
        mock_request.return_value.json.return_value = {}

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
        mock_request.assert_called_once()
        body = orjson.loads(mock_request.call_args[0][2])
        assert body["run_id"] == 123
        assert body["payload"]["type"] == "select_root_cause"
        assert body["payload"]["cause_id"] == 456
        assert body["invoking_user"]["id"] == self.user.id
        assert body["organization_id"] == self.organization.id
        assert mock_request.call_args[0][1] == "/v1/automation/autofix/update"

    @patch("sentry.seer.endpoints.group_autofix_update.make_signed_seer_api_request")
    def test_autofix_update_failure(self, mock_request: MagicMock) -> None:
        mock_request.return_value.status = 500

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

    def test_autofix_update_missing_parameters(self) -> None:
        response = self.client.post(self.url, data={}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @patch("sentry.seer.endpoints.group_autofix_update.make_signed_seer_api_request")
    def test_autofix_update_updates_last_triggered_field(self, mock_request):
        """Test that a successful call updates the seer_autofix_last_triggered field."""
        mock_request.return_value.status = 202
        mock_request.return_value.json.return_value = {}

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

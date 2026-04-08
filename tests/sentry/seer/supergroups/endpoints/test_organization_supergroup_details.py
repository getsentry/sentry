from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import orjson

from sentry.testutils.cases import APITestCase


def mock_seer_response(data: dict[str, Any]) -> MagicMock:
    response = MagicMock()
    response.status = 200
    response.data = orjson.dumps(data)
    return response


class OrganizationSupergroupDetailsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-supergroup-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @patch(
        "sentry.seer.supergroups.endpoints.organization_supergroup_details.make_supergroups_get_request"
    )
    def test_get_supergroup_details(self, mock_seer):
        mock_seer.return_value = mock_seer_response(
            {"id": 1, "title": "NullPointerException in auth", "group_ids": [10, 20]}
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(self.organization.slug, "1")

        assert response.data["id"] == 1
        assert response.data["title"] == "NullPointerException in auth"
        assert response.data["group_ids"] == [10, 20]

    @patch(
        "sentry.seer.supergroups.endpoints.organization_supergroup_details.make_supergroups_get_request"
    )
    def test_rca_source_defaults_to_explorer(self, mock_seer):
        mock_seer.return_value = mock_seer_response({"id": 1, "title": "test"})

        with self.feature("organizations:top-issues-ui"):
            self.get_success_response(self.organization.slug, "1")

        body = mock_seer.call_args.args[0]
        assert body["rca_source"] == "EXPLORER"

    @patch(
        "sentry.seer.supergroups.endpoints.organization_supergroup_details.make_supergroups_get_request"
    )
    def test_rca_source_lightweight_when_flag_enabled(self, mock_seer):
        mock_seer.return_value = mock_seer_response({"id": 1, "title": "test"})

        with self.feature(
            {
                "organizations:top-issues-ui": True,
                "organizations:supergroups-lightweight-rca-clustering-read": True,
            }
        ):
            self.get_success_response(self.organization.slug, "1")

        body = mock_seer.call_args.args[0]
        assert body["rca_source"] == "LIGHTWEIGHT"

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import orjson

from sentry.models.group import GroupStatus
from sentry.testutils.cases import APITestCase


def mock_seer_response(data: dict[str, Any]) -> MagicMock:
    response = MagicMock()
    response.status = 200
    response.data = orjson.dumps(data)
    return response


class OrganizationSupergroupsByGroupEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-supergroups-by-group"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.unresolved_group = self.create_group(
            project=self.project, status=GroupStatus.UNRESOLVED
        )
        self.resolved_group = self.create_group(project=self.project, status=GroupStatus.RESOLVED)

    @patch(
        "sentry.seer.supergroups.endpoints.organization_supergroups_by_group.make_supergroups_get_by_group_ids_request"
    )
    def test_status_filter_strips_resolved_from_response(self, mock_seer):
        extra_unresolved = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        mock_seer.return_value = mock_seer_response(
            {
                "data": [
                    {
                        "id": 1,
                        "group_ids": [
                            self.unresolved_group.id,
                            self.resolved_group.id,
                            extra_unresolved.id,
                        ],
                        "title": "kept",
                    },
                    {
                        "id": 2,
                        "group_ids": [self.resolved_group.id],
                        "title": "dropped",
                    },
                ]
            }
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(
                self.organization.slug,
                group_id=[self.unresolved_group.id, self.resolved_group.id],
                status="unresolved",
            )

        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["group_ids"] == [
            self.unresolved_group.id,
            extra_unresolved.id,
        ]

    def test_status_filter_invalid(self):
        with self.feature("organizations:top-issues-ui"):
            self.get_error_response(
                self.organization.slug,
                group_id=[self.unresolved_group.id],
                status="bogus",
                status_code=400,
            )

from __future__ import annotations

from unittest.mock import MagicMock, patch

import orjson

from sentry.models.group import GroupStatus
from sentry.testutils.cases import APITestCase


def mock_seer_response(data):
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
    def test_status_filter(self, mock_seer):
        mock_seer.return_value = mock_seer_response({"supergroups": []})

        with self.feature("organizations:top-issues-ui"):
            self.get_success_response(
                self.organization.slug,
                group_id=[self.unresolved_group.id, self.resolved_group.id],
                status="unresolved",
            )

        body = mock_seer.call_args[0][0]
        assert body["group_ids"] == [self.unresolved_group.id]

    def test_status_filter_invalid(self):
        with self.feature("organizations:top-issues-ui"):
            self.get_error_response(
                self.organization.slug,
                group_id=[self.unresolved_group.id],
                status="bogus",
                status_code=400,
            )

    def test_status_filter_all_filtered_out(self):
        with self.feature("organizations:top-issues-ui"):
            self.get_error_response(
                self.organization.slug,
                group_id=[self.resolved_group.id],
                status="unresolved",
                status_code=404,
            )

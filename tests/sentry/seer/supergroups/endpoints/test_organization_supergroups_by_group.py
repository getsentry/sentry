from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import orjson

from sentry.models.group import GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.seer.supergroups.endpoints import organization_supergroups_by_group
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

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
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

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_rca_source_is_lightweight(self, mock_seer):
        mock_seer.return_value = mock_seer_response({"data": []})

        with self.feature("organizations:top-issues-ui"):
            self.get_success_response(
                self.organization.slug,
                group_id=[self.unresolved_group.id],
            )

        body = mock_seer.call_args.args[0]
        assert body["rca_source"] == "LIGHTWEIGHT"

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_assignee_summary(self, mock_seer):
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        team = self.create_team(organization=self.organization, slug="backend")

        g1 = self.create_group(project=self.project)
        g2 = self.create_group(project=self.project)
        g3 = self.create_group(project=self.project)
        g_unassigned = self.create_group(project=self.project)

        GroupAssignee.objects.assign(g1, user_a)
        GroupAssignee.objects.assign(g2, user_b)
        GroupAssignee.objects.assign(g3, team)

        mock_seer.return_value = mock_seer_response(
            {
                "data": [
                    {
                        "id": 1,
                        "group_ids": [g1.id, g2.id, g3.id, g_unassigned.id],
                        "title": "sg",
                    }
                ]
            }
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(
                self.organization.slug,
                group_id=[g1.id],
            )

        sg = response.data["data"][0]
        assignees = {(a["type"], a["id"]) for a in sg["assignees"]}
        assert assignees == {
            ("user", str(user_a.id)),
            ("user", str(user_b.id)),
            ("team", str(team.id)),
        }

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_assignee_summary_empty(self, mock_seer):
        unassigned = self.create_group(project=self.project)
        mock_seer.return_value = mock_seer_response(
            {"data": [{"id": 1, "group_ids": [unassigned.id], "title": "sg"}]}
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(
                self.organization.slug,
                group_id=[unassigned.id],
            )

        sg = response.data["data"][0]
        assert sg["assignees"] == []

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_assignee_summary_ignores_cross_org_groups(self, mock_seer):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_user = self.create_user(email="other@example.com")
        other_group = self.create_group(project=other_project)
        GroupAssignee.objects.assign(other_group, other_user)

        mock_seer.return_value = mock_seer_response(
            {
                "data": [
                    {
                        "id": 1,
                        "group_ids": [self.unresolved_group.id, other_group.id],
                        "title": "sg",
                    }
                ]
            }
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(
                self.organization.slug,
                group_id=[self.unresolved_group.id],
            )

        sg = response.data["data"][0]
        assert sg["assignees"] == []

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_skips_fanout_over_threshold(self, mock_seer):
        threshold = organization_supergroups_by_group._MAX_GROUPS_FOR_FETCH
        fake_group_ids = list(range(10_000_000, 10_000_000 + threshold))
        mock_seer.return_value = mock_seer_response(
            {
                "data": [
                    {
                        "id": 1,
                        "group_ids": [self.resolved_group.id, *fake_group_ids],
                        "title": "too big",
                    }
                ]
            }
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(
                self.organization.slug,
                group_id=[self.resolved_group.id],
                status="unresolved",
            )

        assert response.data["meta"] == {"estimated": True}
        sg = response.data["data"][0]
        assert "assignees" not in sg
        assert self.resolved_group.id in sg["group_ids"]

    @patch("sentry.seer.supergroups.by_group.make_supergroups_get_by_group_ids_request")
    def test_assignee_summary_tolerates_missing_actor(self, mock_seer):
        # GroupAssignee row references a user_id that `user_service.get_many_by_id` no longer returns
        assigned = self.create_group(project=self.project)
        GroupAssignee.objects.create(group=assigned, project=self.project, user_id=999_999)

        mock_seer.return_value = mock_seer_response(
            {"data": [{"id": 1, "group_ids": [assigned.id], "title": "sg"}]}
        )

        with self.feature("organizations:top-issues-ui"):
            response = self.get_success_response(
                self.organization.slug,
                group_id=[assigned.id],
            )

        sg = response.data["data"][0]
        assert sg["assignees"] == []

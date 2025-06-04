from typing import Any
from unittest.mock import patch

from django.urls import reverse

from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus
from sentry.testutils.cases import SCIMTestCase


class SCIMDetailGetTest(SCIMTestCase):
    def test_team_details_404(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, 2],
        )
        response = self.client.get(url)
        assert response.status_code == 404, response.content

        assert response.data == {
            "detail": "Group not found.",
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
        }

    def test_scim_team_details_basic(self):
        team = self.create_team(
            organization=self.organization, name="test-scimv2", idp_provisioned=True
        )
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, team.id],
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": str(team.id),
            "displayName": "test-scimv2",
            "members": [],
            "meta": {"resourceType": "Group"},
        }

    def test_scim_team_details_excluded_attributes(self):
        team = self.create_team(
            organization=self.organization, name="test-scimv2", idp_provisioned=True
        )
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, team.id],
        )
        response = self.client.get(f"{url}?excludedAttributes=members")
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": str(team.id),
            "displayName": "test-scimv2",
            "meta": {"resourceType": "Group"},
        }

    def test_team_doesnt_exist(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, 32340]
        )
        response = self.client.get(url)
        assert response.status_code == 404, response.data

        response = self.client.patch(url)
        assert response.status_code == 404, response.data

        response = self.client.delete(url)
        assert response.status_code == 404, response.data

    def test_team_details_put_permission_denied(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.put(url)
        assert response.status_code == 403, response.data


class SCIMDetailPatchTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-team-details"
    method = "patch"

    def setUp(self):
        super().setUp()
        self.team = self.create_team(organization=self.organization, idp_provisioned=True)
        self.base_data: dict[str, Any] = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        }
        self.member_one = self.create_member(
            user=self.create_user(), organization=self.organization
        )
        self.member_two = self.create_member(
            user=self.create_user(), organization=self.organization
        )
        self.member_on_team = self.create_member(
            user=self.create_user(), organization=self.organization, teams=[self.team]
        )

    def test_scim_team_details_invalid_patch_op(self):
        self.base_data["Operations"] = [
            {
                "op": "invalid",
                "value": {
                    "id": str(self.team.id),
                    "displayName": "newName",
                },
            }
        ]
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=400
        )
        assert "invalid" in response.data["detail"]

    @patch("sentry.scim.endpoints.teams.metrics")
    def test_scim_team_details_patch_rename_team(self, mock_metrics):
        self.base_data["Operations"] = [
            {
                "op": "replace",
                "value": {
                    "id": str(self.team.id),
                    "displayName": "newName",
                },
            }
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert Team.objects.get(id=self.team.id).slug == "newname"
        assert Team.objects.get(id=self.team.id).name == "newName"
        assert Team.objects.get(id=self.team.id).idp_provisioned
        mock_metrics.incr.assert_called_with(
            "sentry.scim.team.update", tags={"organization": self.organization}
        )

    def test_scim_team_details_patch_rename_team_invalid_slug(self):
        self.base_data["Operations"] = [
            {
                "op": "replace",
                "value": {
                    "id": str(self.team.id),
                    "displayName": "1234",
                },
            }
        ]
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=400
        )
        assert response.data["slug"][0] == (
            "Enter a valid slug consisting of lowercase letters, numbers, underscores or "
            "hyphens. It cannot be entirely numeric."
        )

    def test_scim_team_details_patch_add(self):
        self.base_data["Operations"] = [
            {
                "op": "add",
                "path": "members",
                "value": [
                    {
                        "value": self.member_one.id,
                        "display": self.member_one.email,
                    }
                ],
            },
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert OrganizationMemberTeam.objects.filter(
            team_id=str(self.team.id), organizationmember_id=self.member_one.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_scim_team_details_patch_remove(self):
        self.base_data["Operations"] = [
            {
                "op": "remove",
                "path": f'members[value eq "{self.member_one.id}"]',
            }
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_one.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_team_details_replace_members_list(self):
        self.base_data["Operations"] = [
            {
                "op": "replace",
                "path": "members",
                "value": [
                    {
                        "value": self.member_one.id,
                        "display": "test.user@okta.local",
                    },
                    {
                        "value": self.member_two.id,
                        "display": "test.user2@okta.local",
                    },
                ],
            }
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_on_team.id
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_one.id
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_two.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_team_member_doesnt_exist_add_to_team(self):
        self.base_data["Operations"] = [
            {
                "op": "add",
                "path": "members",
                "value": [
                    {
                        "value": "100232",
                        "display": "nope@doesnotexist.io",
                    }
                ],
            },
        ]
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=404
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User not found.",
        }

    def test_team_details_patch_too_many_ops(self):
        self.base_data["Operations"] = [{"op": "replace"}] * 101
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=400
        )

        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Too many patch ops sent, limit is 100.",
        }

    def test_team_details_invalid_filter_patch_route(self):
        self.base_data["Operations"] = [
            {
                "op": "remove",
                "path": 'members[value badop "1"]',
            }
        ]
        response = self.get_error_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=400
        )

        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "scimType": "invalidFilter",
        }

    def test_rename_team_azure_request(self):
        self.base_data["Operations"] = [
            {"op": "Replace", "path": "displayName", "value": "theNewName"}
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert Team.objects.get(id=self.team.id).slug == "thenewname"
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_remove_member_azure(self):
        self.base_data["Operations"] = [
            {"op": "Remove", "path": "members", "value": [{"value": str(self.member_on_team.id)}]}
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_on_team.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_remove_member_not_on_team(self):
        self.base_data["Operations"] = [
            {
                "op": "Remove",
                "path": "members",
                "value": [{"value": str(self.member_one.id)}],
            }
        ]
        self.get_success_response(
            self.organization.slug, self.team.id, **self.base_data, status_code=204
        )
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=self.member_one.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned


class SCIMDetailDeleteTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-team-details"
    method = "delete"

    @patch("sentry.scim.endpoints.teams.metrics")
    def test_delete_team(self, mock_metrics):
        team = self.create_team(organization=self.organization, idp_provisioned=True)
        self.get_success_response(self.organization.slug, team.id, status_code=204)

        assert Team.objects.get(id=team.id).status == TeamStatus.PENDING_DELETION
        mock_metrics.incr.assert_called_with("sentry.scim.team.delete")

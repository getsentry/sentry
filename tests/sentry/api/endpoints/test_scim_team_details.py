from django.urls import reverse

from sentry.models import OrganizationMemberTeam, Team, TeamStatus
from sentry.testutils import SCIMTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SCIMTeamDetailsTests(SCIMTestCase):
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
        team = self.create_team(organization=self.organization, name="test-scimv2")
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
        team = self.create_team(organization=self.organization, name="test-scimv2")
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

    def test_scim_team_details_invalid_patch_op(self):
        team = self.create_team(organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team.id]
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {
                        "op": "invalid",
                        "value": {
                            "id": str(team.id),
                            "displayName": "newName",
                        },
                    }
                ],
            },
        )
        assert response.status_code == 400, response.content

    def test_scim_team_details_patch_replace_rename_team(self):
        team = self.create_team(organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team.id]
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {
                        "op": "replace",
                        "value": {
                            "id": str(team.id),
                            "displayName": "newName",
                        },
                    }
                ],
            },
        )
        assert response.status_code == 204, response.content
        assert Team.objects.get(id=team.id).slug == "newname"
        assert Team.objects.get(id=team.id).name == "newName"
        assert Team.objects.get(id=team.id).idp_provisioned

    def test_scim_team_details_patch_add(self):
        team = self.create_team(organization=self.organization)
        member1 = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team.id]
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {
                        "op": "add",
                        "path": "members",
                        "value": [
                            {
                                "value": member1.id,
                                "display": member1.email,
                            }
                        ],
                    },
                ],
            },
        )
        assert response.status_code == 204, response.content
        assert OrganizationMemberTeam.objects.filter(
            team_id=str(team.id), organizationmember_id=member1.id
        ).exists()
        assert Team.objects.get(id=team.id).idp_provisioned

    def test_scim_team_details_patch_remove(self):
        team = self.create_team(organization=self.organization)
        member1 = self.create_member(
            user=self.create_user(), organization=self.organization, teams=[team]
        )

        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team.id]
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {
                        "op": "remove",
                        "path": f'members[value eq "{member1.id}"]',
                    }
                ],
            },
        )
        assert response.status_code == 204, response.content
        assert not OrganizationMemberTeam.objects.filter(
            team_id=team.id, organizationmember_id=member1.id
        ).exists()
        assert Team.objects.get(id=team.id).idp_provisioned

    def test_team_details_replace_members_list(self):
        team = self.create_team(organization=self.organization)
        member1 = self.create_member(
            user=self.create_user(), organization=self.organization, teams=[team]
        )
        member2 = self.create_member(user=self.create_user(), organization=self.organization)
        member3 = self.create_member(user=self.create_user(), organization=self.organization)

        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team.id]
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {
                        "op": "replace",
                        "path": "members",
                        "value": [
                            {
                                "value": member2.id,
                                "display": "test.user@okta.local",
                            },
                            {
                                "value": member3.id,
                                "display": "test.user2@okta.local",
                            },
                        ],
                    }
                ],
            },
        )
        assert response.status_code == 204, response.content
        assert not OrganizationMemberTeam.objects.filter(
            team_id=team.id, organizationmember_id=member1.id
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            team_id=team.id, organizationmember_id=member2.id
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            team_id=team.id, organizationmember_id=member3.id
        ).exists()
        assert Team.objects.get(id=team.id).idp_provisioned

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

    def test_team_member_doesnt_exist_add_to_team(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
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
                ],
            },
        )
        assert response.status_code == 404, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User not found.",
        }

    def test_team_details_put_permission_denied(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.put(url)
        assert response.status_code == 403, response.data

    def test_team_details_patch_too_many_ops(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [{"op": "replace"}] * 101,
            },
        )

        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Too many patch ops sent, limit is 100.",
        }

    def test_team_details_invalid_filter_patch_route(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {
                        "op": "remove",
                        "path": 'members[value badop "1"]',
                    }
                ],
            },
        )

        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "scimType": "invalidFilter",
        }

    def test_rename_team_azure_request(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [{"op": "Replace", "path": "displayName", "value": "theNewName"}],
            },
        )
        assert response.status_code == 204, response.content
        assert Team.objects.get(id=self.team.id).slug == "thenewname"
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_delete_team(self):
        team = self.create_team(organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team.id]
        )
        response = self.client.delete(url)
        assert response.status_code == 204, response.content

        assert Team.objects.get(id=team.id).status == TeamStatus.PENDING_DELETION

    def test_remove_member_azure(self):
        member1 = self.create_member(
            user=self.create_user(), organization=self.organization, teams=[self.team]
        )

        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {"op": "Remove", "path": "members", "value": [{"value": str(member1.id)}]}
                ],
            },
        )
        assert response.status_code == 204, response.content
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=member1.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

    def test_remove_member_not_on_team(self):
        member1_no_team = self.create_member(
            user=self.create_user(), organization=self.organization, teams=[]
        )

        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {
                        "op": "Remove",
                        "path": "members",
                        "value": [{"value": str(member1_no_team.id)}],
                    }
                ],
            },
        )
        assert response.status_code == 204, response.content
        assert not OrganizationMemberTeam.objects.filter(
            team_id=self.team.id, organizationmember_id=member1_no_team.id
        ).exists()
        assert Team.objects.get(id=self.team.id).idp_provisioned

import pytest
from django.urls import reverse

from sentry.models import AuthProvider, OrganizationMember, OrganizationMemberTeam, Team, TeamStatus
from sentry.scim.endpoints.utils import parse_filter_conditions
from sentry.testutils import APITestCase, TestCase

CREATE_USER_POST_DATA = {
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName": "test.user@okta.local",
    "name": {"givenName": "Test", "familyName": "User"},
    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
    "displayName": "Test User",
    "locale": "en-US",
    "externalId": "00ujl29u0le5T6Aj10h7",
    "groups": [],
    "password": "1mz050nq",
    "active": True,
}

CREATE_GROUP_POST_DATA = {
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    "displayName": "Test SCIMv2",
    "members": [],
}


class SCIMTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        with self.feature({"organizations:sso-scim": True}):
            auth_provider.enable_scim(self.user)
            auth_provider.save()
        self.login_as(user=self.user)


class SCIMMemberTestsPermissions(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_cant_use_scim(self):
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(url)
        assert response.status_code == 403

    def test_cant_use_scim_even_with_authprovider(self):
        AuthProvider.objects.create(organization=self.organization, provider="dummy")
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(url)
        assert response.status_code == 403


class SCIMMemberTests(SCIMTestCase):
    def test_user_flow(self):

        # test OM to be created does not exist

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=userName%20eq%20%22test.user%40okta.local%22"
        )
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 0,
            "startIndex": 1,
            "itemsPerPage": 0,
            "Resources": [],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

        # test that post creates an OM

        response = self.client.post(url, CREATE_USER_POST_DATA)

        assert response.status_code == 201, response.content
        org_member_id = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        ).id
        correct_post_data = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(org_member_id),
            "userName": "test.user@okta.local",
            # "name": {"givenName": "Test", "familyName": "User"},
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            # "displayName": "Test User",
            # "locale": "en-US",
            # "externalId": "00ujl29u0le5T6Aj10h7",
            "active": True,
            "name": {"familyName": "N/A", "givenName": "N/A"},
            # "groups": [],
            "meta": {"resourceType": "User"},
        }

        assert correct_post_data == response.data

        # test that response 409s if member already exists (by email)

        response = self.client.post(url, CREATE_USER_POST_DATA)
        assert response.status_code == 409, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User already exists in the database.",
        }

        # test that the OM is listed in the GET

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=userName%20eq%20%22test.user%40okta.local%22"
        )
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                    "id": str(org_member_id),
                    "userName": "test.user@okta.local",
                    "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                    "name": {"familyName": "N/A", "givenName": "N/A"},
                    "active": True,
                    "meta": {"resourceType": "User"},
                }
            ],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

        # test that the OM exists when querying the id directly
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, org_member_id],
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(org_member_id),
            "userName": "test.user@okta.local",
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "name": {"familyName": "N/A", "givenName": "N/A"},
            "active": True,
            "meta": {"resourceType": "User"},
        }

        # test that the OM is deleted after setting inactive to false

        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, org_member_id],
        )

        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "replace", "value": {"active": False}}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 204, response.content

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=org_member_id)

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=userName%20eq%20%22test.user%40okta.local%22"
        )
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 0,
            "startIndex": 1,
            "itemsPerPage": 0,
            "Resources": [],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

        # test that directly GETing and PATCHing the deleted orgmember returns 404
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, org_member_id],
        )

        response = self.client.patch(url, patch_req)
        assert response.status_code == 404, response.content
        # assert response.data == {
        #     "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
        #     "detail": "User not found.",
        # } # TODO: see if we can get away without having error schemas

        # # TODO: test authidentity is deleted
        # with pytest.raises(OrganizationMember.DoesNotExist):
        #     OrganizationMember.objects.get(organization=self.organization, id=2)

    def test_delete_route(self):
        member = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member.id],
        )
        response = self.client.delete(url)
        assert response.status_code == 204, response.content
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

    def test_patch_inactive_alternate_schema(self):
        member = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member.id],
        )
        response = self.client.patch(
            url, {"Operations": [{"op": "replace", "path": "active", "value": False}]}
        )
        assert response.status_code == 204, response.content
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

    def test_patch_bad_schema(self):
        member = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member.id],
        )
        response = self.client.patch(
            url, {"Operations": [{"op": "replace", "path": "blahblahbbalh", "value": False}]}
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Invalid Patch Operation.",
        }

    def test_member_detail_patch_too_many_ops(self):
        member = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member.id],
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [{}] * 101,
            },
        )

        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Too many patch ops sent, limit is 100.",
        }

    # Disabling below test for now.
    # need to see what Okta admins would expect to happen with invited members
    # def test_request_invite_members_not_in_requests(self):
    #     member1 = self.create_member(user=self.create_user(), organization=self.organization)
    #     member1.invite_status = InviteStatus.REQUESTED_TO_BE_INVITED.value
    #     member1.save()

    #     member2 = self.create_member(user=self.create_user(), organization=self.organization)
    #     member2.invite_status = InviteStatus.REQUESTED_TO_JOIN.value
    #     member2.save()

    #     member3 = self.create_member(user=self.create_user(), organization=self.organization)
    #     member3.invite_status = InviteStatus.APPROVED.value  # default val
    #     member3.save()

    #     url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
    #     response = self.client.get(f"{url}?startIndex=1&count=100")
    #     assert response.status_code == 200, response.content
    #     assert response.data["totalResults"] == 2

    #     url = reverse(
    #         "sentry-api-0-organization-scim-member-details", args=[self.organization.slug, member1.id]
    #     )
    #     response = self.client.get(url)
    #     assert response.status_code == 404, response.content

    #     url = reverse(
    #         "sentry-api-0-organization-scim-member-details", args=[self.organization.slug, member2.id]
    #     )
    #     response = self.client.get(url)
    #     assert response.status_code == 404, response.content

    def test_overflow_cases(self):
        member = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, "010101001010101011001010101011"],
        )
        response = self.client.get(
            url,
        )
        assert response.status_code == 404, response.content
        response = self.client.patch(url, {})
        assert response.status_code == 404, response.content
        response = self.client.delete(url, member.id)
        assert response.status_code == 404, response.content

    def test_cant_delete_only_owner_route(self):
        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member_om.id],
        )
        response = self.client.delete(url)
        assert response.status_code == 403, response.content

    def test_cant_delete_only_owner_route_patch(self):
        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "replace", "value": {"active": False}}],
        }
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member_om.id],
        )
        response = self.client.patch(url, patch_req)
        assert response.status_code == 403, response.content

    def test_pagination(self):
        for i in range(0, 150):
            user = self.create_user(is_superuser=False)
            self.create_member(user=user, organization=self.organization, role="member", teams=[])

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 100
        assert response.data["startIndex"] == 1
        assert len(response.data["Resources"]) == 100

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=40&count=100")
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 100
        assert response.data["startIndex"] == 40
        assert len(response.data["Resources"]) == 100

        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=101&count=100")
        assert len(response.data["Resources"]) == 51
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 51
        assert response.data["startIndex"] == 101

    # TODO: test patch with bad op


class SCIMUtilsTests(TestCase):
    def test_parse_filter_conditions_basic(self):
        fil = parse_filter_conditions('userName eq "user@sentry.io"')
        assert fil == ["user@sentry.io"]

        # single quotes too
        fil = parse_filter_conditions("userName eq 'user@sentry.io'")
        assert fil == ["user@sentry.io"]

        fil = parse_filter_conditions('value eq "23"')
        assert fil == [23]

        fil = parse_filter_conditions('displayName eq "MyTeamName"')
        assert fil == ["MyTeamName"]

    def test_parse_filter_conditions_invalids(self):
        with pytest.raises(ValueError):
            parse_filter_conditions("userName invalid USER@sentry.io")
        with pytest.raises(ValueError):
            parse_filter_conditions("blablaba eq USER@sentry.io")

    def test_parse_filter_conditions_single_quote_in_email(self):
        fil = parse_filter_conditions('userName eq "jos\'h@sentry.io"')
        assert fil == ["jos'h@sentry.io"]


class SCIMGroupTests(SCIMTestCase):
    def test_group_flow(self):
        member1 = self.create_member(user=self.create_user(), organization=self.organization)
        member2 = self.create_member(user=self.create_user(), organization=self.organization)
        # test index route returns empty list
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 0,
            "startIndex": 1,
            "itemsPerPage": 0,
            "Resources": [],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

        # test team route 404s
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

        # test team creation
        url = reverse(
            "sentry-api-0-organization-scim-team-index",
            args=[self.organization.slug],
        )
        response = self.client.post(url, CREATE_GROUP_POST_DATA)
        assert response.status_code == 201, response.content

        team_id = response.data["id"]
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": team_id,
            "displayName": "test-scimv2",
            "members": [],
            "meta": {"resourceType": "Group"},
        }

        # test team details GET
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, team_id],
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": team_id,
            "displayName": "test-scimv2",
            "members": [],
            "meta": {"resourceType": "Group"},
        }

        # test team index GET
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": team_id,
                    "displayName": "test-scimv2",
                    "members": [],
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

        # rename a team with the replace op
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team_id]
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [
                    {
                        "op": "replace",
                        "value": {
                            "id": team_id,
                            "displayName": "newName",
                        },
                    }
                ],
            },
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": team_id,
            "displayName": "newname",
            "members": None,
            "meta": {"resourceType": "Group"},
        }
        # assert slug exists
        assert Team.objects.filter(organization=self.organization, slug="newname").exists()

        # Add a member to a team

        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team_id]
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
        assert response.status_code == 200, response.content

        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": team_id,
            "displayName": "newname",
            "members": None,
            "meta": {"resourceType": "Group"},
        }
        assert OrganizationMemberTeam.objects.filter(
            team_id=team_id, organizationmember_id=member1.id
        ).exists()

        # remove a member from a team

        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team_id]
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
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": team_id,
            "displayName": "newname",
            "members": None,
            "meta": {"resourceType": "Group"},
        }
        assert not OrganizationMemberTeam.objects.filter(
            team_id=team_id, organizationmember_id=member1.id
        ).exists()

        # replace the entire member list

        member3 = self.create_member(user=self.create_user(), organization=self.organization)
        OrganizationMemberTeam.objects.create(organizationmember=member3, team_id=team_id)
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team_id]
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
                                "value": member1.id,
                                "display": "test.user@okta.local",
                            },
                            {
                                "value": member2.id,
                                "display": "test.user@okta.local",
                            },
                        ],
                    }
                ],
            },
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": team_id,
            "displayName": "newname",
            "members": None,
            "meta": {"resourceType": "Group"},
        }
        assert OrganizationMemberTeam.objects.filter(
            team_id=team_id, organizationmember_id=member1.id
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            team_id=team_id, organizationmember_id=member2.id
        ).exists()

        assert not OrganizationMemberTeam.objects.filter(
            team_id=team_id, organizationmember_id=member3.id
        ).exists()

        # test index route returns with members
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        correct_get_data = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "displayName": "newname",
                    "id": team_id,
                    "members": [
                        {
                            "display": member1.get_email(),
                            "value": f"{member1.id}",
                        },
                        {
                            "display": member2.get_email(),
                            "value": f"{member2.id}",
                        },
                    ],
                    "meta": {"resourceType": "Group"},
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                }
            ],
        }
        assert response.status_code == 200, response.content
        assert response.data == correct_get_data

        # delete the team
        url = reverse(
            "sentry-api-0-organization-scim-team-details", args=[self.organization.slug, team_id]
        )
        response = self.client.delete(url)
        assert response.status_code == 204, response.content

        assert Team.objects.get(id=team_id).status == TeamStatus.PENDING_DELETION

    def test_group_filter(self):
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=displayName eq %22{self.team.slug}%22"
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": str(self.team.id),
                    "displayName": self.team.name,
                    "members": [
                        {"value": str(self.team.member_set[0].id), "display": "admin@localhost"}
                    ],
                    "meta": {"resourceType": "Group"},
                }
            ],
        }

    def test_team_exclude_members_param(self):
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(
            f"{url}?startIndex=1&count=100&filter=displayName eq %22{self.team.slug}%22&excludedAttributes=members"
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": 1,
            "startIndex": 1,
            "itemsPerPage": 1,
            "Resources": [
                {
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": str(self.team.id),
                    "displayName": self.team.name,
                    "members": None,
                    "meta": {"resourceType": "Group"},
                }
            ],
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

    def test_invalid_filter(self):
        url = reverse("sentry-api-0-organization-scim-team-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=1&filter=bad filter eq 23")
        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "scimType": "invalidFilter",
        }

    def test_invalid_filter_patch_route(self):
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

    def test_team_detail_put_permission_denied(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.put(url)
        assert response.status_code == 403, response.data

    def test_team_detail_patch_too_many_ops(self):
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.patch(
            url,
            {
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [{}] * 101,
            },
        )

        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Too many patch ops sent, limit is 100.",
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
                "Operations": [{"op": "replace", "path": "displayName", "value": "theNewName"}],
            },
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": str(self.team.id),
            "displayName": "thenewname",
            "members": None,
            "meta": {"resourceType": "Group"},
        }

    def test_add_member_already_in_team(self):
        member1 = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-scim-team-details",
            args=[self.organization.slug, self.team.id],
        )
        response = self.client.patch(
            url,
            response=self.client.patch(
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
            ),
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": str(self.team.id),
            "displayName": self.team.name,
            "members": None,
            "meta": {"resourceType": "Group"},
        }

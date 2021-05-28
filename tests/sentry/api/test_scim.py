import pytest
from django.urls import reverse

from sentry.models import AuthProvider, InviteStatus, OrganizationMember
from sentry.testutils import APITestCase

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


class SCIMUserTestsPermissions(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_cant_use_scim(self):
        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
        response = self.client.get(url)
        assert response.status_code == 403

    def test_cant_use_scim_even_with_authprovider(self):
        AuthProvider.objects.create(organization=self.organization, provider="dummy")
        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
        response = self.client.get(url)
        assert response.status_code == 403


class SCIMUserTests(APITestCase):
    def setUp(self):
        super().setUp()
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        with self.feature({"organizations:sso-scim": True}):
            auth_provider.enable_scim(self.user)
            auth_provider.save()
        self.login_as(user=self.user)

    def test_user_flow(self):

        # test OM to be created does not exist

        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
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
        org_member_id = OrganizationMember.objects.get(
            organization=self.organization, email="test.user@okta.local"
        ).id
        correct_post_data = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": org_member_id,
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
        assert response.status_code == 201, response.content

        assert correct_post_data == response.data

        # test that response 409s if member already exists (by email)

        response = self.client.post(url, CREATE_USER_POST_DATA)
        assert response.status_code == 409, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User already exists in the database.",
        }

        # test that the OM is listed in the GET

        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
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
                    "id": org_member_id,
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
            "sentry-scim-organization-members-details", args=[self.organization.slug, org_member_id]
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": org_member_id,
            "userName": "test.user@okta.local",
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "name": {"familyName": "N/A", "givenName": "N/A"},
            "active": True,
            "meta": {"resourceType": "User"},
        }

        # test that the OM is deleted after setting inactive to false

        url = reverse(
            "sentry-scim-organization-members-details", args=[self.organization.slug, org_member_id]
        )

        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "replace", "value": {"active": False}}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 204, response.content

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=org_member_id)

        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
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
            "sentry-scim-organization-members-details", args=[self.organization.slug, org_member_id]
        )

        response = self.client.patch(url, patch_req)
        assert response.status_code == 404, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "User not found.",
        }
        # # TODO: test authidentity is deleted
        # with pytest.raises(OrganizationMember.DoesNotExist):
        #     OrganizationMember.objects.get(organization=self.organization, id=2)

    def test_delete_route(self):
        member = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-scim-organization-members-details", args=[self.organization.slug, member.id]
        )
        response = self.client.delete(url)
        assert response.status_code == 204, response.content
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

    def test_request_invite_members_not_in_requests(self):
        member1 = self.create_member(user=self.create_user(), organization=self.organization)
        member1.invite_status = InviteStatus.REQUESTED_TO_BE_INVITED.value
        member1.save()

        member2 = self.create_member(user=self.create_user(), organization=self.organization)
        member2.invite_status = InviteStatus.REQUESTED_TO_JOIN.value
        member2.save()

        member3 = self.create_member(user=self.create_user(), organization=self.organization)
        member3.invite_status = InviteStatus.APPROVED.value  # default val
        member3.save()

        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        assert response.status_code == 200, response.content
        assert response.data["totalResults"] == 2

        url = reverse(
            "sentry-scim-organization-members-details", args=[self.organization.slug, member1.id]
        )
        response = self.client.get(url)
        assert response.status_code == 404, response.content

        url = reverse(
            "sentry-scim-organization-members-details", args=[self.organization.slug, member2.id]
        )
        response = self.client.get(url)
        assert response.status_code == 404, response.content

    def test_overflow_cases(self):
        member = self.create_member(user=self.create_user(), organization=self.organization)
        url = reverse(
            "sentry-scim-organization-members-details",
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
            "sentry-scim-organization-members-details",
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
            "sentry-scim-organization-members-details",
            args=[self.organization.slug, member_om.id],
        )
        response = self.client.patch(url, patch_req)
        assert response.status_code == 403, response.content

    def test_pagination(self):
        for i in range(0, 150):
            user = self.create_user(is_superuser=False)
            self.create_member(user=user, organization=self.organization, role="member", teams=[])

        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=1&count=100")
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 100
        assert response.data["startIndex"] == 1
        assert len(response.data["Resources"]) == 100

        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=40&count=100")
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 100
        assert response.data["startIndex"] == 40
        assert len(response.data["Resources"]) == 100

        url = reverse("sentry-scim-organization-members-index", args=[self.organization.slug])
        response = self.client.get(f"{url}?startIndex=101&count=100")
        assert len(response.data["Resources"]) == 51
        assert response.data["totalResults"] == 151
        assert response.data["itemsPerPage"] == 51
        assert response.data["startIndex"] == 101

    # TODO: test patch with bad op

import pytest
from django.urls import reverse

from sentry.models import AuthProvider, OrganizationMember
from sentry.models.authidentity import AuthIdentity
from sentry.scim.endpoints.utils import SCIMFilterError, parse_filter_conditions
from sentry.testutils import APITestCase, SCIMAzureTestCase, SCIMTestCase, TestCase

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


class SCIMMemberDetailsTests(SCIMTestCase):
    def test_user_details_get(self):
        member = self.create_member(organization=self.organization, email="test.user@okta.local")
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member.id],
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(member.id),
            "userName": "test.user@okta.local",
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "name": {"familyName": "N/A", "givenName": "N/A"},
            "active": True,
            "meta": {"resourceType": "User"},
        }

    def test_user_details_set_inactive(self):
        member = self.create_member(
            user=self.create_user(), organization=self.organization, email="test.user@okta.local"
        )
        AuthIdentity.objects.create(
            user=member.user, auth_provider=self.auth_provider, ident="test_ident"
        )
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member.id],
        )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "replace", "value": {"active": False}}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 204, response.content

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist):
            AuthIdentity.objects.get(auth_provider=self.auth_provider, id=member.id)

    def test_user_details_get_404(self):
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, 99999999],
        )
        response = self.client.get(url)
        assert response.status_code == 404, response.content

    def test_user_details_patch_404(self):
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, 99999999],
        )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "replace", "value": {"active": False}}],
        }
        response = self.client.patch(url, patch_req)
        assert response.status_code == 404, response.content

    def test_delete_route(self):
        member = self.create_member(user=self.create_user(), organization=self.organization)
        AuthIdentity.objects.create(
            user=member.user, auth_provider=self.auth_provider, ident="test_ident"
        )
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member.id],
        )
        response = self.client.delete(url)
        assert response.status_code == 204, response.content
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)
        with pytest.raises(AuthIdentity.DoesNotExist):
            AuthIdentity.objects.get(auth_provider=self.auth_provider, id=member.id)

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
                "Operations": [{"op": "replace", "path": "active", "value": False}] * 101,
            },
        )

        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": "urn:ietf:params:scim:api:messages:2.0:Error",
            "detail": '{"Operations":["Ensure this field has no more than 100 elements."]}',
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

    # TODO: test patch with bad op


class SCIMMemberDetailsAzureTests(SCIMAzureTestCase):
    def test_user_details_get_no_active(self):
        member = self.create_member(organization=self.organization, email="test.user@okta.local")
        url = reverse(
            "sentry-api-0-organization-scim-member-details",
            args=[self.organization.slug, member.id],
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(member.id),
            "userName": "test.user@okta.local",
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "name": {"familyName": "N/A", "givenName": "N/A"},
            "meta": {"resourceType": "User"},
        }


class SCIMUtilsTests(TestCase):
    def test_parse_filter_conditions_basic(self):
        fil = parse_filter_conditions('userName eq "user@sentry.io"')
        assert fil == "user@sentry.io"

        # single quotes too
        fil = parse_filter_conditions("userName eq 'user@sentry.io'")
        assert fil == "user@sentry.io"

        fil = parse_filter_conditions('value eq "23"')
        assert fil == 23

        fil = parse_filter_conditions('displayName eq "MyTeamName"')
        assert fil == "MyTeamName"

    def test_parse_filter_conditions_invalids(self):
        with pytest.raises(SCIMFilterError):
            parse_filter_conditions("userName invalid USER@sentry.io")
        with pytest.raises(SCIMFilterError):
            parse_filter_conditions("blablaba eq USER@sentry.io")

    def test_parse_filter_conditions_single_quote_in_email(self):
        fil = parse_filter_conditions('userName eq "jos\'h@sentry.io"')
        assert fil == "jos'h@sentry.io"

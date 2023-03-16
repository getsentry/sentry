import unittest

import pytest
from django.urls import reverse

from sentry.models import AuthProvider, OrganizationMember
from sentry.models.authidentity import AuthIdentity
from sentry.scim.endpoints.utils import SCIMFilterError, parse_filter_conditions
from sentry.testutils import APITestCase, SCIMAzureTestCase, SCIMTestCase

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


def generate_put_data(member: OrganizationMember, role: str = "") -> dict:
    put_data = CREATE_USER_POST_DATA.copy()
    put_data["userName"] = member.email
    put_data["sentryOrgRole"] = role
    return put_data


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


class SCIMMemberRoleUpdateTests(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-member-details"

    def setUp(self, provider="dummy"):
        super().setUp(provider=provider)
        self.unrestricted_default_role_member = self.create_member(
            user=self.create_user(), organization=self.organization
        )
        self.unrestricted_custom_role_member = self.create_member(
            user=self.create_user(), organization=self.organization, role="manager"
        )
        self.restricted_default_role_member = self.create_member(
            user=self.create_user(), organization=self.organization
        )
        self.restricted_default_role_member.flags["idp:role-restricted"] = True
        self.restricted_default_role_member.save()
        self.restricted_custom_role_member = self.create_member(
            user=self.create_user(), organization=self.organization, role="manager"
        )
        self.restricted_custom_role_member.flags["idp:role-restricted"] = True
        self.restricted_custom_role_member.save()

    def test_invalid_role(self):
        self.get_error_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
            method="put",
            status_code=400,
            **generate_put_data(self.unrestricted_default_role_member, role="nonexistant"),
        )
        self.get_error_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            method="put",
            status_code=400,
            **generate_put_data(self.unrestricted_custom_role_member, role="nonexistant"),
        )
        self.get_error_response(
            self.organization.slug,
            self.restricted_default_role_member.id,
            method="put",
            status_code=400,
            **generate_put_data(self.restricted_default_role_member, role="nonexistant"),
        )
        self.get_error_response(
            self.organization.slug,
            self.restricted_custom_role_member.id,
            method="put",
            status_code=400,
            **generate_put_data(self.restricted_custom_role_member, role="nonexistant"),
        )

        # owner is a role in Sentry but can't be set through SCIM
        self.get_error_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
            method="put",
            status_code=400,
            **generate_put_data(self.unrestricted_default_role_member, role="owner"),
        )
        self.get_error_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            method="put",
            status_code=400,
            **generate_put_data(self.unrestricted_custom_role_member, role="owner"),
        )
        self.get_error_response(
            self.organization.slug,
            self.restricted_default_role_member.id,
            method="put",
            status_code=400,
            **generate_put_data(self.restricted_default_role_member, role="owner"),
        )
        self.get_error_response(
            self.organization.slug,
            self.restricted_custom_role_member.id,
            method="put",
            status_code=400,
            **generate_put_data(self.restricted_custom_role_member, role="owner"),
        )

    def test_set_to_blank(self):
        # If we're updating a role to blank, then the user is saying that they don't want the IDP to manage role anymore

        # current Unrestricted Default role + blank sentryOrgRole -> No Change
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
            method="put",
            **generate_put_data(self.unrestricted_default_role_member),
        )
        self.unrestricted_default_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.unrestricted_default_role_member.role == self.organization.default_role
        assert not self.unrestricted_default_role_member.flags["idp:role-restricted"]

        # current Unrestricted custom role + blank sentryOrgRole -> No Change
        # This user is currently managed in the sentry app
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            method="put",
            **generate_put_data(self.unrestricted_custom_role_member),
        )
        self.unrestricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.unrestricted_custom_role_member.role
        assert self.unrestricted_custom_role_member.role == "manager"
        assert not self.unrestricted_custom_role_member.flags["idp:role-restricted"]

        # current restricted default role + blank sentryOrgRole -> unrestricted default role
        resp = self.get_success_response(
            self.organization.slug,
            self.restricted_default_role_member.id,
            method="put",
            **generate_put_data(self.restricted_default_role_member),
        )
        self.restricted_default_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.restricted_default_role_member.role == self.organization.default_role
        assert not self.restricted_default_role_member.flags["idp:role-restricted"]

        # current restricted custom role + blank sentryOrgRole -> unrestricted default role
        # IDP no longer wants to manage the role
        resp = self.get_success_response(
            self.organization.slug,
            self.restricted_custom_role_member.id,
            method="put",
            **generate_put_data(self.restricted_custom_role_member),
        )
        self.restricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.restricted_custom_role_member.role == self.organization.default_role
        assert not self.restricted_custom_role_member.flags["idp:role-restricted"]

    def test_set_to_default(self):
        # If we're updating a role, then the user is saying that they want the IDP to manage the role

        # current Unrestricted Default role + default sentryOrgRole -> restricted default role
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
            method="put",
            **generate_put_data(
                self.unrestricted_default_role_member, role=self.organization.default_role
            ),
        )
        self.unrestricted_default_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.unrestricted_default_role_member.role == self.organization.default_role
        assert self.unrestricted_default_role_member.flags["idp:role-restricted"]

        # current Unrestricted custom role + default sentryOrgRole -> restricted default role
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            method="put",
            **generate_put_data(
                self.unrestricted_custom_role_member, role=self.organization.default_role
            ),
        )
        self.unrestricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.unrestricted_custom_role_member.role == self.organization.default_role
        assert self.unrestricted_custom_role_member.flags["idp:role-restricted"]

        # current restricted default role + default sentryOrgRole -> restricted default role (no change)
        resp = self.get_success_response(
            self.organization.slug,
            self.restricted_default_role_member.id,
            method="put",
            **generate_put_data(
                self.restricted_default_role_member, role=self.organization.default_role
            ),
        )
        self.restricted_default_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.restricted_default_role_member.role == self.organization.default_role
        assert self.restricted_default_role_member.flags["idp:role-restricted"]

        # current restricted custom role + default sentryOrgRole -> restricted default role
        resp = self.get_success_response(
            self.organization.slug,
            self.restricted_custom_role_member.id,
            method="put",
            **generate_put_data(
                self.restricted_custom_role_member, role=self.organization.default_role
            ),
        )
        self.restricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.restricted_custom_role_member.role == self.organization.default_role
        assert self.restricted_custom_role_member.flags["idp:role-restricted"]

    def test_set_to_new_role(self):
        new_role = "admin"
        # If we're updating a role, then the user is saying that they want the IDP to manage the role

        # current Unrestricted Default role + custom sentryOrgRole -> restricted custom role
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
            method="put",
            **generate_put_data(self.unrestricted_default_role_member, role=new_role),
        )
        self.unrestricted_default_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == new_role
        assert self.unrestricted_default_role_member.role == new_role
        assert self.unrestricted_default_role_member.flags["idp:role-restricted"]

        # current Unrestricted custom role + different custom sentryOrgRole -> restricted different custom role
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            method="put",
            **generate_put_data(self.unrestricted_custom_role_member, role=new_role),
        )
        self.unrestricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == new_role
        assert self.unrestricted_custom_role_member.role == new_role
        assert self.unrestricted_custom_role_member.flags["idp:role-restricted"]

        # current restricted default role + custom sentryOrgRole -> restricted custom role
        resp = self.get_success_response(
            self.organization.slug,
            self.restricted_default_role_member.id,
            method="put",
            **generate_put_data(self.restricted_default_role_member, role=new_role),
        )
        self.restricted_default_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == new_role
        assert self.restricted_default_role_member.role == new_role
        assert self.restricted_default_role_member.flags["idp:role-restricted"]

        # current restricted custom role + different custom sentryOrgRole -> restricted new custom role
        resp = self.get_success_response(
            self.organization.slug,
            self.restricted_custom_role_member.id,
            method="put",
            **generate_put_data(self.restricted_custom_role_member, role=new_role),
        )
        self.restricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == new_role
        assert self.restricted_custom_role_member.role == new_role
        assert self.restricted_custom_role_member.flags["idp:role-restricted"]

    def test_set_to_same_custom_role(self):
        same_role = self.unrestricted_custom_role_member.role

        assert not self.unrestricted_custom_role_member.flags["idp:role-restricted"]

        # current Unrestricted custom role + same custom sentryOrgRole -> restricted same custom role
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            method="put",
            **generate_put_data(
                self.unrestricted_custom_role_member,
                role=same_role,
            ),
        )
        self.unrestricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == same_role
        assert self.unrestricted_custom_role_member.role == same_role
        assert self.unrestricted_custom_role_member.flags["idp:role-restricted"]


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
            "sentryOrgRole": self.organization.default_role,
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
            "Operations": [{"op": "Replace", "path": "active", "value": False}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 204, response.content

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist):
            AuthIdentity.objects.get(auth_provider=self.auth_provider, id=member.id)

    def test_user_details_set_inactive_dict(self):
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
            "Operations": [{"op": "Replace", "value": {"active": False}}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 204, response.content

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist):
            AuthIdentity.objects.get(auth_provider=self.auth_provider, id=member.id)

    def test_user_details_set_inactive_with_bool_string(self):
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
            "Operations": [{"op": "Replace", "path": "active", "value": "False"}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 204, response.content

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist):
            AuthIdentity.objects.get(auth_provider=self.auth_provider, id=member.id)

    def test_user_details_set_inactive_with_dict_bool_string(self):
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
            "Operations": [{"op": "Replace", "value": {"id": "xxxx", "active": "False"}}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 204, response.content

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist):
            AuthIdentity.objects.get(auth_provider=self.auth_provider, id=member.id)

    def test_invalid_patch_op(self):
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
            "Operations": [{"op": "invalid", "value": {"active": False}}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 400, response.content

    def test_invalid_patch_op_value(self):
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
            "Operations": [{"op": "REPLACE", "value": {"active": "invalid"}}],
        }
        response = self.client.patch(url, patch_req)

        assert response.status_code == 400, response.content

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

        response = self.client.patch(url, {"Operations": [{"op": "replace", "value": False}]})
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
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
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
            "sentryOrgRole": self.organization.default_role,
        }


class SCIMUtilsTests(unittest.TestCase):
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

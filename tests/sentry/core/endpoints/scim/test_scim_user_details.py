import unittest
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings
from django.urls import reverse

from sentry.conf.types.sentry_config import SentryMode
from sentry.core.endpoints.scim.utils import SCIMFilterError, parse_filter_conditions
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organizationmember import OrganizationMember
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, SCIMAzureTestCase, SCIMTestCase
from sentry.testutils.silo import assume_test_silo_mode, no_silo_test
from sentry.users.services.user.model import RpcUser

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
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_cant_use_scim(self) -> None:
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(url)
        assert response.status_code == 403

    def test_cant_use_scim_even_with_authprovider(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthProvider.objects.create(organization_id=self.organization.id, provider="dummy")
        url = reverse("sentry-api-0-organization-scim-member-index", args=[self.organization.slug])
        response = self.client.get(url)
        assert response.status_code == 403


class SCIMMemberRoleUpdateTests(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-member-details"
    method = "put"

    def setUp(self) -> None:
        super().setUp()
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

    def test_owner(self) -> None:
        """Owners cannot be edited by this API, but we will return a success response"""
        self.owner = self.create_member(
            user=self.create_user(), organization=self.organization, role="owner"
        )
        self.get_success_response(
            self.organization.slug,
            self.owner.id,
            **generate_put_data(self.owner, role="member"),
        )
        self.owner.refresh_from_db()
        assert self.owner.role == "owner"
        assert self.owner.flags["idp:provisioned"]

    def test_owner_blank_role(self) -> None:
        """A PUT request with a blank role should go through"""
        self.owner = self.create_member(
            user=self.create_user(), organization=self.organization, role="owner"
        )
        self.get_success_response(
            self.organization.slug,
            self.owner.id,
            **generate_put_data(self.owner),
        )
        self.owner.refresh_from_db()
        assert self.owner.role == "owner"
        assert self.owner.flags["idp:provisioned"]

        # if the owner is somehow idp:role-restricted, unset it
        self.owner.flags["idp:role-restricted"] = True
        self.owner.save()
        self.get_success_response(
            self.organization.slug,
            self.owner.id,
            **generate_put_data(self.owner),
        )
        self.owner.refresh_from_db()
        assert self.owner.role == "owner"
        assert not self.owner.flags["idp:role-restricted"]
        assert self.owner.flags["idp:provisioned"]

    def test_invalid_role(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
            status_code=400,
            **generate_put_data(self.unrestricted_default_role_member, role="nonexistant"),
        )
        self.get_error_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            status_code=400,
            **generate_put_data(self.unrestricted_custom_role_member, role="nonexistant"),
        )
        self.get_error_response(
            self.organization.slug,
            self.restricted_default_role_member.id,
            status_code=400,
            **generate_put_data(self.restricted_default_role_member, role="nonexistant"),
        )
        self.get_error_response(
            self.organization.slug,
            self.restricted_custom_role_member.id,
            status_code=400,
            **generate_put_data(self.restricted_custom_role_member, role="nonexistant"),
        )

        # owner is a role in Sentry but can't be set through SCIM
        self.get_error_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
            status_code=400,
            **generate_put_data(self.unrestricted_default_role_member, role="owner"),
        )
        self.get_error_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            status_code=400,
            **generate_put_data(self.unrestricted_custom_role_member, role="owner"),
        )
        self.get_error_response(
            self.organization.slug,
            self.restricted_default_role_member.id,
            status_code=400,
            **generate_put_data(self.restricted_default_role_member, role="owner"),
        )
        self.get_error_response(
            self.organization.slug,
            self.restricted_custom_role_member.id,
            status_code=400,
            **generate_put_data(self.restricted_custom_role_member, role="owner"),
        )

    def test_set_to_blank(self) -> None:
        # If we're updating a role to blank, then the user is saying that they don't want the IDP to manage role anymore

        # current Unrestricted Default role + blank sentryOrgRole -> No Change
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
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
            **generate_put_data(self.restricted_custom_role_member),
        )
        self.restricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.restricted_custom_role_member.role == self.organization.default_role
        assert not self.restricted_custom_role_member.flags["idp:role-restricted"]

    def test_set_to_default(self) -> None:
        # If we're updating a role, then the user is saying that they want the IDP to manage the role

        # current Unrestricted Default role + default sentryOrgRole -> restricted default role
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
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
            **generate_put_data(
                self.restricted_custom_role_member, role=self.organization.default_role
            ),
        )
        self.restricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == self.organization.default_role
        assert self.restricted_custom_role_member.role == self.organization.default_role
        assert self.restricted_custom_role_member.flags["idp:role-restricted"]

    def test_set_to_new_role(self) -> None:
        new_role = "admin"
        # If we're updating a role, then the user is saying that they want the IDP to manage the role

        # current Unrestricted Default role + custom sentryOrgRole -> restricted custom role
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_default_role_member.id,
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
            **generate_put_data(self.restricted_custom_role_member, role=new_role),
        )
        self.restricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == new_role
        assert self.restricted_custom_role_member.role == new_role
        assert self.restricted_custom_role_member.flags["idp:role-restricted"]

    def test_set_to_same_custom_role(self) -> None:
        same_role = self.unrestricted_custom_role_member.role

        assert not self.unrestricted_custom_role_member.flags["idp:role-restricted"]

        # current Unrestricted custom role + same custom sentryOrgRole -> restricted same custom role
        resp = self.get_success_response(
            self.organization.slug,
            self.unrestricted_custom_role_member.id,
            **generate_put_data(
                self.unrestricted_custom_role_member,
                role=same_role,
            ),
        )
        self.unrestricted_custom_role_member.refresh_from_db()
        assert resp.data["sentryOrgRole"] == same_role
        assert self.unrestricted_custom_role_member.role == same_role
        assert self.unrestricted_custom_role_member.flags["idp:role-restricted"]

    def test_cannot_set_partnership_member_role(self) -> None:
        self.partnership_member = self.create_member(
            user=self.create_user(),
            organization=self.organization,
            role="manager",
            flags=OrganizationMember.flags["partnership:restricted"],
        )
        self.get_error_response(
            self.organization.slug,
            self.partnership_member.id,
            status_code=403,
            **generate_put_data(self.partnership_member, role="member"),
        )


class SCIMMemberDetailsTests(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-member-details"

    def test_user_details_get(self) -> None:
        member = self.create_member(organization=self.organization, email="test.user@okta.local")
        response = self.get_success_response(
            self.organization.slug,
            member.id,
        )
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

    def test_user_details_set_inactive(self) -> None:
        member = self.create_member(
            user=self.create_user(email="test.user@okta.local"), organization=self.organization
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "Replace", "path": "active", "value": False}],
        }
        self.get_success_response(
            self.organization.slug,
            member.id,
            raw_data=patch_req,
            method="patch",
        )

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist), assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.get(auth_provider=self.auth_provider_inst, id=member.id)

    def test_user_details_cannot_set_partnership_member_inactive(self) -> None:
        member = self.create_member(
            user=self.create_user(email="test.user@okta.local"),
            organization=self.organization,
            flags=OrganizationMember.flags["partnership:restricted"],
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "Replace", "path": "active", "value": False}],
        }
        self.get_error_response(
            self.organization.slug, member.id, raw_data=patch_req, method="patch", status_code=403
        )

    def test_user_details_set_inactive_dict(self) -> None:
        member = self.create_member(
            user=self.create_user(email="test.user@okta.local"), organization=self.organization
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "Replace", "value": {"active": False}}],
        }
        self.get_success_response(
            self.organization.slug,
            member.id,
            raw_data=patch_req,
            method="patch",
        )

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist), assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.get(auth_provider=self.auth_provider_inst, id=member.id)

    def test_user_details_set_inactive_with_bool_string(self) -> None:
        member = self.create_member(
            user=self.create_user(email="test.user@okta.local"), organization=self.organization
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "Replace", "path": "active", "value": "False"}],
        }
        self.get_success_response(
            self.organization.slug,
            member.id,
            raw_data=patch_req,
            method="patch",
        )

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist), assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.get(auth_provider=self.auth_provider_inst, id=member.id)

    def test_user_details_set_inactive_with_dict_bool_string(self) -> None:
        member = self.create_member(
            user=self.create_user(email="test.user@okta.local"), organization=self.organization
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "Replace", "value": {"id": "xxxx", "active": "False"}}],
        }
        self.get_success_response(
            self.organization.slug,
            member.id,
            raw_data=patch_req,
            method="patch",
        )

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        with pytest.raises(AuthIdentity.DoesNotExist), assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.get(auth_provider=self.auth_provider_inst, id=member.id)

    def test_invalid_patch_op(self) -> None:
        member = self.create_member(
            user=self.create_user(email="test.user@okta.local"), organization=self.organization
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "invalid", "value": {"active": False}}],
        }
        self.get_error_response(
            self.organization.slug, member.id, raw_data=patch_req, method="patch", status_code=400
        )

    def test_invalid_patch_op_value(self) -> None:
        member = self.create_member(
            user=self.create_user(email="test.user@okta.local"), organization=self.organization
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "REPLACE", "value": {"active": "invalid"}}],
        }
        self.get_error_response(
            self.organization.slug, member.id, raw_data=patch_req, method="patch", status_code=400
        )

    def test_user_details_get_404(self) -> None:
        self.get_error_response(self.organization.slug, 99999999, status_code=404)

    def test_user_details_patch_404(self) -> None:
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "replace", "value": {"active": False}}],
        }
        self.get_error_response(
            self.organization.slug, 99999999, raw_data=patch_req, method="patch", status_code=404
        )

    def test_delete_route(self) -> None:
        member = self.create_member(user=self.create_user(), organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        self.get_success_response(
            self.organization.slug,
            member.id,
            method="delete",
        )

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)
        with pytest.raises(AuthIdentity.DoesNotExist), assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.get(auth_provider=self.auth_provider_inst, id=member.id)

    def test_cannot_delete_partnership_member(self) -> None:
        member = self.create_member(
            user=self.create_user(),
            organization=self.organization,
            flags=OrganizationMember.flags["partnership:restricted"],
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )
        self.get_error_response(self.organization.slug, member.id, method="delete", status_code=403)

    def test_patch_inactive_alternate_schema(self) -> None:
        member = self.create_member(user=self.create_user(), organization=self.organization)
        patch_req = {"Operations": [{"op": "replace", "path": "active", "value": False}]}
        self.get_success_response(
            self.organization.slug,
            member.id,
            raw_data=patch_req,
            method="patch",
        )
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

    def test_patch_bad_schema(self) -> None:
        member = self.create_member(user=self.create_user(), organization=self.organization)
        patch_req = {"Operations": [{"op": "replace", "path": "blahblahbbalh", "value": False}]}
        response = self.get_error_response(
            self.organization.slug, member.id, raw_data=patch_req, method="patch", status_code=400
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Invalid Patch Operation.",
        }

        patch_req = {"Operations": [{"op": "replace", "value": False}]}
        response = self.get_error_response(
            self.organization.slug, member.id, raw_data=patch_req, method="patch", status_code=400
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": "Invalid Patch Operation.",
        }

    def test_member_detail_patch_too_many_ops(self) -> None:
        member = self.create_member(user=self.create_user(), organization=self.organization)
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "replace", "path": "active", "value": False}] * 101,
        }
        response = self.get_error_response(
            self.organization.slug, member.id, raw_data=patch_req, method="patch", status_code=400
        )

        assert response.status_code == 400, response.data
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
            "detail": '{"Operations":["Ensure this field has no more than 100 elements."]}',
        }

    # Disabling below test for now.
    # need to see what Okta admins would expect to happen with invited members
    # def test_request_invite_members_not_in_requests(self) -> None:
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

    def test_overflow_cases(self) -> None:
        member = self.create_member(user=self.create_user(), organization=self.organization)
        self.get_error_response(
            self.organization.slug, "010101001010101011001010101011", status_code=404
        )
        self.get_error_response(
            self.organization.slug,
            "010101001010101011001010101011",
            raw_data={},
            method="patch",
            status_code=404,
        )
        self.get_error_response(
            self.organization.slug,
            "010101001010101011001010101011",
            raw_data=member.id,
            method="delete",
            status_code=404,
        )

    def test_cant_delete_only_owner_route(self) -> None:
        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        self.get_error_response(
            self.organization.slug,
            member_om.id,
            method="delete",
            status_code=403,
        )

    def test_cant_delete_only_owner_route_patch(self) -> None:
        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "replace", "value": {"active": False}}],
        }
        self.get_error_response(
            self.organization.slug,
            member_om.id,
            raw_data=patch_req,
            method="patch",
            status_code=403,
        )

    # TODO: test patch with bad op


class SCIMMemberDetailsAzureTests(SCIMAzureTestCase):
    endpoint = "sentry-api-0-organization-scim-member-details"

    def test_user_details_get_no_active(self) -> None:
        member = self.create_member(organization=self.organization, email="test.user@okta.local")
        response = self.get_success_response(self.organization.slug, member.id)
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(member.id),
            "userName": "test.user@okta.local",
            "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
            "name": {"familyName": "N/A", "givenName": "N/A"},
            "meta": {"resourceType": "User"},
            "sentryOrgRole": self.organization.default_role,
        }


@override_settings(SENTRY_MODE=SentryMode.SAAS)
class SCIMMemberSaasPrivilegeRevocationTests(SCIMTestCase):
    """
    Tests for SCIM member deletion in SaaS mode with the default organization.
    When deleting members with superuser/staff privileges, those privileges should
    be revoked in addition to deleting the membership.
    """

    endpoint = "sentry-api-0-organization-scim-member-details"

    @patch("sentry.core.endpoints.scim.members.user_service")
    def test_delete_superuser_in_saas_default_org_revokes_privileges_and_deletes_membership(
        self, mock_user_service
    ) -> None:
        """
        In SaaS mode with default org, deleting a superuser should revoke
        superuser privileges and delete the membership.
        """
        superuser = self.create_user(is_superuser=True, is_staff=False)
        member = self.create_member(user=superuser, organization=self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )

        # Mock user_service to return the superuser
        mock_user_service.get_user.return_value = RpcUser(
            id=superuser.id,
            is_superuser=True,
            is_staff=False,
        )

        with self.settings(SUPERUSER_ORG_ID=self.organization.id):
            self.get_success_response(self.organization.slug, member.id, method="delete")

        # Membership should be deleted
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        # Verify user_service.update_user was called to revoke privileges
        mock_user_service.update_user.assert_called_once_with(
            user_id=superuser.id,
            attrs={
                "is_superuser": False,
                "is_staff": False,
            },
        )

    @patch("sentry.core.endpoints.scim.members.user_service")
    def test_delete_staff_in_saas_default_org_revokes_privileges_and_deletes_membership(
        self, mock_user_service
    ) -> None:
        """
        In SaaS mode with default org, deleting a staff member should revoke
        staff privileges and delete the membership.
        """
        staff_user = self.create_user(is_superuser=False, is_staff=True)
        member = self.create_member(user=staff_user, organization=self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )

        # Mock user_service to return the staff user
        mock_user_service.get_user.return_value = RpcUser(
            id=staff_user.id,
            is_superuser=False,
            is_staff=True,
        )

        with self.settings(SUPERUSER_ORG_ID=self.organization.id):
            self.get_success_response(self.organization.slug, member.id, method="delete")

        # Membership should be deleted
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        # Verify user_service.update_user was called to revoke privileges
        mock_user_service.update_user.assert_called_once_with(
            user_id=staff_user.id,
            attrs={
                "is_superuser": False,
                "is_staff": False,
            },
        )

    @patch("sentry.core.endpoints.scim.members.user_service")
    def test_delete_user_with_both_privileges_in_saas_default_org_revokes_both_and_deletes_membership(
        self, mock_user_service
    ) -> None:
        """
        In SaaS mode with default org, deleting a user with both superuser and
        staff privileges should revoke both and delete the membership.
        """
        admin_user = self.create_user(is_superuser=True, is_staff=True)
        member = self.create_member(user=admin_user, organization=self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )

        # Mock user_service to return the admin user
        mock_user_service.get_user.return_value = RpcUser(
            id=admin_user.id,
            is_superuser=True,
            is_staff=True,
        )

        with self.settings(SUPERUSER_ORG_ID=self.organization.id):
            self.get_success_response(self.organization.slug, member.id, method="delete")

        # Membership should be deleted
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        # Verify user_service.update_user was called to revoke both privileges
        mock_user_service.update_user.assert_called_once_with(
            user_id=admin_user.id,
            attrs={
                "is_superuser": False,
                "is_staff": False,
            },
        )

    def test_delete_regular_user_in_non_default_org_deletes_membership_only(self) -> None:
        """
        In SaaS mode with default org, deleting a regular user (no elevated privileges)
        should proceed with normal deletion.
        """
        regular_user = self.create_user(is_superuser=False, is_staff=False)
        member = self.create_member(user=regular_user, organization=self.organization)

        # Regular user deletion should proceed normally (not matching default org ID)
        with self.settings(SUPERUSER_ORG_ID=999999):
            self.get_success_response(self.organization.slug, member.id, method="delete")

        # Membership should be deleted
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

    @patch("sentry.core.endpoints.scim.members.user_service")
    def test_patch_inactive_superuser_in_saas_default_org_revokes_privileges_and_deletes_membership(
        self, mock_user_service
    ) -> None:
        """
        In SaaS mode with default org, PATCH with active=false for a superuser
        should revoke superuser privileges and delete the membership.
        """
        superuser = self.create_user(is_superuser=True, is_staff=False)
        member = self.create_member(user=superuser, organization=self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )

        # Mock user_service to return the superuser
        mock_user_service.get_user.return_value = RpcUser(
            id=superuser.id,
            is_superuser=True,
            is_staff=False,
        )

        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "Replace", "path": "active", "value": False}],
        }

        with self.settings(SUPERUSER_ORG_ID=self.organization.id):
            self.get_success_response(
                self.organization.slug, member.id, raw_data=patch_req, method="patch"
            )

        # Membership should be deleted
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        # Verify user_service.update_user was called to revoke privileges
        mock_user_service.update_user.assert_called_once_with(
            user_id=superuser.id,
            attrs={
                "is_superuser": False,
                "is_staff": False,
            },
        )

    @patch("sentry.core.endpoints.scim.members.user_service")
    def test_patch_inactive_staff_in_saas_default_org_revokes_privileges_and_deletes_membership(
        self, mock_user_service
    ) -> None:
        """
        In SaaS mode with default org, PATCH with active=false for a staff member
        should revoke staff privileges and delete the membership.
        """
        staff_user = self.create_user(is_superuser=False, is_staff=True)
        member = self.create_member(user=staff_user, organization=self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthIdentity.objects.create(
                user_id=member.user_id, auth_provider=self.auth_provider_inst, ident="test_ident"
            )

        # Mock user_service to return the staff user
        mock_user_service.get_user.return_value = RpcUser(
            id=staff_user.id,
            is_superuser=False,
            is_staff=True,
        )

        patch_req = {
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
            "Operations": [{"op": "Replace", "value": {"active": False}}],
        }

        with self.settings(SUPERUSER_ORG_ID=self.organization.id):
            self.get_success_response(
                self.organization.slug, member.id, raw_data=patch_req, method="patch"
            )

        # Membership should be deleted
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        # Verify user_service.update_user was called to revoke privileges
        mock_user_service.update_user.assert_called_once_with(
            user_id=staff_user.id,
            attrs={
                "is_superuser": False,
                "is_staff": False,
            },
        )

    @override_settings(SENTRY_MODE=SentryMode.SAAS)
    @patch("sentry.core.endpoints.scim.members.user_service")
    def test_delete_staff_without_superuser_org_configured_preserves_privileges(
        self, mock_user_service: MagicMock
    ) -> None:
        """When SUPERUSER_ORG_ID is None (not configured), SCIM deletion doesn't revoke privileges"""
        staff_user = self.create_user(
            email="staff_user@example.com", is_superuser=False, is_staff=True
        )
        member = self.create_member(user=staff_user, organization=self.organization)

        # SUPERUSER_ORG_ID defaults to None, don't override it
        # Even though we're in SaaS mode, privileges should NOT be revoked
        self.get_success_response(self.organization.slug, member.id, method="delete")

        # Membership should be deleted
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(organization=self.organization, id=member.id)

        # Verify user_service.update_user was NOT called (privileges preserved)
        mock_user_service.update_user.assert_not_called()


@no_silo_test
class SCIMUtilsTests(unittest.TestCase):
    def test_parse_filter_conditions_basic(self) -> None:
        fil = parse_filter_conditions('userName eq "user@sentry.io"')
        assert fil == "user@sentry.io"

        # single quotes too
        fil = parse_filter_conditions("userName eq 'user@sentry.io'")
        assert fil == "user@sentry.io"

        fil = parse_filter_conditions('value eq "23"')
        assert fil == 23

        fil = parse_filter_conditions('displayName eq "MyTeamName"')
        assert fil == "MyTeamName"

    def test_parse_filter_conditions_invalids(self) -> None:
        with pytest.raises(SCIMFilterError):
            parse_filter_conditions("userName invalid USER@sentry.io")
        with pytest.raises(SCIMFilterError):
            parse_filter_conditions("blablaba eq USER@sentry.io")

    def test_parse_filter_conditions_single_quote_in_email(self) -> None:
        fil = parse_filter_conditions('userName eq "jos\'h@sentry.io"')
        assert fil == "jos'h@sentry.io"

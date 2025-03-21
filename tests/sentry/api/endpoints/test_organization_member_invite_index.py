from dataclasses import replace
from unittest.mock import patch

from django.core import mail

from sentry import roles
from sentry.api.endpoints.accept_organization_invite import get_invite_state
from sentry.api.endpoints.organization_member_invite.index import (
    OrganizationMemberInviteRequestSerializer,
)
from sentry.api.invite_helper import ApiInviteHelper
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.roles import organization_roles
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import Feature, with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.useremail import UserEmail


def mock_organization_roles_get_factory(original_organization_roles_get):
    def wrapped_method(role):
        # emulate the 'member' role not having team-level permissions
        role_obj = original_organization_roles_get(role)
        if role == "member":
            return replace(role_obj, is_team_roles_allowed=False)
        return role_obj

    return wrapped_method


class OrganizationMemberInviteRequestSerializerTest(TestCase):
    def test_valid(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {
            "email": "mifu@email.com",
            "orgRole": "member",
            "teams": [self.team.slug],
        }
        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)
        assert serializer.is_valid()
        assert serializer.validated_data["teams"][0] == self.team

    def test_member_with_email_exists(self):
        org = self.create_organization()
        user = self.create_user()
        self.create_member(organization=org, user=user)

        context = {"organization": org, "allowed_roles": [roles.get("member")]}
        data = {"email": user.email, "orgRole": "member", "teams": []}

        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {"email": [f"The user {user.email} is already a member"]}

    def test_invite_with_email_exists(self):
        email = "mifu@email.com"
        self.create_member_invite(organization=self.organization, email=email)
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": email, "orgRole": "member", "teamRoles": []}

        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {"email": [f"The user {email} has already been invited"]}

    def test_invalid_team_invites(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "mifu@email.com", "orgRole": "member", "teams": ["faketeam"]}

        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {"teams": ["Invalid teams"]}

    def test_invalid_org_role(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": "mifu@email.com", "orgRole": "owner", "teamRoles": []}

        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {
            "orgRole": ["You do not have permission to set that org-level role"]
        }

    @with_feature({"organizations:team-roles": False})
    def test_deprecated_org_role_without_flag(self):
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("admin"), roles.get("member")],
        }
        data = {"email": "mifu@email.com", "orgRole": "admin", "teams": []}

        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)
        assert serializer.is_valid()

    @with_feature("organizations:team-roles")
    def test_deprecated_org_role_with_flag(self):
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("admin"), roles.get("member")],
        }
        data = {"email": "mifu@email.com", "orgRole": "admin", "teams": []}

        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)
        assert serializer.is_valid()

    @with_feature("organizations:invite-billing")
    def test_valid_invite_billing_member(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {
            "email": "bill@localhost",
            "orgRole": "billing",
            "teamRoles": [],
        }

        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)
        assert serializer.is_valid()

    def test_invalid_invite_billing_member(self):
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {
            "email": "bill@localhost",
            "orgRole": "billing",
            "teamRoles": [],
        }

        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)
        assert not serializer.is_valid()


class OrganizationMemberInviteListTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-invite-index"

    def setUp(self):
        self.approved_invite = self.create_member_invite(
            organization=self.organization, email="user1@email.com"
        )
        self.requested_invite = self.create_member_invite(
            organization=self.organization,
            email="user2@email.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

    def test_simple(self):
        # if requestor doesn't have org admin permissions, only list approved invites
        user = self.create_user("mifu@email.com", username="mifu")
        self.create_member(organization=self.organization, user=user)
        self.login_as(user)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["email"] == self.approved_invite.email
        # make sure we don't serialize token
        assert not response.data[0].get("token")

    def test_staff(self):
        self.login_as(self.user)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert response.data[0]["email"] == self.approved_invite.email
        assert response.data[0]["inviteStatus"] == "approved"
        assert response.data[1]["email"] == self.requested_invite.email
        assert response.data[1]["inviteStatus"] == "requested_to_be_invited"

    def test_org_owner(self):
        user = self.create_user("supreme-mifu@email.com", username="powerful mifu")
        self.create_member(organization=self.organization, user=user, role="owner")
        self.login_as(user)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert response.data[0]["email"] == self.approved_invite.email
        assert response.data[0]["inviteStatus"] == "approved"
        assert response.data[1]["email"] == self.requested_invite.email
        assert response.data[1]["inviteStatus"] == "requested_to_be_invited"

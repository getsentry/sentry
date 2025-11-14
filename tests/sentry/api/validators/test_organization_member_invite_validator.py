from typing import int
from sentry import roles
from sentry.api.serializers.rest_framework.organizationmemberinvite import (
    OrganizationMemberInviteRequestValidator,
)
from sentry.models.organizationmemberinvite import InviteStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature


class OrganizationMemberInviteRequestValidatorTest(TestCase):
    def test_valid(self) -> None:
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("member")],
            "actor": self.user,
        }
        data = {
            "email": "mifu@email.com",
            "orgRole": "member",
            "teams": [self.team.slug],
        }
        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)
        assert serializer.is_valid()
        assert serializer.validated_data["teams"][0] == self.team

    def test_member_with_email_exists(self) -> None:
        org = self.create_organization()
        user = self.create_user()
        self.create_member(organization=org, user=user)

        context = {
            "organization": org,
            "allowed_roles": [roles.get("member")],
            "actor": self.user,
        }
        data = {"email": user.email, "orgRole": "member", "teams": []}

        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {"email": [f"The user {user.email} is already a member"]}

    def test_invite_with_email_exists(self) -> None:
        email = "mifu@email.com"
        self.create_member_invite(organization=self.organization, email=email)
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("member")],
            "actor": self.user,
        }
        data = {"email": email, "orgRole": "member", "teamRoles": []}

        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {"email": [f"The user {email} has already been invited"]}

    def test_invalid_team_invites(self) -> None:
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("member")],
            "actor": self.user,
        }
        data = {"email": "mifu@email.com", "orgRole": "member", "teams": ["faketeam"]}

        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {"teams": ["Invalid teams"]}

    def test_invalid_org_role(self) -> None:
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("member")],
            "actor": self.user,
        }
        data = {"email": "mifu@email.com", "orgRole": "owner", "teamRoles": []}

        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {
            "orgRole": ["You do not have permission to invite a member with that org-level role"]
        }

    def test_cannot_invite_with_existing_request(self) -> None:
        email = "test@gmail.com"

        self.create_member_invite(
            email=email,
            organization=self.organization,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("member")],
            "actor": self.user,
        }
        data = {"email": email, "orgRole": "member", "teams": [self.team.slug]}
        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {
            "email": ["There is an existing invite request for test@gmail.com"]
        }

    @with_feature("organizations:team-roles")
    def test_deprecated_org_role_with_flag(self) -> None:
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("admin"), roles.get("member")],
            "actor": self.user,
        }
        data = {"email": "mifu@email.com", "orgRole": "admin", "teams": []}

        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {
            "orgRole": [
                "The role 'admin' is deprecated, and members may no longer be invited with it."
            ]
        }

    @with_feature({"organizations:team-roles": False})
    def test_deprecated_org_role_without_flag(self) -> None:
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("admin"), roles.get("member")],
            "actor": self.user,
        }
        data = {"email": "mifu@email.com", "orgRole": "admin", "teams": []}

        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)
        assert serializer.is_valid()

    @with_feature("organizations:invite-billing")
    def test_valid_invite_billing_member(self) -> None:
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("member")],
            "actor": self.user,
        }
        data = {
            "email": "bill@localhost",
            "orgRole": "billing",
            "teamRoles": [],
        }

        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)
        assert serializer.is_valid()

    def test_invalid_invite_billing_member(self) -> None:
        context = {
            "organization": self.organization,
            "allowed_roles": [roles.get("member")],
            "actor": self.user,
        }
        data = {
            "email": "bill@localhost",
            "orgRole": "billing",
            "teamRoles": [],
        }

        serializer = OrganizationMemberInviteRequestValidator(context=context, data=data)
        assert not serializer.is_valid()

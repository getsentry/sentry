from dataclasses import replace
from unittest.mock import patch

from sentry import roles
from sentry.api.endpoints.organization_member_invite.index import (
    OrganizationMemberInviteRequestSerializer,
)
from sentry.models.organizationmember import InviteStatus
from sentry.models.organizationmemberinvite import OrganizationMemberInvite
from sentry.roles import organization_roles
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import Feature, with_feature


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
            "orgRole": ["You do not have permission to invite a member with that org-level role"]
        }

    def test_cannot_invite_with_existing_request(self):
        email = "test@gmail.com"

        self.create_member_invite(
            email=email,
            organization=self.organization,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        context = {"organization": self.organization, "allowed_roles": [roles.get("member")]}
        data = {"email": email, "orgRole": "member", "teams": [self.team.slug]}
        serializer = OrganizationMemberInviteRequestSerializer(context=context, data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {
            "email": ["There is an existing invite request for test@gmail.com"]
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


class OrganizationMemberInvitePermissionRoleTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-invite-index"
    method = "post"

    def setUp(self):
        self.login_as(self.user)

    def invite_all_helper(self, role):
        invite_roles = ["owner", "manager", "member"]

        user = self.create_user("user@localhost")
        member = self.create_member(user=user, organization=self.organization, role=role)
        self.login_as(user=user)

        self.organization.flags.disable_member_invite = True
        self.organization.save()

        allowed_roles = member.get_allowed_org_roles_to_invite()

        for invite_role in invite_roles:
            data = {
                "email": f"{invite_role}_1@localhost",
                "orgRole": invite_role,
                "teams": [self.team.slug],
            }
            if role == "member" or role == "admin":
                self.get_error_response(self.organization.slug, **data, status_code=403)
            elif any(invite_role == allowed_role.id for allowed_role in allowed_roles):
                self.get_success_response(self.organization.slug, **data, status_code=201)
            else:
                self.get_error_response(self.organization.slug, **data, status_code=400)

        self.organization.flags.disable_member_invite = False
        self.organization.save()

        for invite_role in invite_roles:
            data = {
                "email": f"{invite_role}_2@localhost",
                "orgRole": invite_role,
                "teams": [self.team.slug],
            }
            if any(invite_role == allowed_role.id for allowed_role in allowed_roles):
                self.get_success_response(self.organization.slug, **data, status_code=201)
            else:
                self.get_error_response(self.organization.slug, **data, status_code=400)

    def invite_to_other_team_helper(self, role):
        user = self.create_user("inviter@localhost")
        self.create_member(user=user, organization=self.organization, role=role, teams=[self.team])
        self.login_as(user=user)

        other_team = self.create_team(organization=self.organization, name="Moo Deng's Team")

        def get_data(email: str, other_team_invite: bool = False):
            team_slug = other_team.slug if other_team_invite else self.team.slug
            data: dict[str, str | list] = {
                "email": f"{email}@localhost",
                "orgRole": "member",
                "teams": [team_slug],
            }
            return data

        # members can never invite members if disable_member_invite = True
        self.organization.flags.allow_joinleave = True
        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug, **get_data("foo1"), status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

        self.organization.flags.allow_joinleave = False
        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug, **get_data("foo2"), status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

        # members can only invite members to teams they are in if allow_joinleave = False
        self.organization.flags.allow_joinleave = False
        self.organization.flags.disable_member_invite = False
        self.organization.save()
        self.get_success_response(self.organization.slug, **get_data("foo3"), status_code=201)
        response = self.get_error_response(
            self.organization.slug, **get_data("foo4", True), status_code=400
        )
        assert (
            response.data.get("detail")
            == "You cannot assign members to teams you are not a member of."
        )
        # also test with teams instead of teamRoles
        self.get_success_response(self.organization.slug, **get_data("foo5"), status_code=201)
        response = self.get_error_response(
            self.organization.slug,
            **get_data("foo6", other_team_invite=True),
            status_code=400,
        )
        assert (
            response.data.get("detail")
            == "You cannot assign members to teams you are not a member of."
        )

        # members can invite member to any team if allow_joinleave = True
        self.organization.flags.allow_joinleave = True
        self.organization.flags.disable_member_invite = False
        self.organization.save()
        self.get_success_response(self.organization.slug, **get_data("foo7"), status_code=201)
        self.get_success_response(self.organization.slug, **get_data("foo8", True), status_code=201)
        # also test with teams instead of teamRoles
        self.get_success_response(self.organization.slug, **get_data("foo9"), status_code=201)
        self.get_success_response(
            self.organization.slug,
            **get_data("foo10", other_team_invite=True),
            status_code=201,
        )

    def test_owner_invites(self):
        self.invite_all_helper("owner")

    def test_manager_invites(self):
        self.invite_all_helper("manager")

    def test_admin_invites(self):
        self.invite_all_helper("admin")
        self.invite_to_other_team_helper("admin")

    def test_member_invites(self):
        self.invite_all_helper("member")
        self.invite_to_other_team_helper("member")

    def test_respects_feature_flag(self):
        user = self.create_user("baz@example.com")

        with Feature({"organizations:invite-members": False}):
            data = {"email": user.email, "orgRole": "member", "teams": [self.team.slug]}
            self.get_error_response(self.organization.slug, **data, status_code=403)

    def test_no_team_invites(self):
        data = {"email": "eric@localhost", "orgRole": "owner", "teams": []}
        response = self.get_success_response(self.organization.slug, **data)
        assert response.data["email"] == "eric@localhost"


class OrganizationMemberInviteListPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-invite-index"
    method = "post"

    def setUp(self):
        self.login_as(self.user)

    def test_forbid_qq(self):
        data = {"email": "1234@qq.com", "orgRole": "member", "teams": [self.team.slug]}
        response = self.get_error_response(self.organization.slug, **data, status_code=400)
        assert response.data["email"][0] == "Enter a valid email address."

    @patch.object(OrganizationMemberInvite, "send_invite_email")
    def test_simple(self, mock_send_invite_email):
        data = {"email": "mifu@email.com", "orgRole": "member", "teams": [self.team.slug]}
        response = self.get_success_response(self.organization.slug, **data)

        omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
        assert omi.email == "mifu@email.com"
        assert omi.role == "member"
        assert omi.organization_member_team_data == [
            {"id": self.team.id, "role": None, "slug": self.team.slug}
        ]
        assert omi.inviter_id == self.user.id

        mock_send_invite_email.assert_called_once()

    def test_no_teams(self):
        data = {"email": "mifu@email.com", "orgRole": "member", "teams": []}
        response = self.get_success_response(self.organization.slug, **data)

        omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
        assert omi.email == "mifu@email.com"
        assert omi.role == "member"
        assert omi.organization_member_team_data == []
        assert omi.inviter_id == self.user.id

    @patch.object(OrganizationMemberInvite, "send_invite_email")
    def test_no_send_invite(self, mock_send_invite_email):
        data = {
            "email": "mifu@email.com",
            "orgRole": "member",
            "teams": [self.team.slug],
            "sendInvite": False,
        }
        response = self.get_success_response(self.organization.slug, **data)

        omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
        assert omi.email == "mifu@email.com"
        assert omi.role == "member"
        assert omi.organization_member_team_data == [
            {"id": self.team.id, "role": None, "slug": self.team.slug}
        ]
        assert omi.inviter_id == self.user.id

        assert not mock_send_invite_email.mock_calls

    @patch.object(OrganizationMemberInvite, "send_invite_email")
    def test_referrer_param(self, mock_send_invite_email):
        data = {"email": "mifu@email.com", "orgRole": "member", "teams": [self.team.slug]}
        response = self.get_success_response(
            self.organization.slug, **data, qs_params={"referrer": "test_referrer"}
        )

        omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
        assert omi.email == "mifu@email.com"
        assert omi.role == "member"
        assert omi.organization_member_team_data == [
            {"id": self.team.id, "role": None, "slug": self.team.slug}
        ]
        assert omi.inviter_id == self.user.id

        mock_send_invite_email.assert_called_with("test_referrer")

    @patch.object(OrganizationMemberInvite, "send_invite_email")
    def test_internal_integration_token_can_only_invite_member_role(self, mock_send_invite_email):
        internal_integration = self.create_internal_integration(
            name="Internal App", organization=self.organization, scopes=["member:write"]
        )
        token = self.create_internal_integration_token(
            user=self.user, internal_integration=internal_integration
        )
        err_message = (
            "Integration tokens are restricted to inviting new members with the member role only."
        )

        data = {"email": "cat@meow.com", "orgRole": "owner", "teams": [self.team.slug]}
        response = self.get_error_response(
            self.organization.slug,
            **data,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=400,
        )
        assert response.data[0] == err_message

        data = {"email": "dog@woof.com", "orgRole": "manager", "teams": [self.team.slug]}
        response = self.get_error_response(
            self.organization.slug,
            **data,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=400,
        )
        assert response.data[0] == err_message

        data = {"email": "mifu@email.com", "orgRole": "member", "teams": [self.team.slug]}
        response = self.get_success_response(
            self.organization.slug,
            **data,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=201,
        )

        omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
        assert omi.email == "mifu@email.com"
        assert omi.role == "member"
        assert omi.organization_member_team_data == [
            {"id": self.team.id, "slug": self.team.slug, "role": None}
        ]

        mock_send_invite_email.assert_called_once()

    @patch("sentry.ratelimits.for_organization_member_invite")
    def test_rate_limited(self, mock_rate_limit):
        mock_rate_limit.return_value = True

        data = {"email": "mifu@email.com", "role": "member"}
        self.get_error_response(self.organization.slug, **data, status_code=429)
        assert not OrganizationMemberInvite.objects.filter(email="mifu@email.com").exists()

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_cannot_add_to_team_when_team_roles_disabled(self, mock_get):
        owner_user = self.create_user("owner@localhost")
        self.owner = self.create_member(
            user=owner_user, organization=self.organization, role="owner"
        )
        self.login_as(user=owner_user)

        data = {
            "email": "mifu@email.com",
            "orgRole": "member",
            "teams": [self.team.slug],
        }
        response = self.get_error_response(self.organization.slug, **data, status_code=400)
        assert (
            response.data["email"]
            == "The user with a 'member' role cannot have team-level permissions."
        )

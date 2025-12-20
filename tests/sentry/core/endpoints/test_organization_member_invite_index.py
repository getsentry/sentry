from dataclasses import replace
from unittest.mock import MagicMock, patch

from sentry.models.organizationmemberinvite import InviteStatus, OrganizationMemberInvite
from sentry.roles import organization_roles
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature, with_feature
from sentry.users.models.useremail import UserEmail


def mock_organization_roles_get_factory(original_organization_roles_get):
    def wrapped_method(role):
        # emulate the 'member' role not having team-level permissions
        role_obj = original_organization_roles_get(role)
        if role == "member":
            return replace(role_obj, is_team_roles_allowed=False)
        return role_obj

    return wrapped_method


@with_feature("organizations:new-organization-member-invite")
class OrganizationMemberInviteListTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-invite-index"

    def setUp(self) -> None:
        self.approved_invite = self.create_member_invite(
            organization=self.organization, email="user1@email.com"
        )
        self.requested_invite = self.create_member_invite(
            organization=self.organization,
            email="user2@email.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

    def test_simple(self) -> None:
        self.login_as(self.user)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert response.data[0]["email"] == self.approved_invite.email
        assert response.data[0]["inviteStatus"] == "approved"
        assert response.data[1]["email"] == self.requested_invite.email
        assert response.data[1]["inviteStatus"] == "requested_to_be_invited"

        # make sure we don't serialize token
        assert not response.data[0].get("token")


@with_feature("organizations:new-organization-member-invite")
class OrganizationMemberInvitePermissionRoleTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-invite-index"
    method = "post"

    def setUp(self) -> None:
        self.login_as(self.user)

    def invite_all_helper(self, role):
        invite_roles = ["owner", "manager", "member"]

        user = self.create_user("user@localhost")
        member = self.create_member(user=user, organization=self.organization, role=role)
        self.login_as(user=user)

        # When this is set to True, only roles with the member:admin permission can invite members
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
                response = self.get_success_response(
                    self.organization.slug, **data, status_code=201
                )
                omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
                assert omi.invite_status == InviteStatus.REQUESTED_TO_BE_INVITED.value
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
        # an invite request will be created instead of an invite
        self.organization.flags.allow_joinleave = True
        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_success_response(
            self.organization.slug, **get_data("foo1"), status_code=201
        )
        omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
        assert omi.invite_status == InviteStatus.REQUESTED_TO_BE_INVITED.value

        self.organization.flags.allow_joinleave = False
        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_success_response(
            self.organization.slug, **get_data("foo2"), status_code=201
        )
        omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
        assert omi.invite_status == InviteStatus.REQUESTED_TO_BE_INVITED.value

        # members can only invite members to teams they are in if allow_joinleave = False
        self.organization.flags.allow_joinleave = False
        self.organization.flags.disable_member_invite = False
        self.organization.save()
        self.get_success_response(self.organization.slug, **get_data("foo3"), status_code=201)
        response = self.get_error_response(
            self.organization.slug, **get_data("foo4", True), status_code=400
        )
        assert (
            response.data["teams"][0]
            == "You cannot assign members to teams you are not a member of."
        )
        response = self.get_error_response(
            self.organization.slug,
            **get_data("foo5", other_team_invite=True),
            status_code=400,
        )
        assert (
            response.data["teams"][0]
            == "You cannot assign members to teams you are not a member of."
        )

        # members can invite member to any team if allow_joinleave = True
        self.organization.flags.allow_joinleave = True
        self.organization.flags.disable_member_invite = False
        self.organization.save()
        self.get_success_response(self.organization.slug, **get_data("foo6"), status_code=201)
        self.get_success_response(self.organization.slug, **get_data("foo7", True), status_code=201)
        self.get_success_response(
            self.organization.slug,
            **get_data("foo8", other_team_invite=True),
            status_code=201,
        )

    def test_owner_invites(self) -> None:
        self.invite_all_helper("owner")

    def test_manager_invites(self) -> None:
        self.invite_all_helper("manager")

    def test_admin_invites(self) -> None:
        self.invite_all_helper("admin")
        self.invite_to_other_team_helper("admin")

    def test_member_invites(self) -> None:
        self.invite_all_helper("member")
        self.invite_to_other_team_helper("member")

    def test_respects_feature_flag(self) -> None:
        user = self.create_user("baz@example.com")

        with Feature({"organizations:invite-members": False}):
            data = {"email": user.email, "orgRole": "member", "teams": [self.team.slug]}
            self.get_error_response(self.organization.slug, **data, status_code=403)

    def test_no_team_invites(self) -> None:
        data = {"email": "eric@localhost", "orgRole": "owner", "teams": []}
        response = self.get_success_response(self.organization.slug, **data)
        assert response.data["email"] == "eric@localhost"


@with_feature("organizations:new-organization-member-invite")
class OrganizationMemberInvitePostTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-invite-index"
    method = "post"

    def setUp(self) -> None:
        self.login_as(self.user)

    def test_forbid_qq(self) -> None:
        data = {"email": "1234@qq.com", "orgRole": "member", "teams": [self.team.slug]}
        response = self.get_error_response(self.organization.slug, **data, status_code=400)
        assert response.data["email"][0] == "Enter a valid email address."

    @with_feature("organizations:new-organization-member-invite")
    def test_unverified_user_cannot_invite(self) -> None:
        UserEmail.objects.filter(user=self.user, email=self.user.email).update(is_verified=False)

        data = {"email": "test@email.com", "orgRole": "member", "teams": [self.team.slug]}
        response = self.get_error_response(self.organization.slug, **data, status_code=403)
        assert "verify your email" in response.data["detail"]

    @patch.object(OrganizationMemberInvite, "send_invite_email")
    def test_simple(self, mock_send_invite_email: MagicMock) -> None:
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

    def test_no_teams(self) -> None:
        data = {"email": "mifu@email.com", "orgRole": "member", "teams": []}
        response = self.get_success_response(self.organization.slug, **data)

        omi = OrganizationMemberInvite.objects.get(id=response.data["id"])
        assert omi.email == "mifu@email.com"
        assert omi.role == "member"
        assert omi.organization_member_team_data == []
        assert omi.inviter_id == self.user.id

    @patch.object(OrganizationMemberInvite, "send_invite_email")
    def test_referrer_param(self, mock_send_invite_email: MagicMock) -> None:
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
    def test_internal_integration_token_can_only_invite_member_role(
        self, mock_send_invite_email: MagicMock
    ) -> None:
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
        assert response.data["orgRole"][0] == err_message

        data = {"email": "dog@woof.com", "orgRole": "manager", "teams": [self.team.slug]}
        response = self.get_error_response(
            self.organization.slug,
            **data,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=400,
        )
        assert response.data["orgRole"][0] == err_message

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
    def test_rate_limited(self, mock_rate_limit: MagicMock) -> None:
        mock_rate_limit.return_value = True

        data = {"email": "mifu@email.com", "orgRole": "member"}
        self.get_error_response(self.organization.slug, **data, status_code=429)
        assert not OrganizationMemberInvite.objects.filter(email="mifu@email.com").exists()

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_cannot_add_to_team_when_team_roles_disabled(self, mock_get: MagicMock) -> None:
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
            response.data["teams"][0]
            == "The user with a 'member' role cannot have team-level permissions."
        )

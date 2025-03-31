from dataclasses import replace
from unittest.mock import patch
from sentry.models.organizationmemberinvite import InviteStatus
from sentry.roles import organization_roles
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls


def mock_organization_roles_get_factory(original_organization_roles_get):
    def wrapped_method(role):
        # emulate the 'member' role not having team-level permissions
        role_obj = original_organization_roles_get(role)
        if role == "member":
            return replace(role_obj, is_team_roles_allowed=False)
        return role_obj

    return wrapped_method


@apply_feature_flag_on_cls("organizations:new-organization-member-invite")
class OrganizationMemberInviteTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-member-invite-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@apply_feature_flag_on_cls("organizations:new-organization-member-invite")
class GetOrganizationMemberInviteTest(OrganizationMemberInviteTestBase):
    def test_simple(self):
        invited_member = self.create_member_invite(
            organization=self.organization, email="matcha@latte.com"
        )
        response = self.get_success_response(self.organization.slug, invited_member.id)
        assert response.data["id"] == str(invited_member.id)
        assert response.data["email"] == "matcha@latte.com"

    def test_invite_request(self):
        # users can also hit this endpoint to view pending invite requests
        invited_member = self.create_member_invite(
            organization=self.organization,
            email="matcha@latte.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        response = self.get_success_response(self.organization.slug, invited_member.id)
        assert response.data["id"] == str(invited_member.id)
        assert response.data["email"] == "matcha@latte.com"
        assert response.data["inviteStatus"] == "requested_to_be_invited"

    def test_get_by_garbage(self):
        self.get_error_response(self.organization.slug, "-1", status_code=404)


class UpdateOrganizationMemberInviteTest(OrganizationMemberInviteTestBase):
    method = "put"

    def setUp(self):
        super().setUp()
        self.regular_user = self.create_user("member@email.com")
        self.curr_member = self.create_member(
            organization=self.organization, role="member", user=self.regular_user
        )

        self.approved_invite = self.create_member_invite(
            organization=self.organization,
            email="matcha@tea.com",
            role="member",
            inviter_id=self.regular_user.id,
        )
        self.invite_request = self.create_member_invite(
            organization=self.organization,
            email="hojicha@tea.com",
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
            inviter_id=self.regular_user.id,
        )
        self.join_request = self.create_member_invite(
            organization=self.organization,
            email="oolong@tea.com",
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
            inviter_id=self.regular_user.id,
        )

    def test_update_org_role(self):
        self.get_success_response(
            self.organization.slug, self.approved_invite.id, orgRole="manager"
        )
        self.approved_invite.refresh_from_db()
        assert self.approved_invite.role == "manager"

    def test_update_teams(self):
        team = self.create_team(organization=self.organization, name="cool-team")
        self.get_success_response(
            self.organization.slug, self.approved_invite.id, teams=[team.slug]
        )
        self.approved_invite.refresh_from_db()
        assert self.approved_invite.organization_member_team_data == [
            {"id": team.id, "slug": team.slug, "role": None}
        ]

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_update_teams_invalid__a(self, mock_get):
        """
        If adding team assignments to an existing invite with orgRole that can't have team-level
        permissions, then we should raise an error.
        """
        team = self.create_team(organization=self.organization, name="cool-team")
        invite = self.create_member_invite(
            organization=self.organization,
            email="mango-yuzu@almonds.com",
            role="member",
        )
        response = self.get_error_response(self.organization.slug, invite.id, teams=[team.slug])
        assert (
            response.data["teams"][0]
            == "The user with a 'member' role cannot have team-level permissions."
        )

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_update_teams_invalid__b(self, mock_get):
        """
        If updating an orgRole to one that can't have team-level assignments when the existing
        invite has team assignments, then we should raise an error.
        """
        team = self.create_team(organization=self.organization, name="cool-team")
        invite = self.create_member_invite(
            organization=self.organization,
            email="mango-yuzu@almonds.com",
            role="manager",
            organization_member_team_data=[{"id": team.id, "slug": team.slug, "role": None}],
        )
        response = self.get_error_response(self.organization.slug, invite.id, orgRole="member")
        assert (
            response.data["orgRole"][0]
            == "The 'member' role cannot be set on an invited user with team assignments."
        )

    # approve invite
    # member can only resend invites
    # if member invite disabled, then member cannot reinvite
    # member cannot resend invite made by a different user
    # cannot edit details when reinviting
    # cannot reinvite without regenerating when token is expired
    # can reinvite without regenerating when token is not expired
    # if join/invite requests are off, then raise an error

    pass

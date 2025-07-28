from dataclasses import replace
from unittest.mock import patch

from sentry.models.organizationmemberinvite import InviteStatus
from sentry.roles import organization_roles
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
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

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)


@apply_feature_flag_on_cls("organizations:new-organization-member-invite")
class GetOrganizationMemberInviteTest(OrganizationMemberInviteTestBase):
    def test_simple(self) -> None:
        invited_member = self.create_member_invite(
            organization=self.organization, email="matcha@latte.com"
        )
        response = self.get_success_response(self.organization.slug, invited_member.id)
        assert response.data["id"] == str(invited_member.id)
        assert response.data["email"] == "matcha@latte.com"

    def test_invite_request(self) -> None:
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

    def test_get_by_garbage(self) -> None:
        self.get_error_response(self.organization.slug, "-1", status_code=404)


@apply_feature_flag_on_cls("organizations:new-organization-member-invite")
class UpdateOrganizationMemberInviteTest(OrganizationMemberInviteTestBase):
    method = "put"

    def setUp(self) -> None:
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

    def test_update_org_role(self) -> None:
        self.get_success_response(
            self.organization.slug, self.approved_invite.id, orgRole="manager"
        )
        self.approved_invite.refresh_from_db()
        assert self.approved_invite.role == "manager"

    def test_cannot_update_with_invalid_role(self) -> None:
        invalid_invite = self.create_member_invite(
            organization=self.organization, email="chocolate@croissant.com"
        )
        self.get_error_response(
            self.organization.slug, invalid_invite.id, orgRole="invalid", status_code=400
        )

    @with_feature("organizations:team-roles")
    def test_can_update_from_retired_role_with_flag(self) -> None:
        invite = self.create_member_invite(
            organization=self.organization,
            email="pistachio@croissant.com",
            role="admin",
        )

        self.get_success_response(self.organization.slug, invite.id, orgRole="member")
        invite.refresh_from_db()
        assert invite.role == "member"

    @with_feature({"organizations:team-roles": False})
    def test_can_update_from_retired_role_without_flag(self) -> None:
        invite = self.create_member_invite(
            organization=self.organization,
            email="pistachio@croissant.com",
            role="admin",
        )

        self.get_success_response(self.organization.slug, invite.id, orgRole="member")
        invite.refresh_from_db()
        assert invite.role == "member"

    @with_feature({"organizations:team-roles": False})
    def test_can_update_to_retired_role_without_flag(self) -> None:
        invite = self.create_member_invite(
            organization=self.organization,
            email="pistachio@croissant.com",
            role="member",
        )

        self.get_success_response(self.organization.slug, invite.id, orgRole="admin")
        invite.refresh_from_db()
        assert invite.role == "admin"

    @with_feature("organizations:team-roles")
    def test_cannot_update_to_retired_role_with_flag(self) -> None:
        invite = self.create_member_invite(
            organization=self.organization,
            email="pistachio@croissant.com",
            role="member",
        )

        self.get_error_response(self.organization.slug, invite.id, orgRole="admin", status_code=400)

    def test_update_teams(self) -> None:
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
    def test_update_teams_invalid_new_teams(self, mock_get):
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
    def test_update_teams_invalid_new_role(self, mock_get):
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

    def test_approve_invite(self) -> None:
        self.get_success_response(self.organization.slug, self.invite_request.id, approve=True)
        self.invite_request.refresh_from_db()
        assert self.invite_request.invite_approved

    def test_cannot_approve_invite_above_self(self) -> None:
        user = self.create_user("manager-mifu@email.com")
        self.create_member(organization=self.organization, role="manager", user=user)
        self.login_as(user)

        invite = self.create_member_invite(
            organization=self.organization,
            email="powerful-mifu@email.com",
            role="owner",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        response = self.get_error_response(self.organization.slug, invite.id, approve=1)
        assert (
            response.data["approve"][0]
            == "You do not have permission to approve a member invitation with the role owner."
        )

    @with_feature({"organizations:invite-members": False})
    def test_cannot_approve_if_invite_requests_disabled(self) -> None:
        response = self.get_error_response(
            self.organization.slug, self.invite_request.id, approve=1
        )
        assert response.data["approve"][0] == "Your organization is not allowed to invite members."

    def test_cannot_modify_partnership_managed_invite(self) -> None:
        invite = self.create_member_invite(
            organization=self.organization,
            email="partnership-mifu@email.com",
            partnership_restricted=True,
        )
        response = self.get_error_response(
            self.organization.slug, invite.id, orgRole="member", status_code=403
        )
        assert (
            response.data["detail"]
            == "This member is managed by an active partnership and cannot be modified until the end of the partnership."
        )

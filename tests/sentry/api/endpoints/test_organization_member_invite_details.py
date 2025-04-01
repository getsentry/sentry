from dataclasses import replace
from unittest.mock import patch

from sentry import audit_log
from sentry.models.organizationmemberinvite import InviteStatus, OrganizationMemberInvite
from sentry.roles import organization_roles
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.outbox import outbox_runner


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


@apply_feature_flag_on_cls("organizations:new-organization-member-invite")
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

    def test_cannot_update_with_invalid_role(self):
        invalid_invite = self.create_member_invite(
            organization=self.organization, email="chocolate@croissant.com"
        )
        self.get_error_response(
            self.organization.slug, invalid_invite.id, orgRole="invalid", status_code=400
        )

    @with_feature("organizations:team-roles")
    def can_update_from_retired_role_with_flag(self):
        invite = self.create_member_invite(
            organization=self.organization,
            email="pistachio@croissant.com",
            role="admin",
        )

        self.get_success_response(self.organization.slug, invite.id, orgRole="member")
        invite.refresh_from_db()
        assert invite.role == "member"

    @with_feature({"organizations:team-roles", False})
    def can_update_from_retired_role_without_flag(self):
        invite = self.create_member_invite(
            organization=self.organization,
            email="pistachio@croissant.com",
            role="admin",
        )

        self.get_success_response(self.organization.slug, invite.id, orgRole="member")
        invite.refresh_from_db()
        assert invite.role == "member"

    @with_feature({"organizations:team-roles", False})
    def can_update_to_retired_role_without_flag(self):
        invite = self.create_member_invite(
            organization=self.organization,
            email="pistachio@croissant.com",
            role="member",
        )

        self.get_success_response(self.organization.slug, invite.id, orgRole="admin")
        invite.refresh_from_db()
        assert invite.role == "admin"

    @with_feature("organizations:team-roles")
    def cannot_update_to_retired_role_with_flag(self):
        invite = self.create_member_invite(
            organization=self.organization,
            email="pistachio@croissant.com",
            role="member",
        )

        self.get_error_response(self.organization.slug, invite.id, orgRole="admin", status_code=400)

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

    def test_approve_invite(self):
        self.get_success_response(self.organization.slug, self.invite_request.id, approve=True)
        self.invite_request.refresh_from_db()
        assert self.invite_request.invite_approved

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_resend_invite(self, mock_send_invite_email):
        self.get_success_response(self.organization.slug, self.approved_invite.id, reinvite=True)
        mock_send_invite_email.assert_called_once()

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_member_resend_invite(self, mock_send_invite_email):
        self.login_as(self.regular_user)
        other_user_invite = self.create_member_invite(
            organization=self.organization,
            email="sencha@tea.com",
            role="member",
            inviter_id=self.user.id,
        )
        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug, self.approved_invite.id, reinvite=1, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        response = self.get_error_response(
            self.organization.slug, other_user_invite.id, reinvite=1, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

        self.organization.flags.disable_member_invite = False
        self.organization.save()

        with outbox_runner():
            self.get_success_response(
                self.organization.slug, self.approved_invite.id, reinvite=True
            )
        mock_send_invite_email.assert_called_once()
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("MEMBER_REINVITE"),
        )
        mock_send_invite_email.reset_mock()

        response = self.get_error_response(
            self.organization.slug, other_user_invite.id, reinvite=1, status_code=403
        )
        assert response.data.get("detail") == "You cannot modify invitations sent by someone else."
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_member_can_only_reinvite(self, mock_send_invite_email):
        self.login_as(self.regular_user)
        team = self.create_team(organization=self.organization, name="team-croissant")

        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.approved_invite.id,
            teams=[team.slug],
            status_code=403,
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.approved_invite.id,
            teams=[team.slug],
            status_code=403,
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_cannot_reinvite_and_modify_member(self, mock_send_invite_email):
        response = self.get_error_response(
            self.organization.slug,
            self.approved_invite.id,
            reinvite=1,
            orgRole="manager",
            status_code=403,
        )
        assert (
            response.data.get("detail")
            == "You cannot modify member details when resending an invitation. Separate requests are required."
        )
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_member_details_not_modified_after_reinviting(self, mock_send_invite_email):
        team = self.create_team(organization=self.organization, name="Moo Deng's Team")

        invite = self.create_member_invite(
            organization=self.organization,
            email="foo@example.com",
            role="member",
            organization_member_team_data=[{"id": team.id, "slug": team.slug, "role": None}],
        )
        assert invite.role == "member"

        with outbox_runner():
            self.get_success_response(self.organization.slug, invite.id, reinvite=1)

        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("MEMBER_REINVITE"),
        )

        assert invite.role == "member"
        assert invite.organization_member_team_data == [
            {"id": team.id, "slug": team.slug, "role": None}
        ]

    @patch("sentry.ratelimits.for_organization_member_invite")
    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_rate_limited(self, mock_send_invite_email, mock_rate_limit):
        mock_rate_limit.return_value = True

        self.get_error_response(
            self.organization.slug, self.approved_invite.id, reinvite=1, status_code=429
        )

        assert not mock_send_invite_email.mock_calls

    def test_member_cannot_regenerate_pending_invite(self):
        self.login_as(self.regular_user)
        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.approved_invite.id,
            reinvite=1,
            regenerate=1,
            status_code=403,
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.approved_invite.id,
            reinvite=1,
            regenerate=1,
            status_code=400,
        )
        assert response.data.get("detail") == "You are missing the member:admin scope."

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_admin_can_regenerate_pending_invite(self, mock_send_invite_email):
        invite = self.create_member_invite(
            organization=self.organization, email="sencha@tea.com", role="member"
        )
        old_token = invite.token
        response = self.get_success_response(
            self.organization.slug,
            invite.id,
            reinvite=1,
            regenerate=1,
        )
        invite = OrganizationMemberInvite.objects.get(id=invite.id)
        assert old_token != invite.token
        mock_send_invite_email.assert_called_once_with()
        assert "invite_link" not in response.data
        assert "token" not in response.data

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_reinvite_invite_expired_member(self, mock_send_invite_email):
        invite = self.create_member_invite(
            organization=self.organization,
            email="sencha@tea.com",
            role="member",
            token_expires_at="2018-10-20 00:00:00+00:00",
        )

        self.get_error_response(self.organization.slug, invite.id, reinvite=1, status_code=400)
        assert mock_send_invite_email.called is False

        invite = OrganizationMemberInvite.objects.get(id=invite.id)
        assert invite.token_expired

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_regenerate_invite_expired_member(self, mock_send_invite_email):
        invite = self.create_member_invite(
            organization=self.organization,
            email="sencha@tea.com",
            role="member",
            token_expires_at="2018-10-20 00:00:00+00:00",
        )

        self.get_success_response(self.organization.slug, invite.id, reinvite=1, regenerate=1)
        mock_send_invite_email.assert_called_once()

        invite = OrganizationMemberInvite.objects.get(id=invite.id)
        assert invite.token_expired is False

    def test_cannot_reinvite_unapproved_invite(self):
        invite = self.create_member_invite(
            organization=self.organization,
            email="sencha@tea.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        self.get_error_response(self.organization.slug, invite.id, reinvite=1, status_code=400)

        invite.update(invite_status=InviteStatus.REQUESTED_TO_JOIN.value)
        self.get_error_response(self.organization.slug, invite.id, reinvite=1, status_code=400)

    def test_cannot_regenerate_unapproved_invite(self):
        invite = self.create_member_invite(
            organization=self.organization,
            email="sencha@tea.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        self.get_error_response(
            self.organization.slug, invite.id, reinvite=1, regenerate=1, status_code=400
        )

        invite.update(invite_status=InviteStatus.REQUESTED_TO_JOIN.value)
        self.get_error_response(
            self.organization.slug, invite.id, reinvite=1, regenerate=1, status_code=400
        )

    def test_member_cannot_approve_invite(self):
        self.login_as(self.regular_user)
        response = self.get_error_response(
            self.organization.slug, self.invite_request.id, approve=1
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

    def test_cannot_approve_invite_above_self(self):
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
    # idk wtf is going on tbh. why is this feature still enabled.
    def test_cannot_approve_if_invite_requests_disabled(self):
        response = self.get_error_response(
            self.organization.slug, self.invite_request.id, approve=1
        )
        assert response.data["approve"][0] == "Your organization is not allowed to invite members."

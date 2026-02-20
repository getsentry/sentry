from unittest.mock import patch

from sentry import audit_log
from sentry.models.organizationmemberinvite import InviteStatus, OrganizationMemberInvite
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.outbox import outbox_runner


@with_feature("organizations:new-organization-member-invite")
class OrganizationMemberReinviteTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-reinvite"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
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

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_resend_invite(self, mock_send_invite_email):
        self.get_success_response(self.organization.slug, self.approved_invite.id)
        mock_send_invite_email.assert_called_once()

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_member_resend_invite__member_invite_disabled(self, mock_send_invite_email):
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
            self.organization.slug, self.approved_invite.id, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        response = self.get_error_response(
            self.organization.slug, other_user_invite.id, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_member_resend_invite__member_invite_enabled(self, mock_send_invite_email):
        self.login_as(self.regular_user)
        other_user_invite = self.create_member_invite(
            organization=self.organization,
            email="sencha@tea.com",
            role="member",
            inviter_id=self.user.id,
        )
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.approved_invite.id)
        mock_send_invite_email.assert_called_once()
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("MEMBER_REINVITE"),
        )
        mock_send_invite_email.reset_mock()

        response = self.get_error_response(
            self.organization.slug, other_user_invite.id, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.ratelimits.for_organization_member_invite")
    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_rate_limited(self, mock_send_invite_email, mock_rate_limit):
        mock_rate_limit.return_value = True

        self.get_error_response(self.organization.slug, self.approved_invite.id, status_code=429)

        assert not mock_send_invite_email.mock_calls

    def test_member_cannot_regenerate_pending_invite(self):
        self.login_as(self.regular_user)
        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.approved_invite.id,
            trigger_regenerate_token=1,
            status_code=403,
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.approved_invite.id,
            trigger_regenerate_token=1,
            status_code=403,
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_admin_can_regenerate_pending_invite(self, mock_send_invite_email):
        invite = self.create_member_invite(
            organization=self.organization, email="sencha@tea.com", role="member"
        )
        old_token = invite.token
        response = self.get_success_response(
            self.organization.slug,
            invite.id,
            trigger_regenerate_token=1,
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

        self.get_error_response(self.organization.slug, invite.id, status_code=400)
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

        self.get_success_response(self.organization.slug, invite.id, trigger_regenerate_token=1)
        mock_send_invite_email.assert_called_once()

        invite = OrganizationMemberInvite.objects.get(id=invite.id)
        assert invite.token_expired is False

    def test_cannot_reinvite_unapproved_invite(self):
        invite = self.create_member_invite(
            organization=self.organization,
            email="sencha@tea.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        self.get_error_response(self.organization.slug, invite.id, status_code=400)

        invite.update(invite_status=InviteStatus.REQUESTED_TO_JOIN.value)
        self.get_error_response(self.organization.slug, invite.id, status_code=400)

    def test_cannot_regenerate_unapproved_invite(self):
        invite = self.create_member_invite(
            organization=self.organization,
            email="sencha@tea.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        self.get_error_response(
            self.organization.slug, invite.id, trigger_regenerate_token=1, status_code=400
        )

        invite.update(invite_status=InviteStatus.REQUESTED_TO_JOIN.value)
        self.get_error_response(
            self.organization.slug, invite.id, trigger_regenerate_token=1, status_code=400
        )

    def test_other_org_admin_cannot_resend_invite(self):
        org = self.create_organization(slug="other-org")
        other_admin_user = self.create_user("other-admin@email.com")
        self.create_member(organization=org, role="owner", user=other_admin_user)
        self.login_as(other_admin_user)
        response = self.get_error_response(
            self.organization.slug, self.approved_invite.id, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

    @patch("sentry.models.OrganizationMemberInvite.send_invite_email")
    def test_cannot_reinvite_from_other_org(self, mock_send_invite_email):
        """An org owner cannot reinvite a member invite that belongs to another org."""
        other_org = self.create_organization(slug="other-org", owner=self.user)
        other_org_invite = self.create_member_invite(
            organization=other_org, email="cross-org@test.com"
        )
        self.get_error_response(self.organization.slug, other_org_invite.id, status_code=404)
        assert not mock_send_invite_email.called

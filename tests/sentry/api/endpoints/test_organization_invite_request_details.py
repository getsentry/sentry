from functools import cached_property
from unittest.mock import patch

from sentry import audit_log
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class InviteRequestBase(APITestCase):
    endpoint = "sentry-api-0-organization-invite-request-detail"

    @cached_property
    def org(self):
        return self.create_organization(owner=self.user)

    @cached_property
    def team(self):
        return self.create_team(organization=self.org)

    @cached_property
    def member(self):
        return self.create_member(organization=self.org, user=self.create_user(), role="member")

    @cached_property
    def manager(self):
        return self.create_member(organization=self.org, user=self.create_user(), role="manager")

    @cached_property
    def invite_request(self):
        return self.create_member(
            email="test@example.com",
            organization=self.org,
            role="owner",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

    @cached_property
    def request_to_join(self):
        return self.create_member(
            email="example@gmail.com",
            organization=self.org,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )


class OrganizationInviteRequestGetTest(InviteRequestBase):
    def test_get_invalid(self):
        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug, "123")
        assert resp.status_code == 404

    def test_me_not_supported(self):
        self.login_as(user=self.user)
        # the serializer allows this value but it makes no sense for this view
        resp = self.get_response(self.org.slug, "me")
        assert resp.status_code == 404

    def test_get_invite_request(self):
        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug, self.invite_request.id)

        assert resp.status_code == 200
        assert resp.data["email"] == self.invite_request.email
        assert resp.data["inviteStatus"] == "requested_to_be_invited"
        assert resp.data["teams"] == []

        resp = self.get_response(self.org.slug, self.request_to_join.id)

        assert resp.status_code == 200
        assert resp.data["email"] == self.request_to_join.email
        assert resp.data["inviteStatus"] == "requested_to_join"
        assert resp.data["teams"] == []


class OrganizationInviteRequestDeleteTest(InviteRequestBase):
    method = "delete"

    def test_owner_can_delete_invite_request(self):
        self.login_as(user=self.user)
        with outbox_runner():
            resp = self.get_response(self.org.slug, self.invite_request.id)

        assert resp.status_code == 204
        assert not OrganizationMember.objects.filter(id=self.invite_request.id).exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.get(
                organization_id=self.org.id,
                actor=self.user,
                event=audit_log.get_event_id("INVITE_REQUEST_REMOVE"),
            )
        assert audit_log_entry.data == self.invite_request.get_audit_log_data()

    def test_member_cannot_delete_invite_request(self):
        self.login_as(user=self.member)
        resp = self.get_response(self.org.slug, self.invite_request.id)

        assert resp.status_code == 403
        assert OrganizationMember.objects.filter(id=self.invite_request.id).exists()


class OrganizationInviteRequestUpdateTest(InviteRequestBase, HybridCloudTestMixin):
    method = "put"

    def test_owner_can_update_role(self):
        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug, self.invite_request.id, role="manager")

        assert resp.status_code == 200
        assert resp.data["role"] == "manager"
        assert resp.data["orgRole"] == "manager"
        assert resp.data["inviteStatus"] == "requested_to_be_invited"

        member = OrganizationMember.objects.get(id=self.invite_request.id, role="manager")
        self.assert_org_member_mapping(org_member=member)

    def test_owner_can_update_teams(self):
        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug, self.invite_request.id, teams=[self.team.slug])

        assert resp.status_code == 200
        assert resp.data["teams"] == [self.team.slug]
        assert resp.data["inviteStatus"] == "requested_to_be_invited"

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=self.invite_request.id, team=self.team
        ).exists()

    def test_teams_with_partial_update(self):
        OrganizationMemberTeam.objects.create(
            organizationmember=self.invite_request, team=self.team
        )

        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug, self.invite_request.id, role="manager")

        assert resp.status_code == 200
        assert resp.data["role"] == "manager"
        assert resp.data["orgRole"] == "manager"
        assert resp.data["inviteStatus"] == "requested_to_be_invited"

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=self.invite_request.id, team=self.team
        ).exists()
        self.assert_org_member_mapping(org_member=self.invite_request)

    def test_can_remove_teams(self):
        OrganizationMemberTeam.objects.create(
            organizationmember=self.invite_request, team=self.team
        )

        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug, self.invite_request.id, teams=[])

        assert resp.status_code == 200
        assert resp.data["inviteStatus"] == "requested_to_be_invited"

        assert not OrganizationMemberTeam.objects.filter(
            organizationmember=self.invite_request.id, team=self.team
        ).exists()

    def test_member_cannot_update_invite_request(self):
        self.login_as(user=self.member)
        resp = self.get_response(self.org.slug, self.request_to_join.id, role="manager")
        assert resp.status_code == 403


class OrganizationInviteRequestApproveTest(InviteRequestBase, HybridCloudTestMixin):
    method = "put"

    @patch.object(OrganizationMember, "send_invite_email")
    def test_owner_can_approve_invite_request(self, mock_invite_email):
        self.login_as(user=self.user)
        with outbox_runner():
            resp = self.get_response(self.org.slug, self.invite_request.id, approve=1)

        assert resp.status_code == 200
        assert resp.data["inviteStatus"] == "approved"
        assert mock_invite_email.call_count == 1

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.get(
                organization_id=self.org.id,
                actor=self.user,
                event=audit_log.get_event_id("MEMBER_INVITE"),
            )
        member = OrganizationMember.objects.get(
            id=self.invite_request.id, invite_status=InviteStatus.APPROVED.value
        )

        assert audit_log_entry.data == member.get_audit_log_data()

    def test_member_cannot_approve_invite_request(self):
        self.invite_request.inviter_id = self.member.user_id
        self.invite_request.save()

        self.login_as(user=self.member)
        resp = self.get_response(self.org.slug, self.invite_request.id, approve=1)

        assert resp.status_code == 403

    @patch.object(OrganizationMember, "send_invite_email")
    def test_approve_requires_invite_members_feature(self, mock_invite_email):
        self.login_as(user=self.user)

        with Feature({"organizations:invite-members": False}):
            resp = self.get_response(self.org.slug, self.invite_request.id, approve=1)
            assert resp.status_code == 400
            assert mock_invite_email.call_count == 0

    @patch.object(OrganizationMember, "send_invite_email")
    def test_cannot_approve_join_request_with_disabled_setting(self, mock_invite_email):
        OrganizationOption.objects.create(
            organization_id=self.org.id, key="sentry:join_requests", value=False
        )

        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug, self.request_to_join.id, approve=1)

        assert resp.status_code == 400
        assert mock_invite_email.call_count == 0

        # can still approve invite request
        resp = self.get_response(self.org.slug, self.invite_request.id, approve=1)
        assert resp.status_code == 200

    @patch.object(OrganizationMember, "send_invite_email")
    def test_can_approve_join_request_with_enabled_setting(self, mock_invite_email):
        OrganizationOption.objects.create(
            organization_id=self.org.id, key="sentry:join_requests", value=True
        )

        self.login_as(user=self.user)
        resp = self.get_response(self.org.slug, self.request_to_join.id, approve=1)

        assert resp.status_code == 200
        assert mock_invite_email.call_count == 1

    @patch.object(OrganizationMember, "send_invite_email")
    def test_email_not_sent_without_invites_enabled(self, mock_invite_email):
        self.login_as(user=self.user)

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.get_response(self.org.slug, self.invite_request.id, approve=1)

        assert resp.status_code == 200
        assert mock_invite_email.call_count == 0

        assert OrganizationMember.objects.filter(
            id=self.invite_request.id, invite_status=InviteStatus.APPROVED.value
        ).exists()

    @patch.object(OrganizationMember, "send_invite_email")
    def test_owner_can_update_and_approve(self, mock_invite_email):
        self.login_as(user=self.user)
        resp = self.get_response(
            self.org.slug,
            self.request_to_join.id,
            approve=1,
            role="manager",
            teams=[self.team.slug],
        )

        assert resp.status_code == 200
        assert resp.data["role"] == "manager"
        assert resp.data["orgRole"] == "manager"
        assert resp.data["inviteStatus"] == "approved"

        assert OrganizationMember.objects.filter(
            id=self.request_to_join.id, role="manager", invite_status=InviteStatus.APPROVED.value
        ).exists()
        self.assert_org_member_mapping(org_member=self.request_to_join)

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=self.request_to_join.id, team=self.team
        ).exists()

        assert mock_invite_email.call_count == 1

    @patch.object(OrganizationMember, "send_invite_email")
    def test_manager_cannot_approve_owner(self, mock_invite_email):
        self.login_as(user=self.manager)
        resp = self.get_response(self.org.slug, self.invite_request.id, approve=1)

        assert resp.status_code == 400
        assert OrganizationMember.objects.filter(
            id=self.invite_request.id,
            role="owner",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        ).exists()
        assert mock_invite_email.call_count == 0

    def test_manager_can_approve_manager(self):
        self.login_as(user=self.manager)
        invite_request = self.create_member(
            email="hello@example.com",
            organization=self.org,
            role="manager",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        resp = self.get_response(self.org.slug, invite_request.id, approve=1)

        assert resp.status_code == 200

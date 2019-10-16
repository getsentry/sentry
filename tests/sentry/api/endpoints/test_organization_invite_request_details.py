from __future__ import absolute_import

from mock import patch
from django.core.urlresolvers import reverse

from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    OrganizationMember,
    OrganizationMemberTeam,
    InviteStatus,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature


class OrganizationInviteRequestDetailsTest(APITestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.member = self.create_member(
            organization=self.org, user=self.create_user(), role="member"
        )

        self.invite_request = self.create_member(
            email="test@example.com",
            organization=self.org,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        self.request_to_join = self.create_member(
            email="example@gmail.com",
            organization=self.org,
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

    def test_get_invite_request(self):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.get(url)
        assert resp.status_code == 200

        assert resp.data["email"] == self.invite_request.email
        assert resp.data["invite_status"] == "requested_to_be_invited"
        assert resp.data["teams"] == []

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.request_to_join.id},
        )

        resp = self.client.get(url)
        assert resp.status_code == 200

        assert resp.data["email"] == self.request_to_join.email
        assert resp.data["invite_status"] == "requested_to_join"
        assert resp.data["teams"] == []

    def test_get_invalid(self):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": "123"},
        )

        resp = self.client.get(url)
        assert resp.status_code == 404

    def test_owner_can_delete_invite_request(self):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.delete(url)
        assert resp.status_code == 204

        assert not OrganizationMember.objects.filter(id=self.invite_request.id).exists()

        audit_log = AuditLogEntry.objects.get(
            organization=self.org, actor=self.user, event=AuditLogEntryEvent.INVITE_REQUEST_REMOVE
        )
        assert audit_log.data == self.invite_request.get_audit_log_data()

    def test_member_cannot_delete_invite_request(self):
        self.login_as(user=self.member.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.delete(url)
        assert resp.status_code == 403

        assert OrganizationMember.objects.filter(id=self.invite_request.id).exists()

    def test_member_can_delete_their_invite_request(self):
        self.login_as(user=self.member.user)
        self.invite_request.inviter = self.member.user
        self.invite_request.save()

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.delete(url)
        assert resp.status_code == 204

        assert not OrganizationMember.objects.filter(id=self.invite_request.id).exists()

    @patch.object(OrganizationMember, "send_invite_email")
    def test_owner_can_approve_invite_request(self, mock_invite_email):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.put(url, data={"approve": 1})
        assert resp.status_code == 200
        assert resp.data["invite_status"] == "approved"

        assert mock_invite_email.call_count == 1

        audit_log = AuditLogEntry.objects.get(
            organization=self.org, actor=self.user, event=AuditLogEntryEvent.MEMBER_INVITE
        )
        member = OrganizationMember.objects.get(
            id=self.invite_request.id, invite_status=InviteStatus.APPROVED.value
        )
        assert audit_log.data == member.get_audit_log_data()

    @patch.object(OrganizationMember, "send_invite_email")
    def test_member_cannot_approve_invite_request(self, mock_invite_email):
        self.login_as(user=self.member.user)
        self.invite_request.inviter = self.member.user
        self.invite_request.save()

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.put(url, data={"approve": 1})
        assert resp.status_code == 400

        assert mock_invite_email.call_count == 0

    @patch.object(OrganizationMember, "send_invite_email")
    def test_approve_requires_invite_members_feature(self, mock_invite_email):
        self.login_as(user=self.user)

        with Feature({"organizations:invite-members": False}):
            url = reverse(
                "sentry-api-0-organization-invite-request-detail",
                kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
            )

            resp = self.client.put(url, data={"approve": 1})
            assert resp.status_code == 403

    @patch.object(OrganizationMember, "send_invite_email")
    def test_email_not_sent_without_invites_enabled(self, mock_invite_email):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.put(url, data={"approve": 1})

        assert resp.status_code == 200
        assert mock_invite_email.call_count == 0

        assert OrganizationMember.objects.filter(
            id=self.invite_request.id, invite_status=InviteStatus.APPROVED.value
        ).exists()

    def test_owner_can_update_role(self):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.put(url, data={"role": "admin"})
        assert resp.status_code == 200
        assert resp.data["role"] == "admin"
        assert resp.data["invite_status"] == "requested_to_be_invited"

        assert OrganizationMember.objects.filter(id=self.invite_request.id, role="admin").exists()

    def test_owner_can_update_teams(self):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.put(url, data={"teams": [self.team.slug]})
        assert resp.status_code == 200
        assert resp.data["teams"] == [self.team.slug]
        assert resp.data["invite_status"] == "requested_to_be_invited"

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=self.invite_request.id, team=self.team
        ).exists()

    def test_teams_with_partial_update(self):
        self.login_as(user=self.user)
        OrganizationMemberTeam.objects.create(
            organizationmember=self.invite_request, team=self.team
        )

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.put(url, data={"role": "manager"})
        assert resp.status_code == 200
        assert resp.data["role"] == "manager"
        assert resp.data["invite_status"] == "requested_to_be_invited"

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=self.invite_request.id, team=self.team
        ).exists()

    def test_can_remove_teams(self):
        self.login_as(user=self.user)
        OrganizationMemberTeam.objects.create(
            organizationmember=self.invite_request, team=self.team
        )

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.invite_request.id},
        )

        resp = self.client.put(url, data={"teams": []})
        assert resp.status_code == 200
        assert resp.data["invite_status"] == "requested_to_be_invited"

        assert not OrganizationMemberTeam.objects.filter(
            organizationmember=self.invite_request.id, team=self.team
        ).exists()

    @patch.object(OrganizationMember, "send_invite_email")
    def test_owner_can_update_and_approve(self, mock_invite_email):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.request_to_join.id},
        )

        resp = self.client.put(url, data={"teams": [self.team.slug], "approve": 1, "role": "admin"})
        assert resp.status_code == 200
        assert resp.data["role"] == "admin"
        assert resp.data["invite_status"] == "approved"

        assert OrganizationMember.objects.filter(
            id=self.request_to_join.id, role="admin", invite_status=InviteStatus.APPROVED.value
        ).exists()

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=self.request_to_join.id, team=self.team
        ).exists()

        assert mock_invite_email.call_count == 1

    def test_member_cannot_update_invite_request(self):
        self.login_as(user=self.member.user)

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.request_to_join.id},
        )

        resp = self.client.put(url, data={"role": "admin"})
        assert resp.status_code == 403

    def test_member_can_update_their_invite_request(self):
        self.login_as(user=self.member.user)
        self.request_to_join.inviter = self.member.user
        self.request_to_join.save()

        url = reverse(
            "sentry-api-0-organization-invite-request-detail",
            kwargs={"organization_slug": self.org.slug, "member_id": self.request_to_join.id},
        )

        resp = self.client.put(url, data={"role": "admin"})
        assert resp.status_code == 200
        assert resp.data["role"] == "admin"

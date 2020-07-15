from __future__ import absolute_import

import six

from django.core import mail
from django.core.urlresolvers import reverse
from django.db.models import F
from sentry.utils.compat.mock import patch

from sentry.models import (
    Authenticator,
    AuthProvider,
    InviteStatus,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    RecoveryCodeInterface,
    TotpInterface,
)
from sentry.testutils import APITestCase
from sentry.utils.compat import map


class UpdateOrganizationMemberTest(APITestCase):
    def test_invalid_id(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_user("bar@example.com")
        self.create_member(organization=organization, user=member, role="member")

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, "trash"]
        )
        self.login_as(self.user)

        resp = self.client.put(path, data={"reinvite": 1})

        assert resp.status_code == 404

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_reinvite_pending_member(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member_om = self.create_member(
            organization=organization, email="foo@example.com", role="member"
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"reinvite": 1})

        assert resp.status_code == 200
        mock_send_invite_email.assert_called_once_with()

    @patch("sentry.utils.ratelimits.for_organization_member_invite")
    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_rate_limited(self, mock_send_invite_email, mock_rate_limit):
        mock_rate_limit.return_value = True

        organization = self.create_organization(name="foo", owner=self.user)
        member_om = self.create_member(
            organization=organization, email="foo@example.com", role="member"
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"reinvite": 1})
        assert resp.status_code == 429
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_member_cannot_regenerate_pending_invite(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member_om = self.create_member(
            organization=organization, email="foo@example.com", role="member"
        )
        old_invite = member_om.get_invite_link()

        member = self.create_user("baz@example.com")
        self.create_member(organization=organization, user=member, role="member")

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(member)

        resp = self.client.put(path, data={"reinvite": 1, "regenerate": 1})

        assert resp.status_code == 403
        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert old_invite == member_om.get_invite_link()
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_admin_can_regenerate_pending_invite(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member_om = self.create_member(
            organization=organization, email="foo@example.com", role="member"
        )
        old_invite = member_om.get_invite_link()

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"reinvite": 1, "regenerate": 1})

        assert resp.status_code == 200
        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert old_invite != member_om.get_invite_link()
        mock_send_invite_email.assert_called_once_with()
        assert resp.data["invite_link"] == member_om.get_invite_link()

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_reinvite_invite_expired_member(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_member(
            organization=organization,
            email="foo@example.com",
            role="member",
            token_expires_at="2018-10-20 00:00:00",
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member.id]
        )
        self.login_as(self.user)
        resp = self.client.put(path, data={"reinvite": 1})

        assert resp.status_code == 400
        assert mock_send_invite_email.called is False

        member = OrganizationMember.objects.get(pk=member.id)
        assert member.token_expired

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_regenerate_invite_expired_member(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_member(
            organization=organization,
            email="foo@example.com",
            role="member",
            token_expires_at="2018-10-20 00:00:00",
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member.id]
        )
        self.login_as(self.user)
        resp = self.client.put(path, data={"reinvite": 1, "regenerate": 1})

        assert resp.status_code == 200
        mock_send_invite_email.assert_called_once_with()

        member = OrganizationMember.objects.get(pk=member.id)
        assert member.token_expired is False

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_cannot_reinvite_unapproved_invite(self, mock_send_invite_email):
        self.login_as(self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_member(
            organization=organization,
            email="foo@example.com",
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member.id]
        )

        resp = self.client.put(path, data={"reinvite": 1})
        assert resp.status_code == 404

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_cannot_regenerate_unapproved_invite(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_member(
            organization=organization,
            email="foo@example.com",
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member.id]
        )

        resp = self.client.put(path, data={"reinvite": 1, "regenerate": 1})
        assert resp.status_code == 404

    def test_reinvite_sso_link(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_user("bar@example.com")
        member_om = self.create_member(organization=organization, user=member, role="member")
        AuthProvider.objects.create(organization=organization, provider="dummy", flags=1)

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        with self.tasks():
            resp = self.client.put(path, data={"reinvite": 1})

        assert resp.status_code == 200
        assert len(mail.outbox) == 1

    def test_admin_can_get_invite_link(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)

        pending_om = self.create_member(
            user=None, email="bar@example.com", organization=organization, role="member", teams=[]
        )
        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, pending_om.id]
        )

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert resp.data["invite_link"] == pending_om.get_invite_link()

    def test_member_cannot_get_invite_link(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)

        pending_om = self.create_member(
            user=None, email="bar@example.com", organization=organization, role="member", teams=[]
        )

        member = self.create_user("baz@example.com")
        self.create_member(organization=organization, user=member, role="member")

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, pending_om.id]
        )

        self.login_as(member)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert "invite_link" not in resp.data

    def test_get_member_list_teams(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        team = self.create_team(organization=organization, name="Team")

        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=organization, user=member, role="member", teams=[team]
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert team.slug in resp.data["teams"]

    def test_can_update_member_membership(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)

        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=organization, user=member, role="member", teams=[]
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"role": "admin"})
        assert resp.status_code == 200

        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert member_om.role == "admin"

    def test_can_not_update_own_membership(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)

        member_om = OrganizationMember.objects.get(user_id=self.user.id)

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"role": "admin"})
        assert resp.status_code == 400

        member_om = OrganizationMember.objects.get(user_id=self.user.id)
        assert member_om.role == "owner"

    def test_can_update_teams(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        foo = self.create_team(organization=organization, name="Team Foo")
        bar = self.create_team(organization=organization, name="Team Bar")

        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=organization, user=member, role="member", teams=[]
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"teams": [foo.slug, bar.slug]})
        assert resp.status_code == 200

        member_teams = OrganizationMemberTeam.objects.filter(organizationmember=member_om)
        team_ids = map(lambda x: x.team_id, member_teams)
        assert foo.id in team_ids
        assert bar.id in team_ids

        member_om = OrganizationMember.objects.get(id=member_om.id)

        teams = map(lambda team: team.slug, member_om.teams.all())
        assert foo.slug in teams
        assert bar.slug in teams

    def test_can_not_update_with_invalid_team(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)

        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=organization, user=member, role="member", teams=[]
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"teams": ["invalid-team"]})
        assert resp.status_code == 400

        member_om = OrganizationMember.objects.get(id=member_om.id)
        teams = map(lambda team: team.slug, member_om.teams.all())
        assert len(teams) == 0

    def test_can_update_role(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=organization, user=member, role="member", teams=[]
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"role": "admin"})
        assert resp.status_code == 200

        member_om = OrganizationMember.objects.get(organization=organization, user=member)
        assert member_om.role == "admin"

    def test_can_not_update_with_invalid_role(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=organization, user=member, role="member", teams=[]
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"role": "invalid-role"})
        assert resp.status_code == 400
        member_om = OrganizationMember.objects.get(organization=organization, user=member)
        assert member_om.role == "member"

    @patch("sentry.models.OrganizationMember.send_sso_link_email")
    def test_cannot_reinvite_normal_member(self, mock_send_sso_link_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_user("bar@example.com")
        member_om = self.create_member(organization=organization, user=member, role="member")

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"reinvite": 1})

        assert resp.status_code == 400

    def test_cannot_lower_superior_role(self):
        organization = self.create_organization(name="foo", owner=self.user)
        owner = self.create_user("baz@example.com")
        owner_om = self.create_member(organization=organization, user=owner, role="owner", teams=[])

        manager = self.create_user("foo@example.com")
        self.create_member(organization=organization, user=manager, role="manager", teams=[])
        self.login_as(manager)

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, owner_om.id]
        )

        resp = self.client.put(path, data={"role": "member"})
        assert resp.status_code == 403

        owner_om = OrganizationMember.objects.get(organization=organization, user=owner)
        assert owner_om.role == "owner"


class ResetOrganizationMember2faTest(APITestCase):
    def setUp(self):
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)

        self.member = self.create_user()
        self.member_om = self.create_member(
            organization=self.org, user=self.member, role="member", teams=[]
        )
        self.login_as(self.member)
        totp = TotpInterface()
        totp.enroll(self.member)
        self.interface_id = totp.authenticator.id
        assert Authenticator.objects.filter(user=self.member).exists()

    def assert_can_get_authenticators(self):
        path = reverse(
            "sentry-api-0-organization-member-details", args=[self.org.slug, self.member_om.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 200
        data = resp.data

        assert len(data["user"]["authenticators"]) == 1
        assert data["user"]["has2fa"] is True
        assert data["user"]["canReset2fa"] is True

    def assert_cannot_get_authenticators(self):
        path = reverse(
            "sentry-api-0-organization-member-details", args=[self.org.slug, self.member_om.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 200
        data = resp.data

        assert "authenticators" not in data["user"]
        assert "canReset2fa" not in data["user"]

    def assert_can_remove_authenticators(self):
        path = reverse(
            "sentry-api-0-user-authenticator-details", args=[self.member.id, self.interface_id]
        )
        resp = self.client.delete(path)
        assert resp.status_code == 204
        assert not Authenticator.objects.filter(user=self.member).exists()

    def assert_cannot_remove_authenticators(self):
        path = reverse(
            "sentry-api-0-user-authenticator-details", args=[self.member.id, self.interface_id]
        )
        resp = self.client.delete(path)
        assert resp.status_code == 403
        assert Authenticator.objects.filter(user=self.member).exists()

    def test_org_owner_can_reset_member_2fa(self):
        self.login_as(self.owner)

        self.assert_can_get_authenticators()
        self.assert_can_remove_authenticators()

    def test_owner_must_have_org_membership(self):
        owner = self.create_user()
        self.create_organization(owner=owner)
        self.login_as(owner)

        path = reverse(
            "sentry-api-0-organization-member-details", args=[self.org.slug, self.member_om.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 403

        self.assert_cannot_remove_authenticators()

    def test_org_manager_can_reset_member_2fa(self):
        manager = self.create_user()
        self.create_member(organization=self.org, user=manager, role="manager", teams=[])
        self.login_as(manager)

        self.assert_can_get_authenticators()
        self.assert_can_remove_authenticators()

    def test_org_admin_cannot_reset_member_2fa(self):
        admin = self.create_user()
        self.create_member(organization=self.org, user=admin, role="admin", teams=[])
        self.login_as(admin)

        self.assert_cannot_get_authenticators()
        self.assert_cannot_remove_authenticators()

    def test_org_member_cannot_reset_member_2fa(self):
        member = self.create_user()
        self.create_member(organization=self.org, user=member, role="member", teams=[])
        self.login_as(member)

        self.assert_cannot_get_authenticators()
        self.assert_cannot_remove_authenticators()

    def test_cannot_reset_member_2fa__has_multiple_org_membership(self):
        self.create_organization(owner=self.member)
        self.login_as(self.owner)

        path = reverse(
            "sentry-api-0-organization-member-details", args=[self.org.slug, self.member_om.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 200
        data = resp.data

        assert len(data["user"]["authenticators"]) == 1
        assert data["user"]["has2fa"] is True
        assert data["user"]["canReset2fa"] is False

        self.assert_cannot_remove_authenticators()

    def test_cannot_reset_member_2fa__org_requires_2fa(self):
        self.login_as(self.owner)
        TotpInterface().enroll(self.owner)

        self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        assert self.org.flags.require_2fa.is_set is True

        self.assert_cannot_remove_authenticators()

    def test_owner_can_only_reset_member_2fa(self):
        self.login_as(self.owner)

        path = reverse(
            "sentry-api-0-user-authenticator-details", args=[self.member.id, self.interface_id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 403

        # cannot regenerate recovery codes
        recovery = RecoveryCodeInterface()
        recovery.enroll(self.user)
        path = reverse(
            "sentry-api-0-user-authenticator-details",
            args=[self.member.id, recovery.authenticator.id],
        )
        resp = self.client.put(path)
        assert resp.status_code == 403


class DeleteOrganizationMemberTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_user("bar@example.com")

        member_om = self.create_member(organization=organization, user=member, role="member")

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 204
        assert not OrganizationMember.objects.filter(id=member_om.id).exists()

    def test_invalid_id(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        member = self.create_user("bar@example.com")
        self.create_member(organization=organization, user=member, role="member")

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, "trash"]
        )
        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 404

    def test_cannot_delete_member_with_higher_access(self):
        organization = self.create_organization(name="foo", owner=self.user)

        other_user = self.create_user("bar@example.com")

        self.create_member(organization=organization, role="manager", user=other_user)

        owner_om = OrganizationMember.objects.get(organization=organization, user=self.user)

        assert owner_om.role == "owner"

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, owner_om.id]
        )

        self.login_as(other_user)

        resp = self.client.delete(path)

        assert resp.status_code == 400
        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_cannot_delete_only_owner(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)

        # create a pending member, which shouldn't be counted in the checks
        self.create_member(organization=organization, role="owner", email="bar@example.com")

        owner_om = OrganizationMember.objects.get(organization=organization, user=self.user)

        assert owner_om.role == "owner"

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, owner_om.id]
        )

        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 403
        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_can_delete_self(self):
        organization = self.create_organization(name="foo", owner=self.user)

        other_user = self.create_user("bar@example.com")

        self.create_member(organization=organization, role="member", user=other_user)

        path = reverse("sentry-api-0-organization-member-details", args=[organization.slug, "me"])

        self.login_as(other_user)

        resp = self.client.delete(path)

        assert resp.status_code == 204
        assert not OrganizationMember.objects.filter(
            user=other_user, organization=organization
        ).exists()

    def test_missing_scope(self):
        organization = self.create_organization(name="foo", owner=self.user)

        admin_user = self.create_user("bar@example.com")

        self.create_member(organization=organization, role="admin", user=admin_user)

        member_user = self.create_user("baz@example.com")

        member_om = self.create_member(organization=organization, role="member", user=member_user)

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member_om.id]
        )

        self.login_as(admin_user)

        resp = self.client.delete(path)

        assert resp.status_code == 400

        assert OrganizationMember.objects.filter(id=member_om.id).exists()

    def test_cannot_delete_unapproved_invite(self):
        organization = self.create_organization(name="test", owner=self.user)
        self.login_as(self.user)

        join_request = self.create_member(
            organization=organization,
            email="test@gmail.com",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        invite_request = self.create_member(
            organization=organization,
            email="test2@gmail.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, join_request.id]
        )
        resp = self.client.delete(path)
        assert resp.status_code == 404

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, invite_request.id]
        )
        resp = self.client.delete(path)
        assert resp.status_code == 404


class GetOrganizationMemberTest(APITestCase):
    def test_me(self):
        user = self.create_user("dummy@example.com")
        organization = self.create_organization(name="test", owner=user)
        self.create_team(name="first", organization=organization, members=[user])

        path = reverse("sentry-api-0-organization-member-details", args=[organization.slug, "me"])
        self.login_as(user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        assert resp.data["role"] == "owner"
        assert resp.data["user"]["id"] == six.text_type(user.id)
        assert resp.data["email"] == user.email

    def test_get_by_id(self):
        user = self.create_user("dummy@example.com")
        organization = self.create_organization(name="test")
        team = self.create_team(name="first", organization=organization, members=[user])
        member = team.member_set.first()

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, member.id]
        )
        self.login_as(user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        assert resp.data["role"] == "member"
        assert resp.data["id"] == six.text_type(member.id)

    def test_get_by_garbage(self):
        user = self.create_user("dummy@example.com")
        organization = self.create_organization(name="test")
        self.create_team(name="first", organization=organization, members=[user])

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, "trash"]
        )
        self.login_as(user)
        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_cannot_get_unapproved_invite(self):
        organization = self.create_organization(name="test", owner=self.user)
        self.login_as(self.user)

        join_request = self.create_member(
            organization=organization,
            email="test@gmail.com",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        invite_request = self.create_member(
            organization=organization,
            email="test2@gmail.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, join_request.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 404

        path = reverse(
            "sentry-api-0-organization-member-details", args=[organization.slug, invite_request.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 404

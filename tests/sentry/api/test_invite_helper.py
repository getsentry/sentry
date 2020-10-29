from __future__ import absolute_import

from django.http import HttpRequest

from sentry.api.invite_helper import ApiInviteHelper
from sentry.models import AuthProvider, OrganizationMember
from sentry.testutils import TestCase
from sentry.utils.compat.mock import patch


class ApiInviteHelperTest(TestCase):
    def setUp(self):
        super(ApiInviteHelperTest, self).setUp()
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.user = self.create_user("foo@example.com")
        self.member = self.create_member(
            user=None, email="bar@example.com", organization=self.org, teams=[self.team],
        )
        self.auth_provider = AuthProvider(provider="Friendly IdP", organization=self.organization)

        self.request = HttpRequest()
        self.request.user = self.user

    @patch("sentry.api.invite_helper.create_audit_entry")
    @patch("sentry.api.invite_helper.OrganizationMember.get_audit_log_data")
    def test_accept_invite(self, get_audit, create_audit):
        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        helper = ApiInviteHelper(self.request, self.member.id, None)
        helper.accept_invite()

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is None
        assert om.user.id == self.user.id

    @patch("sentry.api.invite_helper.create_audit_entry")
    @patch("sentry.api.invite_helper.OrganizationMember.get_audit_log_data")
    @patch("sentry.api.invite_helper.AuthProvider.objects")
    def test_accept_invite_with_SSO(self, mock_provider, get_audit, create_audit):
        self.auth_provider.flags.allow_unlinked = True
        mock_provider.get.return_value = self.auth_provider

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        helper = ApiInviteHelper(self.request, self.member.id, None)
        helper.accept_invite()

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is None
        assert om.user.id == self.user.id

    @patch("sentry.api.invite_helper.create_audit_entry")
    @patch("sentry.api.invite_helper.OrganizationMember.get_audit_log_data")
    @patch("sentry.api.invite_helper.AuthProvider.objects")
    def test_accept_invite_with_required_SSO(self, mock_provider, get_audit, create_audit):
        self.auth_provider.flags.allow_unlinked = False
        mock_provider.get.return_value = self.auth_provider

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        helper = ApiInviteHelper(self.request, self.member.id, None)
        helper.accept_invite()

        # Invite cannot be accepted without AuthIdentity if SSO is required
        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is not None
        assert om.user is None

    @patch("sentry.api.invite_helper.create_audit_entry")
    @patch("sentry.api.invite_helper.OrganizationMember.get_audit_log_data")
    @patch("sentry.api.invite_helper.AuthProvider.objects")
    @patch("sentry.api.invite_helper.AuthIdentity.objects")
    def test_accept_invite_with_required_SSO_with_identity(
        self, mock_identity, mock_provider, get_audit, create_audit
    ):
        self.auth_provider.flags.allow_unlinked = False
        mock_provider.get.return_value = self.auth_provider
        mock_identity.exists.return_value = True

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        helper = ApiInviteHelper(self.request, self.member.id, None)
        helper.accept_invite()

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is None
        assert om.user.id == self.user.id

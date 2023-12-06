from unittest.mock import patch

from django.http import HttpRequest

from sentry.api.invite_helper import ApiInviteHelper
from sentry.models.authprovider import AuthProvider
from sentry.models.organizationmember import OrganizationMember
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.signals import receivers_raise_on_send
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner


class ApiInviteHelperTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.user = self.create_user("foo@example.com")
        self.member = self.create_member(
            user=None,
            email="bar@example.com",
            organization=self.org,
            teams=[self.team],
        )
        self.auth_provider_inst = AuthProvider(
            provider="Friendly IdP", organization_id=self.organization.id
        )

        self.request = HttpRequest()
        self.request.user = self.user

    @patch("sentry.api.invite_helper.create_audit_entry")
    @patch("sentry.api.invite_helper.RpcOrganizationMember.get_audit_log_metadata")
    def test_accept_invite(self, get_audit, create_audit):
        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        invite_context = organization_service.get_invite_by_id(
            organization_member_id=om.id, organization_id=om.organization_id
        )
        assert invite_context is not None

        helper = ApiInviteHelper(
            self.request,
            invite_context,
            None,
        )
        helper.accept_invite()

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is None
        assert om.user_id == self.user.id

    @patch("sentry.api.invite_helper.create_audit_entry")
    @patch("sentry.api.invite_helper.RpcOrganizationMember.get_audit_log_metadata")
    @patch("sentry.api.invite_helper.AuthProvider.objects")
    def test_accept_invite_with_SSO(self, mock_provider, get_audit, create_audit):
        self.auth_provider_inst.flags.allow_unlinked = True
        mock_provider.get.return_value = self.auth_provider_inst

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        invite_context = organization_service.get_invite_by_id(
            organization_member_id=om.id, organization_id=om.organization_id
        )
        assert invite_context is not None

        helper = ApiInviteHelper(
            self.request,
            invite_context,
            None,
        )

        with receivers_raise_on_send(), outbox_runner():
            helper.accept_invite()

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is None
        assert om.user_id == self.user.id

    @patch("sentry.api.invite_helper.create_audit_entry")
    @patch("sentry.api.invite_helper.RpcOrganizationMember.get_audit_log_metadata")
    @patch("sentry.api.invite_helper.AuthProvider.objects")
    def test_accept_invite_with_required_SSO(self, mock_provider, get_audit, create_audit):
        self.auth_provider_inst.flags.allow_unlinked = False
        mock_provider.get.return_value = self.auth_provider_inst

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        invite_context = organization_service.get_invite_by_id(
            organization_member_id=om.id, organization_id=om.organization_id
        )
        assert invite_context is not None

        helper = ApiInviteHelper(
            self.request,
            invite_context,
            None,
        )
        helper.accept_invite()

        # Invite cannot be accepted without AuthIdentity if SSO is required
        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is not None
        assert om.user_id is None

    @patch("sentry.api.invite_helper.create_audit_entry")
    @patch("sentry.api.invite_helper.RpcOrganizationMember.get_audit_log_metadata")
    @patch("sentry.api.invite_helper.AuthProvider.objects")
    @patch("sentry.api.invite_helper.AuthIdentity.objects")
    def test_accept_invite_with_required_SSO_with_identity(
        self, mock_identity, mock_provider, get_audit, create_audit
    ):
        self.auth_provider_inst.flags.allow_unlinked = False
        mock_provider.get.return_value = self.auth_provider_inst
        mock_identity.exists.return_value = True

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        invite_context = organization_service.get_invite_by_id(
            organization_member_id=om.id, organization_id=om.organization_id
        )
        assert invite_context is not None

        helper = ApiInviteHelper(
            self.request,
            invite_context,
            None,
        )
        helper.accept_invite()

        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is None
        assert om.user_id == self.user.id

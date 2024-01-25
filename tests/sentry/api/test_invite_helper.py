import pytest
from django.http import HttpRequest

from sentry.api.invite_helper import ApiInviteHelper
from sentry.models.organizationmember import OrganizationMember
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.signals import receivers_raise_on_send
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
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
        self.auth_provider_inst = self.create_auth_provider(
            organization_id=self.organization.id,
            provider="Friendly IdP",
        )

        self.request = HttpRequest()
        self.request.META["REMOTE_ADDR"] = "127.0.0.1"
        self.request.user = self.user

    def test_accept_invite(self):
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
        with assume_test_silo_mode(SiloMode.CONTROL):
            helper.accept_invite()

        om.refresh_from_db()
        assert om.email is None
        assert om.user_id == self.user.id

    def test_accept_invite_already_exists(self):
        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        invite_context = organization_service.get_invite_by_id(
            organization_member_id=om.id, organization_id=om.organization_id
        )
        assert invite_context is not None

        helper = ApiInviteHelper(self.request, invite_context, None)
        with assume_test_silo_mode(SiloMode.CONTROL):
            helper.accept_invite()
        invite_context = organization_service.get_invite_by_id(
            organization_member_id=om.id, organization_id=om.organization_id
        )
        assert invite_context is not None
        member_id = invite_context.invite_organization_member_id
        assert member_id is not None

        # Without this member_id, don't delete the organization member
        invite_context.invite_organization_member_id = None
        helper = ApiInviteHelper(self.request, invite_context, None)
        with assume_test_silo_mode(SiloMode.CONTROL):
            helper.accept_invite()
        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email is None
        assert om.user_id == self.user.id

        # With the member_id, ensure it's deleted
        invite_context.invite_organization_member_id = member_id
        helper = ApiInviteHelper(self.request, invite_context, None)
        with assume_test_silo_mode(SiloMode.CONTROL):
            helper.accept_invite()
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(id=self.member.id)

    def test_accept_invite_with_SSO(self):
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

        with assume_test_silo_mode(SiloMode.CONTROL), receivers_raise_on_send(), outbox_runner():
            self.auth_provider_inst.flags.allow_unlinked = True
            self.auth_provider_inst.save()
            helper.accept_invite()

        om.refresh_from_db()
        assert om.email is None
        assert om.user_id == self.user.id

    def test_accept_invite_with_required_SSO(self):
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
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_provider_inst.flags.allow_unlinked = False
            self.auth_provider_inst.save()
            helper.accept_invite()

        # Invite cannot be accepted without AuthIdentity if SSO is required
        om.refresh_from_db()
        assert om.email is not None
        assert om.user_id is None

    def test_accept_invite_with_required_SSO_with_identity(self):
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
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_provider_inst.flags.allow_unlinked = False
            self.auth_provider_inst.save()
            helper.accept_invite()

        om.refresh_from_db()
        assert om.email is None
        assert om.user_id == self.user.id

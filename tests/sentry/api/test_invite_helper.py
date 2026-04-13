import pytest
from django.http import HttpRequest

from sentry import audit_log
from sentry.api.invite_helper import ApiInviteHelper
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class ApiInviteHelperTest(TestCase):
    def setUp(self) -> None:
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
        self.request = HttpRequest()
        # Needed for audit logs
        self.request.META["REMOTE_ADDR"] = "127.0.0.1"
        self.request.user = self.user

    def _get_om_from_accepting_invite(self) -> OrganizationMember:
        """
        Returns a refreshed organization member (id=self.member.id) after having accepted
        the invite from the ApiInviteHelper. Assert on the resulting OM depending on the context for
        the organization (e.g. SSO, duplicate invite)
        """
        om = OrganizationMember.objects.get(id=self.member.id)
        assert om.email == self.member.email

        invite_context = organization_service.get_invite_by_id(
            organization_member_id=om.id, organization_id=om.organization_id
        )
        assert invite_context is not None

        helper = ApiInviteHelper(self.request, invite_context, None)
        with assume_test_silo_mode(SiloMode.CONTROL):
            helper.accept_invite(self.user)

        om.refresh_from_db()
        return om

    def test_accept_invite_without_SSO(self) -> None:
        om = self._get_om_from_accepting_invite()

        assert om.email is None
        assert om.user_id == self.user.id

    def test_invite_already_accepted_without_SSO(self) -> None:
        om = self._get_om_from_accepting_invite()

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
            helper.accept_invite(self.user)
        om.refresh_from_db()
        assert om.email is None
        assert om.user_id == self.user.id

        # With the member_id, ensure it's deleted
        invite_context.invite_organization_member_id = member_id
        helper = ApiInviteHelper(self.request, invite_context, None)
        with assume_test_silo_mode(SiloMode.CONTROL):
            helper.accept_invite(self.user)
        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(id=self.member.id)

    def test_accept_invite_with_optional_SSO(self) -> None:
        ap = self.create_auth_provider(organization_id=self.org.id, provider="Friendly IdP")
        with assume_test_silo_mode(SiloMode.CONTROL):
            ap.flags.allow_unlinked = True
            ap.save()

        om = self._get_om_from_accepting_invite()

        assert om.email is None
        assert om.user_id == self.user.id

    def test_invite_already_accepted_with_optional_SSO(self) -> None:
        ap = self.create_auth_provider(organization_id=self.org.id, provider="Friendly IdP")
        with assume_test_silo_mode(SiloMode.CONTROL):
            ap.flags.allow_unlinked = True
            ap.save()

        self.test_invite_already_accepted_without_SSO()

    def test_accept_invite_with_required_SSO(self) -> None:
        ap = self.create_auth_provider(organization_id=self.org.id, provider="Friendly IdP")
        assert not ap.flags.allow_unlinked  # SSO is required

        om = self._get_om_from_accepting_invite()

        # Invite cannot be accepted without AuthIdentity if SSO is required
        assert om.email is not None
        assert om.user_id is None

    def test_accept_invite_with_required_SSO_with_identity(self) -> None:
        ap = self.create_auth_provider(organization_id=self.org.id, provider="Friendly IdP")
        assert not ap.flags.allow_unlinked  # SSO is required
        self.create_auth_identity(auth_provider=ap, user=self.user)

        om = self._get_om_from_accepting_invite()

        assert om.email is None
        assert om.user_id == self.user.id

    def test_invite_already_accepted_with_required_SSO(self) -> None:
        ap = self.create_auth_provider(organization_id=self.org.id, provider="Friendly IdP")
        assert not ap.flags.allow_unlinked  # SSO is required
        self.create_auth_identity(auth_provider=ap, user=self.user)

        self.test_invite_already_accepted_without_SSO()

    def test_handle_invite_not_approved_creates_audit_log(self) -> None:
        unapproved_member = self.create_member(
            user=None,
            email="unapproved@example.com",
            organization=self.org,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        invite_context = organization_service.get_invite_by_id(
            organization_member_id=unapproved_member.id,
            organization_id=self.org.id,
        )
        assert invite_context is not None

        helper = ApiInviteHelper(self.request, invite_context, None)
        with assume_test_silo_mode(SiloMode.CONTROL):
            helper.handle_invite_not_approved()

        with pytest.raises(OrganizationMember.DoesNotExist):
            OrganizationMember.objects.get(id=unapproved_member.id)

        assert_org_audit_log_exists(
            organization=self.org,
            event=audit_log.get_event_id("INVITE_REQUEST_REMOVE"),
        )

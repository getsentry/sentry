from datetime import timedelta

from django.conf import settings
from django.db import router
from django.db.models import F
from django.test import override_settings
from django.urls import reverse

from sentry import audit_log
from sentry.auth.authenticators.totp import TotpInterface
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.region import override_regions
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test
class AcceptInviteTest(TestCase, HybridCloudTestMixin):
    def setUp(self):
        super().setUp()
        with override_settings(SENTRY_REGION=settings.SENTRY_MONOLITH_REGION):
            self.organization = self.create_organization(owner=self.create_user("foo@example.com"))
        self.user = self.create_user("bar@example.com")

    def _get_paths(self, args):
        return (
            reverse("sentry-api-0-accept-organization-invite", args=args),
            reverse(
                "sentry-api-0-organization-accept-organization-invite",
                args=[self.organization.slug] + args,
            ),
            reverse(
                "sentry-api-0-organization-accept-organization-invite",
                args=[self.organization.id] + args,
            ),
        )

    def _get_urls(self):
        return (
            "sentry-api-0-accept-organization-invite",
            "sentry-api-0-organization-accept-organization-invite",
        )

    def _get_path(self, url, args):
        if url == self._get_urls()[0]:
            return reverse(url, args=args)
        return reverse(url, args=[self.organization.slug] + args)

    def _require_2fa_for_organization(self):
        with assume_test_silo_mode_of(Organization):
            self.organization.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        assert self.organization.flags.require_2fa.is_set

    def _assert_pending_invite_details_in_session(self, om):
        assert self.client.session["invite_token"] == om.token
        assert self.client.session["invite_member_id"] == om.id

    def _assert_pending_invite_details_not_in_session(self, response):
        session_invite_token = self.client.session.get("invite_token", None)
        session_invite_member_id = self.client.session.get("invite_member_id", None)
        assert session_invite_token is None
        assert session_invite_member_id is None

    def _enroll_user_in_2fa(self, user):
        interface = TotpInterface()
        interface.enroll(user)
        assert user.has_2fa()

    def test_invalid_member_id(self):
        for path in self._get_paths([1, 2]):
            resp = self.client.get(path)
            assert resp.status_code == 400

    def test_invalid_token(self):
        om = Factories.create_member(
            email="newuser@example.com", token="abc", organization=self.organization
        )
        for path in self._get_paths([om.id, 2]):
            resp = self.client.get(path)
            assert resp.status_code == 400

    def test_invite_not_pending(self):
        user = self.create_user(email="test@gmail.com")
        om = Factories.create_member(token="abc", organization=self.organization, user=user)
        for path in self._get_paths([om.id, om.token]):
            resp = self.client.get(path)
            assert resp.status_code == 400

    def test_invite_unapproved(self):
        om = Factories.create_member(
            email="newuser@example.com",
            token="abc",
            organization=self.organization,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
        for path in self._get_paths([om.id, om.token]):
            resp = self.client.get(path)
            assert resp.status_code == 400

    def test_needs_authentication(self):
        om = Factories.create_member(
            email="newuser@example.com", token="abc", organization=self.organization
        )
        for path in self._get_paths([om.id, om.token]):
            resp = self.client.get(path)
            assert resp.status_code == 200
            assert resp.json()["needsAuthentication"]

    def test_not_needs_authentication(self):
        self.login_as(self.user)

        om = Factories.create_member(
            email="newuser@example.com", token="abc", organization=self.organization
        )
        for path in self._get_paths([om.id, om.token]):
            resp = self.client.get(path)
            assert resp.status_code == 200
            assert not resp.json()["needsAuthentication"]

    def test_user_needs_2fa(self):
        self._require_2fa_for_organization()
        assert not self.user.has_2fa()

        self.login_as(self.user)

        om = Factories.create_member(
            email="newuser@example.com", token="abc", organization=self.organization
        )

        for path in self._get_paths([om.id, om.token]):
            resp = self.client.get(path)
            assert resp.status_code == 200
            assert resp.json()["needs2fa"]

            self._assert_pending_invite_details_in_session(om)

    def test_multi_region_organizationmember_id(self):
        org_region_name = OrganizationMapping.objects.get(
            organization_id=self.organization.id
        ).region_name
        regions = [
            Region("some-region", 10, "http://blah", RegionCategory.MULTI_TENANT),
            Region(org_region_name, 2, "http://moo", RegionCategory.MULTI_TENANT),
        ]
        with override_regions(regions), override_settings(SENTRY_MONOLITH_REGION=org_region_name):
            with unguarded_write(using=router.db_for_write(OrganizationMapping)):
                self.create_organization_mapping(
                    organization_id=101010,
                    slug="abcslug",
                    name="The Thing",
                    idempotency_key="",
                    region_name="some-region",
                )
            self._require_2fa_for_organization()
            assert not self.user.has_2fa()

            self.login_as(self.user)

            with assume_test_silo_mode_of(OrganizationMember), outbox_context(flush=False):
                om = OrganizationMember.objects.create(
                    email="newuser@example.com", token="abc", organization_id=self.organization.id
                )
            with unguarded_write(using=router.db_for_write(OrganizationMemberMapping)):
                OrganizationMemberMapping.objects.create(
                    organization_id=101010, organizationmember_id=om.id
                )
                OrganizationMemberMapping.objects.create(
                    organization_id=self.organization.id, organizationmember_id=om.id
                )

            for path in self._get_paths([om.id, om.token]):
                resp = self.client.get(path)
                assert resp.status_code == 200
                assert resp.json()["needs2fa"]

                self._assert_pending_invite_details_in_session(om)
                assert self.client.session["invite_organization_id"] == self.organization.id

    def test_multi_region_organizationmember_id__non_monolith(self):
        self._require_2fa_for_organization()
        assert not self.user.has_2fa()

        self.login_as(self.user)

        with assume_test_silo_mode_of(OrganizationMember), outbox_context(flush=False):
            om = OrganizationMember.objects.create(
                email="newuser@example.com", token="abc", organization_id=self.organization.id
            )
        with unguarded_write(using=router.db_for_write(OrganizationMemberMapping)):
            OrganizationMemberMapping.objects.create(
                organization_id=self.organization.id, organizationmember_id=om.id
            )

        with override_settings(SILO_MODE=SiloMode.CONTROL, SENTRY_MONOLITH_REGION="something-else"):
            resp = self.client.get(
                reverse("sentry-api-0-accept-organization-invite", args=[om.id, om.token])
            )
        assert resp.status_code == 400

    def test_user_has_2fa(self):
        self._require_2fa_for_organization()
        self._enroll_user_in_2fa(self.user)

        self.login_as(self.user)

        om = Factories.create_member(
            email="newuser@example.com", token="abc", organization=self.organization
        )
        for path in self._get_paths([om.id, om.token]):
            resp = self.client.get(path)
            assert resp.status_code == 200
            assert not resp.json()["needs2fa"]

            self._assert_pending_invite_details_not_in_session(resp)

    def test_user_can_use_sso(self):
        AuthProvider.objects.create(organization_id=self.organization.id, provider="google")
        self.login_as(self.user)

        om = Factories.create_member(
            email="newuser@example.com", token="abc", organization=self.organization
        )
        for path in self._get_paths([om.id, om.token]):
            resp = self.client.get(path)
            assert resp.status_code == 200
            assert resp.json()["needsSso"]
            assert resp.json()["hasAuthProvider"]
            assert resp.json()["ssoProvider"] == "Google"

    def test_can_accept_while_authenticated(self):
        urls = self._get_urls()

        for i, url in enumerate(urls):
            user = self.create_user(f"boo{i}@example.com")
            self.login_as(user)

            om = Factories.create_member(
                email=user.email,
                role="member",
                token="abc",
                organization=self.organization,
            )
            path = self._get_path(url, [om.id, om.token])
            resp = self.client.post(path)
            assert resp.status_code == 204

            with assume_test_silo_mode_of(OrganizationMember):
                om = OrganizationMember.objects.get(id=om.id)
            assert om.email is None
            assert om.user_id == user.id

            ale = AuditLogEntry.objects.filter(
                organization_id=self.organization.id, event=audit_log.get_event_id("MEMBER_ACCEPT")
            ).order_by("-datetime")[0]

            assert ale.actor == user
            assert ale.target_object == om.id
            assert ale.target_user == user
            assert ale.data

    def test_cannot_accept_expired(self):
        self.login_as(self.user)

        om = Factories.create_member(
            email="newuser@example.com", token="abc", organization=self.organization
        )
        with (
            assume_test_silo_mode_of(OrganizationMember),
            unguarded_write(using=router.db_for_write(OrganizationMember)),
        ):
            OrganizationMember.objects.filter(id=om.id).update(
                token_expires_at=om.token_expires_at - timedelta(days=31)
            )

        for path in self._get_paths([om.id, om.token]):
            resp = self.client.post(path)
            assert resp.status_code == 400

            with assume_test_silo_mode_of(OrganizationMember):
                om = OrganizationMember.objects.get(id=om.id)
            assert om.is_pending, "should not have been accepted"
            assert om.token, "should not have been accepted"

    def test_cannot_accept_unapproved_invite(self):
        self.login_as(self.user)

        om = Factories.create_member(
            email="newuser@example.com",
            role="member",
            token="abc",
            organization=self.organization,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
        for path in self._get_paths([om.id, om.token]):
            resp = self.client.post(path)
            assert resp.status_code == 400

        with assume_test_silo_mode_of(OrganizationMember):
            om = OrganizationMember.objects.get(id=om.id)
        assert not om.invite_approved
        assert om.is_pending
        assert om.token

    def test_member_already_exists(self):
        urls = self._get_urls()

        for i, url in enumerate(urls):
            user = self.create_user(f"boo{i}@example.com")
            self.login_as(user)

            om = Factories.create_member(
                email=user.email,
                role="member",
                token="abc",
                organization=self.organization,
            )
            path = self._get_path(url, [om.id, om.token])
            resp = self.client.post(path)
            assert resp.status_code == 204

            with assume_test_silo_mode_of(OrganizationMember):
                om = OrganizationMember.objects.get(id=om.id)
            assert om.email is None
            assert om.user_id == user.id

            om2 = Factories.create_member(
                email="newuser3@example.com",
                role="member",
                token="abcd",
                organization=self.organization,
            )
            self.assert_org_member_mapping(org_member=om2)
            with outbox_runner():
                path = self._get_path(url, [om2.id, om2.token])
                resp = self.client.post(path)
                assert resp.status_code == 400
            with assume_test_silo_mode_of(OrganizationMember):
                assert not OrganizationMember.objects.filter(id=om2.id).exists()
            self.assert_org_member_mapping_not_exists(org_member=om2)

    def test_can_accept_when_user_has_2fa(self):
        urls = self._get_urls()

        for i, url in enumerate(urls):
            self._require_2fa_for_organization()
            user = self.create_user(f"boo{i}@example.com")
            self._enroll_user_in_2fa(user)

            self.login_as(user)

            om = Factories.create_member(
                email="newuser" + str(i) + "@example.com",
                role="member",
                token="abc",
                organization=self.organization,
            )

            path = self._get_path(url, [om.id, om.token])
            resp = self.client.post(path)
            assert resp.status_code == 204

            self._assert_pending_invite_details_not_in_session(resp)

            with assume_test_silo_mode_of(OrganizationMember):
                om = OrganizationMember.objects.get(id=om.id)
            assert om.email is None
            assert om.user_id == user.id

            ale = AuditLogEntry.objects.filter(
                organization_id=self.organization.id, event=audit_log.get_event_id("MEMBER_ACCEPT")
            ).order_by("-datetime")[0]

            assert ale.actor == user
            assert ale.target_object == om.id
            assert ale.target_user == user
            assert ale.data

    def test_cannot_accept_when_user_needs_2fa(self):
        self._require_2fa_for_organization()
        self.assertFalse(self.user.has_2fa())

        self.login_as(self.user)

        om = Factories.create_member(
            email="newuser@example.com", role="member", token="abc", organization=self.organization
        )
        for path in self._get_paths([om.id, om.token]):
            resp = self.client.post(path)
            assert resp.status_code == 400

    # TODO(hybrid-cloud): Split this test per URL in the future, as the
    #  slug-less variant will not work in Control-Silo mode since we won't
    #  know which region the org resides in and will return a 400 level error.
    def test_2fa_cookie_deleted_after_accept(self):
        urls = self._get_urls()

        for i, url in enumerate(urls):
            self._require_2fa_for_organization()
            user = self.create_user(f"boo{i}@example.com")
            self.assertFalse(user.has_2fa())

            self.login_as(user)

            om = Factories.create_member(
                email="newuser" + str(i) + "@example.com",
                role="member",
                token="abc",
                organization=self.organization,
            )
            path = self._get_path(url, [om.id, om.token])
            resp = self.client.get(path)
            assert resp.status_code == 200
            self._assert_pending_invite_details_in_session(om)

            self._enroll_user_in_2fa(user)
            resp = self.client.post(path)
            assert resp.status_code == 204

            self._assert_pending_invite_details_not_in_session(resp)

    def test_mismatched_org_slug(self):
        self.login_as(self.user)

        om = Factories.create_member(
            email="newuser@example.com",
            role="member",
            token="abc",
            organization=self.organization,
        )

        path = reverse(
            "sentry-api-0-organization-accept-organization-invite", args=["asdf", om.id, om.token]
        )

        resp = self.client.get(path)
        assert resp.status_code == 400

        resp = self.client.post(path)
        assert resp.status_code == 400

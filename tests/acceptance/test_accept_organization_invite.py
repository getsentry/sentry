from django.db.models import F

from sentry.models import AuthProvider, Organization
from sentry.testutils import AcceptanceTestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AcceptOrganizationInviteTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.member = self.create_member(
            user=None,
            email="bar@example.com",
            organization=self.org,
            role="owner",
            teams=[self.team],
        )

    def test_invite_simple(self):
        self.login_as(self.user)
        with outbox_runner():
            self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        self.browser.snapshot(name="accept organization invite")
        assert self.browser.element_exists('[data-test-id="join-organization"]')

    def test_invite_not_authenticated(self):
        with outbox_runner():
            self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert self.browser.element_exists('[data-test-id="create-account"]')

    def test_invite_2fa_enforced_org(self):
        with outbox_runner():
            self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
            self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert not self.browser.element_exists_by_test_id("2fa-warning")

        self.login_as(self.user)
        with outbox_runner():
            self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        with outbox_runner():
            self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert self.browser.element_exists_by_test_id("2fa-warning")

    def test_invite_sso_org(self):
        AuthProvider.objects.create(organization_id=self.org.id, provider="google")
        with outbox_runner():
            self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert self.browser.element_exists_by_test_id("action-info-sso")
        assert self.browser.element_exists('[data-test-id="sso-login"]')

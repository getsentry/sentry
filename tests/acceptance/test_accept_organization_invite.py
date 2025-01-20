from django.db.models import F
from django.test import override_settings
from selenium.webdriver.common.by import By

from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


# When we want to set this @region_silo_test, we'll need to configure regions in order for invites to work.
# See the accept_organization_invite.py#get_invite_state logic
@no_silo_test
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

    def _sign_in_user(self, email, password):
        """
        Helper method to sign in a user with given email and password.
        """
        self.browser.find_element(By.ID, "id_username").send_keys(email)
        self.browser.find_element(By.ID, "id_password").send_keys(password)
        self.browser.find_element(By.XPATH, "//button[contains(text(), 'Sign In')]").click()

    def test_invite_simple(self):
        self.login_as(self.user)
        self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert self.browser.element_exists('[data-test-id="join-organization"]')

    def test_invite_not_authenticated(self):
        self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert self.browser.element_exists('[data-test-id="create-account"]')

    def test_invite_2fa_enforced_org(self):
        self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert not self.browser.element_exists_by_test_id("2fa-warning")

        self.login_as(self.user)
        self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert self.browser.element_exists_by_test_id("2fa-warning")

    def test_invite_sso_org(self):
        AuthProvider.objects.create(organization_id=self.org.id, provider="google")
        self.browser.get(self.member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')
        assert self.browser.element_exists_by_test_id("action-info-sso")
        assert self.browser.element_exists('[data-test-id="sso-login"]')

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    def test_authenticated_user_already_member_of_an_org_accept_invite_other_org(self):
        """
        Test that an authenticated user already part of an organization can accept an invite to another organization.
        """

        # Setup: Create a second user and make them a member of an organization
        email = "dummy@example.com"
        password = "dummy"
        user2 = self.create_user(email=email)
        user2.set_password(password)
        user2.save()
        self.create_organization(name="Second Org", owner=user2)

        # Action: Invite User2 to the first organization
        new_member = self.create_member(
            user=None,
            email=user2.email,
            organization=self.org,
            role="owner",
            teams=[self.team],
        )

        self.login_as(user2)

        # Simulate the user accessing the invite link
        self.browser.get(new_member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')

        self.browser.click('button[data-test-id="join-organization"]')
        assert self.browser.wait_until('[aria-label="Create project"]')

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    def test_not_authenticated_user_already_member_of_an_org_accept_invite_other_org(self):
        """
        Test that a not authenticated user already part of an organization can accept an invite to another organization.
        """

        # Setup: Create a second user and make them a member of an organization
        email = "dummy@example.com"
        password = "dummy"
        user2 = self.create_user(email=email)
        user2.set_password(password)
        user2.save()
        self.create_organization(name="Second Org", owner=user2)

        # Action: Invite User2 to the first organization
        new_member = self.create_member(
            user=None,
            email=user2.email,
            organization=self.org,
            role="member",
            teams=[self.team],
        )

        # Simulate the user accessing the invite link
        self.browser.get(new_member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')

        # Choose to login with existing account
        self.browser.click('a[data-test-id="link-with-existing"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Handle form validation: Prevent default invalid event blocking
        self.browser.driver.execute_script(
            "document.addEventListener('invalid', function(e) { e.preventDefault(); }, true);"
        )

        # Login
        self._sign_in_user(email, password)
        self.browser.wait_until('[data-test-id="join-organization"]')

        # Display the acceptance view for the invitation to join a new organization
        assert self.browser.element_exists(f"[aria-label='Join the {self.org.slug} organization']")

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    def test_existing_user_invite_2fa_enforced_org(self):
        """
        Test that a user who has an existing Sentry account can accept an invite to another organization
        and is required to go through the 2FA configuration view.
        """
        self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        # Setup: Create a second user and make them a member of an organization
        email = "dummy@example.com"
        password = "dummy"
        user2 = self.create_user(email=email)
        user2.set_password(password)
        user2.save()
        self.create_organization(name="Second Org", owner=user2)

        # Action: Invite User2 to the first organization
        new_member = self.create_member(
            user=None,
            email=user2.email,
            organization=self.org,
            role="owner",
            teams=[self.team],
        )
        # Simulate the user accessing the invite link
        self.browser.get(new_member.get_invite_link().split("/", 3)[-1])
        self.browser.wait_until('[data-test-id="accept-invite"]')

        # Accept the invitation using the existing account
        self.browser.click('a[data-test-id="link-with-existing"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Handle form validation: Prevent default invalid event blocking
        self.browser.driver.execute_script(
            "document.addEventListener('invalid', function(e) { e.preventDefault(); }, true);"
        )

        # Login using existing credentials
        self._sign_in_user(email, password)
        self.browser.wait_until('[data-test-id="2fa-warning"]')

        # Display the 2FA configuration view
        assert self.browser.element_exists("[aria-label='Configure Two-Factor Auth']")

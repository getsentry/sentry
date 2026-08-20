from django.conf import settings
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY
from django.contrib.sessions.backends.signed_cookies import SessionStore

from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test
from sentry.users.models.user import User

PASSWORD = "correct-password"


@no_silo_test
class ReactAuthTest(AcceptanceTestCase):
    def create_login_user(self, organization_slug: str | None = None) -> User:
        email = f"{self._testMethodName}@example.com"
        user = self.create_user(email=email)
        user.set_password(PASSWORD)
        user.save()
        self.organization = self.create_organization(owner=user, slug=organization_slug)

        return user

    def open_login(self, organization_slug: str | None = None) -> None:
        self.save_cookie(
            name="sentry_react_auth",
            value="1",
            expires="Tue, 20 Jun 2035 19:07:44 GMT",
        )
        login_path = f"/auth/login/{organization_slug}/" if organization_slug else "/auth/login/"
        self.browser.get(login_path)
        self.browser.wait_until('[aria-label="Email"]')

    def submit_credentials(
        self, email: str, password: str, organization_slug: str | None = None
    ) -> None:
        self.open_login(organization_slug)
        self.submit_visible_credentials(email, password)

    def submit_visible_credentials(self, email: str, password: str) -> None:
        self.browser.element('[aria-label="Email"]').send_keys(email)
        self.browser.element('[aria-label="Password"]').send_keys(password)
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Log in to Sentry']")

    def clear_session_authentication(self) -> None:
        cookie = self.browser.driver.get_cookie(settings.SESSION_COOKIE_NAME)
        assert cookie is not None

        session = SessionStore(session_key=cookie["value"])
        for key in (SESSION_KEY, BACKEND_SESSION_KEY, HASH_SESSION_KEY):
            session.pop(key, None)
        session.save()

        assert session.session_key is not None
        self.save_cookie(
            name=settings.SESSION_COOKIE_NAME,
            value=session.session_key,
            expires=None,
        )

    def submit_second_factor(self, code: str) -> None:
        self.browser.wait_until_script_execution(
            """
            return Array.from(document.querySelectorAll('[aria-label="One-time password"]'))
              .some(input => input.offsetParent !== null);
            """
        )
        inputs = self.browser.elements('[aria-label="One-time password"]')
        next(input_element for input_element in inputs if input_element.is_displayed()).send_keys(
            code
        )

    def wait_for_authenticated_organization(self, organization_slug: str) -> None:
        expected_path = f"/organizations/{organization_slug}/issues/"
        self.browser.wait_until_script_execution(
            f"return window.location.pathname === '{expected_path}'"
        )

    def test_password_authentication(self) -> None:
        user = self.create_login_user()

        self.submit_credentials(user.email, PASSWORD)

        self.wait_for_authenticated_organization(self.organization.slug)

    def test_wrong_password(self) -> None:
        user = self.create_login_user()

        self.submit_credentials(user.email, "wrong-password")

        self.browser.wait_until(
            xpath="//*[contains(text(), 'Please enter a correct username and password')]"
        )
        assert self.browser.driver.current_url.endswith("/auth/login/")

    def test_totp_authentication(self) -> None:
        user = self.create_login_user()
        totp = TotpInterface()
        totp.enroll(user)

        self.submit_credentials(user.email, PASSWORD)
        self.submit_second_factor(totp.make_otp().generate_otp())

        self.wait_for_authenticated_organization(self.organization.slug)

    def test_resumes_totp_authentication_after_refresh(self) -> None:
        user = self.create_login_user()
        totp = TotpInterface()
        totp.enroll(user)

        self.submit_credentials(user.email, PASSWORD)
        self.browser.wait_until('[aria-label="One-time password"]')
        self.browser.driver.refresh()
        self.browser.wait_until('[aria-label="One-time password"]')
        self.submit_second_factor(totp.make_otp().generate_otp())

        self.wait_for_authenticated_organization(self.organization.slug)

    def test_wrong_totp(self) -> None:
        user = self.create_login_user()
        totp = TotpInterface()
        totp.enroll(user)
        valid_code = totp.make_otp().generate_otp()
        invalid_code = f"{(int(valid_code) + 1) % 1_000_000:06d}"

        self.submit_credentials(user.email, PASSWORD)
        self.submit_second_factor(invalid_code)

        self.browser.wait_until(
            xpath="//*[contains(text(), 'Invalid two-factor authentication credentials')]"
        )
        assert self.browser.element_exists('[aria-label="One-time password"]')

    def test_recovery_code_authentication(self) -> None:
        user = self.create_login_user()
        TotpInterface().enroll(user)
        recovery = RecoveryCodeInterface()
        recovery.enroll(user)

        self.submit_credentials(user.email, PASSWORD)
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Use recovery code']")
        self.submit_second_factor(recovery.get_unused_codes()[0].replace("-", ""))

        self.wait_for_authenticated_organization(self.organization.slug)

    def test_multi_organization_login(self) -> None:
        user = self.create_login_user("org-a")
        org_a = self.organization
        org_b = self.create_organization(owner=user, slug="org-b")
        org_c = self.create_organization(owner=user, slug="org-c")

        # The first login defaults to the user's first organization.
        self.submit_credentials(user.email, PASSWORD)
        self.wait_for_authenticated_organization(org_a.slug)

        # Visiting another organization records it as the last active organization.
        self.browser.get(f"/organizations/{org_c.slug}/issues/")
        self.wait_for_authenticated_organization(org_c.slug)

        # An unscoped login defaults to the user's first organization.
        self.wait_for_loading()
        self.clear_session_authentication()
        self.submit_credentials(user.email, PASSWORD)
        self.wait_for_authenticated_organization(org_a.slug)

        # An organization-scoped login takes precedence over the last active organization.
        self.wait_for_loading()
        self.clear_session_authentication()
        self.submit_credentials(user.email, PASSWORD, org_b.slug)
        self.wait_for_authenticated_organization(org_b.slug)

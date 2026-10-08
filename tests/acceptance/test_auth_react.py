import re
from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY
from django.contrib.sessions.backends.signed_cookies import SessionStore
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from selenium.webdriver.common.keys import Keys

from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.testutils.silo import no_silo_test
from sentry.users.models.lostpasswordhash import LostPasswordHash
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail

PASSWORD = "correct-password"


@no_silo_test
class ReactAuthTest(AcceptanceTestCase):
    def test_single_organization_registration(self) -> None:
        organization = self.create_organization(slug="single-registration")

        with (
            self.options({"auth.allow-registration": True}),
            self.feature("auth:register"),
            self.settings(SENTRY_SINGLE_ORGANIZATION=True, SENTRY_ORGANIZATION=organization.id),
        ):
            self.browser.get("/auth/login/")
            self.browser.click_when_visible(xpath="//a[normalize-space(.)='Create an account']")
            self.browser.wait_until_clickable('input[name="name"]')
            self.browser.element('input[name="name"]').send_keys("New User")
            self.browser.element('input[name="email"]').send_keys("new.user@example.com")
            self.browser.element('input[name="password"]').send_keys(PASSWORD)
            self.browser.click_when_visible(xpath="//button[normalize-space(.)='Create account']")

            self.wait_for_authenticated_organization(organization.slug)

    def open_password_reset(self, user: User) -> str:
        password_hash = LostPasswordHash.for_user(user)
        path = reverse("sentry-account-recover-confirm", args=[user.id, password_hash.hash])
        self.browser.get(path)
        self.browser.wait_until(xpath="//h1[normalize-space(.)='Reset Password']")
        return path

    def submit_new_password(self, password: str) -> None:
        self.browser.wait_until_clickable('input[autocomplete="new-password"]')
        password_input = self.browser.element('input[autocomplete="new-password"]')
        password_input.send_keys(
            Keys.END,
            Keys.BACKSPACE * len(password_input.get_attribute("value") or ""),
            password,
        )
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Reset password']")

    def test_password_reset_from_email(self) -> None:
        user = self.create_login_user()
        user_email = UserEmail.objects.get(user=user, email=user.email)
        user_email.update(is_verified=False)
        previous_nonce = user.session_nonce
        self.open_login()
        self.browser.element('[aria-label="Email"]').send_keys(user.email)
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Forgot password?']")

        with BurstTaskRunner() as burst:
            self.browser.click_when_visible(xpath="//button[normalize-space(.)='Reset Password']")
            self.browser.wait_until(xpath="//*[contains(text(), 'A recovery link has been sent')]")
            burst()

        email_link = re.search(
            r"https?://[^\s]+/account/recover/confirm/[^\s]+", str(mail.outbox[-1].body)
        )
        assert email_link is not None
        reset_path = urlsplit(email_link.group()).path
        self.browser.get(reset_path)
        self.submit_new_password("new-secure-password")
        self.browser.wait_until(xpath="//*[normalize-space(.)='Your password has been reset.']")

        user.refresh_from_db()
        user_email.refresh_from_db()
        assert user.check_password("new-secure-password")
        assert not user.check_password(PASSWORD)
        assert user.session_nonce != previous_nonce
        assert user_email.is_verified
        assert not LostPasswordHash.objects.filter(user=user).exists()

        # Completing recovery leaves authentication to the sign-in flow.
        self.browser.wait_until('[aria-label="Email"]')
        self.submit_visible_credentials(user.email, "new-secure-password")
        self.wait_for_authenticated_organization(self.organization.slug)

    def test_password_reset_requires_two_factor_sign_in(self) -> None:
        user = self.create_login_user()
        totp = TotpInterface()
        totp.enroll(user)
        self.open_password_reset(user)

        self.submit_new_password("new-secure-password")
        self.browser.wait_until(xpath="//*[normalize-space(.)='Your password has been reset.']")
        self.browser.wait_until('[aria-label="Email"]')
        self.submit_visible_credentials(user.email, "new-secure-password")
        self.submit_second_factor(totp.make_otp().generate_otp())
        self.wait_for_authenticated_organization(self.organization.slug)

    def test_password_reset_expired_link(self) -> None:
        user = self.create_login_user()
        password_hash = LostPasswordHash.for_user(user)
        LostPasswordHash.objects.filter(user=user).update(
            date_added=timezone.now() - timedelta(hours=2)
        )
        previous_password = user.password

        self.browser.get(
            reverse("sentry-account-recover-confirm", args=[user.id, password_hash.hash])
        )
        self.browser.wait_until(
            xpath="//*[contains(text(), 'This password reset link is invalid or expired.')]"
        )

        assert not self.browser.element_exists('input[autocomplete="new-password"]')
        user.refresh_from_db()
        assert user.password == previous_password
        self.browser.click_when_visible(xpath="//a[normalize-space(.)='Back to sign in']")
        self.browser.wait_until('[aria-label="Email"]')

    def test_password_reset_invalid_link(self) -> None:
        user = self.create_login_user()
        previous_password = user.password

        self.browser.get(reverse("sentry-account-recover-confirm", args=[user.id, "invalidtoken"]))
        self.browser.wait_until(
            xpath="//*[contains(text(), 'This password reset link is invalid or expired.')]"
        )

        assert not self.browser.element_exists('input[autocomplete="new-password"]')
        user.refresh_from_db()
        assert user.password == previous_password

    def test_password_reset_link_cannot_be_reused(self) -> None:
        user = self.create_login_user()
        reset_path = self.open_password_reset(user)

        self.submit_new_password("new-secure-password")
        self.browser.wait_until(xpath="//*[normalize-space(.)='Your password has been reset.']")
        self.browser.get(reset_path)
        self.browser.wait_until(
            xpath="//*[contains(text(), 'This password reset link is invalid or expired.')]"
        )

        assert not self.browser.element_exists('input[autocomplete="new-password"]')
        user.refresh_from_db()
        assert user.check_password("new-secure-password")

    @override_settings(
        AUTH_PASSWORD_VALIDATORS=[
            {
                "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
                "OPTIONS": {"min_length": 8},
            }
        ]
    )
    def test_password_reset_validation(self) -> None:
        user = self.create_login_user()
        self.open_password_reset(user)

        self.submit_new_password("short")
        self.browser.wait_until(xpath="//*[contains(text(), 'This password is too short.')]")
        user.refresh_from_db()
        assert user.check_password(PASSWORD)
        assert LostPasswordHash.objects.filter(user=user).exists()

        self.submit_new_password("new-secure-password")
        self.browser.wait_until(xpath="//*[normalize-space(.)='Your password has been reset.']")
        user.refresh_from_db()
        assert user.check_password("new-secure-password")

    def create_login_user(self, organization_slug: str | None = None) -> User:
        email = f"{self._testMethodName}@example.com"
        user = self.create_user(email=email)
        user.set_password(PASSWORD)
        user.save()
        self.organization = self.create_organization(owner=user, slug=organization_slug)

        return user

    def open_login(self, organization_slug: str | None = None) -> None:
        login_path = f"/auth/login/{organization_slug}/" if organization_slug else "/auth/login/"
        self.browser.get(login_path)
        self.browser.wait_until_clickable('[aria-label="Email"]')

    def submit_credentials(
        self, email: str, password: str, organization_slug: str | None = None
    ) -> None:
        self.open_login(organization_slug)
        self.submit_visible_credentials(email, password)

    def submit_visible_credentials(self, email: str, password: str) -> None:
        self.browser.wait_until_clickable('[aria-label="Email"]')
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

    def locate_organization_sso(self, organization_slug: str) -> None:
        self.open_login()
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Organization SSO']")
        self.browser.element('[aria-label="Organization Slug"]').send_keys(organization_slug)
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Locate']")

    def select_organization_sso(self, organization_slug: str) -> None:
        self.locate_organization_sso(organization_slug)
        self.browser.wait_until(
            xpath="//*[contains(normalize-space(.), 'Members sign in with Dummy')]"
        )

    def leave_organization_sso(self) -> None:
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Wrong organization']")
        self.browser.wait_until('[aria-label="Email"]')

    def begin_organization_sso(self, organization_slug: str) -> None:
        self.select_organization_sso(organization_slug)
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='SSO']")

        # The dummy provider renders its email challenge inline as the initiation response.
        # A real provider redirects to its identity service before returning to Sentry.
        self.browser.wait_until('form > input[type="email"][name="email"]:only-child')

    def complete_dummy_sso(self, email: str) -> None:
        csrf_cookie = self.browser.driver.get_cookie(settings.CSRF_COOKIE_NAME)
        assert csrf_cookie is not None

        # Simulate the provider callback by posting its identity to the shared SSO continuation
        # endpoint. Include the browser's CSRF token because this remains a browser-driven POST.
        self.browser.driver.execute_script(
            """
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/auth/sso/';

            const input = document.createElement('input');
            input.name = 'email';
            input.value = arguments[0];
            form.appendChild(input);

            const csrfInput = document.createElement('input');
            csrfInput.name = 'csrfmiddlewaretoken';
            csrfInput.value = arguments[1];
            form.appendChild(csrfInput);

            document.body.appendChild(form);
            form.submit();
            """,
            email,
            csrf_cookie["value"],
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

    def test_demo_authentication(self) -> None:
        demo_user = self.create_user(email="demo@example.com")
        demo_organization = self.create_organization(owner=demo_user, slug="demo")

        with self.options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [demo_user.id],
                "demo-mode.orgs": [demo_organization.id],
            }
        ):
            self.browser.get(
                f"/auth/login/{demo_organization.slug}/"
                f"?next=%2Forganizations%2F{demo_organization.slug}%2Fissues%2F"
            )

            assert not self.browser.element_exists('[aria-label="Email"]')
            assert not self.browser.element_exists('[aria-label="Password"]')
            self.wait_for_authenticated_organization(demo_organization.slug)

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

    def test_organization_sso(self) -> None:
        user = self.create_login_user("sso-org")
        auth_provider = self.create_auth_provider(
            organization_id=self.organization.id, provider="dummy"
        )
        self.create_auth_identity(auth_provider=auth_provider, user_id=user.id, ident=user.email)

        # The organization lookup shows that SSO is required and starts its provider flow.
        self.begin_organization_sso(self.organization.slug)

        # The dummy provider callback authenticates the linked user.
        self.complete_dummy_sso(user.email)
        self.wait_for_authenticated_organization(self.organization.slug)

    def test_organization_sso_with_totp(self) -> None:
        user = self.create_login_user("sso-totp-org")
        totp = TotpInterface()
        totp.enroll(user)
        auth_provider = self.create_auth_provider(
            organization_id=self.organization.id, provider="dummy"
        )
        self.create_auth_identity(auth_provider=auth_provider, user_id=user.id, ident=user.email)

        # SSO identifies the user but leaves authentication pending on their second factor.
        self.begin_organization_sso(self.organization.slug)
        self.complete_dummy_sso(user.email)
        self.browser.wait_until_script_execution(
            "return window.location.pathname === '/auth/login/'"
        )
        self.browser.wait_until('[aria-label="One-time password"]')

        assert not self.browser.element_exists('[aria-label="Email"]')
        assert not self.browser.element_exists('[aria-label="Password"]')
        self.submit_second_factor(totp.make_otp().generate_otp())
        self.wait_for_authenticated_organization(self.organization.slug)

    def test_organization_without_sso(self) -> None:
        user = self.create_login_user("password-only-org")

        # The organization lookup explains that members use password authentication.
        self.locate_organization_sso(self.organization.slug)
        self.browser.wait_until(
            xpath="//*[contains(normalize-space(.), 'Members sign in with email and password')]"
        )
        sso_button = self.browser.element(xpath="//button[normalize-space(.)='SSO']")
        assert not sso_button.is_enabled()

        # Password authentication remains available for the selected organization.
        self.submit_visible_credentials(user.email, PASSWORD)
        self.wait_for_authenticated_organization(self.organization.slug)

    def test_password_authentication_with_optional_organization_sso(self) -> None:
        user = self.create_login_user("optional-sso-org")
        auth_provider = self.create_auth_provider(
            organization_id=self.organization.id, provider="dummy"
        )
        auth_provider.flags.allow_unlinked = True
        auth_provider.save()

        self.locate_organization_sso(self.organization.slug)
        self.browser.wait_until(
            xpath="//*[contains(normalize-space(.), 'Members sign in with Dummy')]"
        )
        assert self.browser.element_exists('[aria-label="Email"]')
        assert self.browser.element_exists('[aria-label="Password"]')
        self.submit_visible_credentials(user.email, PASSWORD)

        self.wait_for_authenticated_organization(self.organization.slug)

    def test_password_login_cannot_access_sso_required_organization(self) -> None:
        user = self.create_user(email="sso-password@example.com")
        user.set_password(PASSWORD)
        user.save()
        organization = self.create_organization(slug="sso-password-org")
        self.create_member(organization=organization, user=user)
        self.create_auth_provider(organization_id=organization.id, provider="dummy")

        # Leaving the SSO-required organization makes password authentication available.
        self.select_organization_sso(organization.slug)
        self.leave_organization_sso()
        self.submit_visible_credentials(user.email, PASSWORD)

        # Password authentication succeeds without granting access to the organization.
        self.browser.wait_until_script_execution(
            f"return window.location.pathname === '/auth/login/{organization.slug}/'"
        )
        self.browser.wait_until(
            xpath="//*[contains(normalize-space(.), 'Members sign in with Dummy')]"
        )

    def test_password_login_uses_organization_without_sso(self) -> None:
        user = self.create_user(email="multi-org-password@example.com")
        user.set_password(PASSWORD)
        user.save()
        sso_organization = self.create_organization(slug="sso-required-org")
        self.create_member(organization=sso_organization, user=user)
        self.create_auth_provider(organization_id=sso_organization.id, provider="dummy")
        password_organization = self.create_organization(owner=user, slug="password-org")

        # Leaving the SSO-required organization allows login to a password-capable one.
        self.select_organization_sso(sso_organization.slug)
        self.leave_organization_sso()
        self.submit_visible_credentials(user.email, PASSWORD)

        # The authenticated user lands in an accessible organization instead.
        self.wait_for_authenticated_organization(password_organization.slug)

    def test_sso_login_preserves_organization_destination(self) -> None:
        user = self.create_user(email="preserved-sso-destination@example.com")
        user.set_password(PASSWORD)
        user.save()
        sso_organization = self.create_organization(slug="preserved-sso-org")
        self.create_member(organization=sso_organization, user=user)
        auth_provider = self.create_auth_provider(
            organization_id=sso_organization.id,
            provider="dummy",
        )
        self.create_auth_identity(auth_provider=auth_provider, user_id=user.id, ident=user.email)
        self.create_organization(owner=user, slug="password-fallback-org")

        self.browser.get(f"/organizations/{sso_organization.slug}/issues/")
        self.browser.wait_until_script_execution(
            f"return window.location.pathname === '/auth/login/{sso_organization.slug}/'"
        )
        self.browser.wait_until(
            xpath="//*[contains(normalize-space(.), 'Members sign in with Dummy')]"
        )

        # SSO authentication returns to the protected organization destination.
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='SSO']")
        self.browser.wait_until('form > input[type="email"][name="email"]:only-child')
        self.complete_dummy_sso(user.email)
        self.wait_for_authenticated_organization(sso_organization.slug)

    def test_switch_to_sso_required_organization(self) -> None:
        user = self.create_login_user("org-a")
        password_organization = self.organization
        sso_organization = self.create_organization(owner=user, slug="org-b")
        auth_provider = self.create_auth_provider(
            organization_id=sso_organization.id, provider="dummy"
        )
        self.create_auth_identity(auth_provider=auth_provider, user_id=user.id, ident=user.email)

        # The user first authenticates into an organization that accepts password login.
        self.submit_credentials(user.email, PASSWORD)
        self.wait_for_authenticated_organization(password_organization.slug)

        # Navigating to an organization that requires SSO starts an organization-scoped login.
        self.browser.get(f"/organizations/{sso_organization.slug}/issues/")
        self.browser.wait_until_script_execution(
            f"return window.location.pathname === '/auth/login/{sso_organization.slug}/'"
        )

        # The current session cannot access the selected organization until SSO completes, so
        # the login page keeps the organization in focus and offers no alternative auth method.
        self.browser.wait_until(
            xpath="//*[contains(normalize-space(.), 'Members sign in with Dummy')]"
        )
        assert not self.browser.element_exists('[aria-label="Email"]')
        assert not self.browser.element_exists('[aria-label="Password"]')
        assert not self.browser.element_exists('[aria-label="Clear organization login context"]')

        # SSO authenticates the linked identity and returns the user to the protected org.
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='SSO']")
        self.browser.wait_until('input[name="email"]')
        self.complete_dummy_sso(user.email)
        self.wait_for_authenticated_organization(sso_organization.slug)

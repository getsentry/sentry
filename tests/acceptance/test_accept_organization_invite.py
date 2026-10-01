from django.conf import settings
from django.db.models import F
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.wait import WebDriverWait

from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.organization import Organization
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import no_silo_test
from sentry.users.models.user import User
from sentry.utils.otp import TOTP

PASSWORD = "correct-password"


# When we want to set this @cell_silo_test, we'll need to configure regions in order for invites to work.
# See the accept_organization_invite.py#get_invite_state logic
@no_silo_test
class AcceptOrganizationInviteTest(AcceptanceTestCase):
    def setUp(self) -> None:
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

    def open_invite(self) -> str:
        invite_path = self.member.get_invite_link().split("/", 3)[-1]
        self.browser.get(invite_path)
        self.browser.wait_until(xpath="//h1[normalize-space(.)='Accept Invitation']")
        return f"/{invite_path}"

    def create_login_user(self) -> User:
        user = self.create_user(self.member.email)
        user.set_password(PASSWORD)
        user.save()
        return user

    def sign_in(self, user: User) -> None:
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Sign in']")
        self.browser.element('[aria-label="Email"]').send_keys(user.email)
        self.browser.element('[aria-label="Password"]').send_keys(PASSWORD)
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Log in to Sentry']")

    def complete_dummy_sso(self, email: str) -> None:
        csrf_cookie = self.browser.driver.get_cookie(settings.CSRF_COOKIE_NAME)
        assert csrf_cookie is not None

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

    def accept_invitation(self, invite_path: str, user: User) -> None:
        self.assert_invite_pending()
        assert self.browser.driver.execute_script("return window.location.pathname") == invite_path
        self.browser.wait_until(xpath=f"//*[normalize-space(.)='{user.email}']")
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Accept invitation']")
        self.browser.wait_until_script_execution(
            f"return window.location.pathname !== '{invite_path}'"
        )
        self.member.refresh_from_db()
        assert self.member.user_id == user.id
        assert self.member.token is None

    def assert_invite_pending(self) -> None:
        self.member.refresh_from_db()
        assert self.member.user_id is None
        assert self.member.get_invite_link() is not None

    def test_authenticated_user_accepts_invite(self) -> None:
        self.login_as(self.user)
        invite_path = self.open_invite()

        self.accept_invitation(invite_path, self.user)

    @override_options({"auth.allow-registration": False})
    def test_create_account_and_accept_invite(self) -> None:
        invite_path = self.open_invite()
        self.browser.element('input[name="name"]').send_keys("New User")
        email_input = self.browser.element('input[name="email"]')
        assert email_input.get_attribute("value") == self.member.email
        self.browser.element('input[name="password"]').send_keys(PASSWORD)
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Create account']")

        self.browser.wait_until(xpath="//button[normalize-space(.)='Accept invitation']")
        user = User.objects.get(email=self.member.email)
        self.accept_invitation(invite_path, user)

    def test_sign_in_and_accept_invite(self) -> None:
        user = self.create_login_user()
        invite_path = self.open_invite()

        self.sign_in(user)
        self.browser.wait_until(xpath="//button[normalize-space(.)='Accept invitation']")
        self.accept_invitation(invite_path, user)

    def test_sign_in_with_mfa_and_accept_invite(self) -> None:
        user = self.create_login_user()
        totp = TotpInterface()
        totp.enroll(user)
        invite_path = self.open_invite()

        self.sign_in(user)
        self.browser.element('[aria-label="One-time password"]').send_keys(
            totp.make_otp().generate_otp()
        )
        self.browser.wait_until(xpath="//button[normalize-space(.)='Accept invitation']")
        self.accept_invitation(invite_path, user)

    def test_accept_invite_with_sso(self) -> None:
        user = self.create_login_user()
        auth_provider = self.create_auth_provider(organization_id=self.org.id, provider="dummy")
        self.create_auth_identity(auth_provider=auth_provider, user_id=user.id, ident=user.email)
        self.open_invite()

        self.browser.click_when_visible(xpath="//button[normalize-space(.)='SSO']")
        self.browser.wait_until('form > input[type="email"][name="email"]:only-child')
        self.complete_dummy_sso(user.email)

        self.browser.wait_until_script_execution(
            f"return !window.location.pathname.startsWith('/accept/') && "
            f"window.location.pathname.includes('/{self.org.slug}/')"
        )
        self.member.refresh_from_db()
        assert self.member.user_id == user.id
        assert self.member.token is None

    def test_switch_account_and_accept_invite(self) -> None:
        user = self.create_login_user()
        self.login_as(self.user)
        invite_path = self.open_invite()
        self.browser.wait_until(xpath=f"//*[normalize-space(.)='{self.user.email}']")

        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Switch account']")
        self.browser.wait_until('input[name="email"]')
        assert self.browser.element('input[name="email"]').get_attribute("value") == user.email
        self.sign_in(user)

        self.browser.wait_until(xpath="//button[normalize-space(.)='Accept invitation']")
        self.accept_invitation(invite_path, user)

    def test_resume_mfa_sign_in_after_refresh(self) -> None:
        user = self.create_login_user()
        totp = TotpInterface()
        totp.enroll(user)
        invite_path = self.open_invite()
        self.sign_in(user)
        self.browser.wait_until('[aria-label="One-time password"]')

        self.browser.driver.refresh()
        self.browser.element('[aria-label="One-time password"]').send_keys(
            totp.make_otp().generate_otp()
        )

        self.browser.wait_until(xpath="//button[normalize-space(.)='Accept invitation']")
        self.accept_invitation(invite_path, user)

    def test_invite_requires_account_2fa(self) -> None:
        with self.options({"system.url-prefix": self.browser.live_server_url}):
            self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
            user = self.create_login_user()
            invite_path = self.open_invite()
            self.sign_in(user)

            self.browser.wait_until('[aria-label="Configure Two-Factor Auth"]')
            driver = self.browser.driver
            invitation_window = driver.current_window_handle
            self.browser.click_when_visible('[aria-label="Configure Two-Factor Auth"]')
            WebDriverWait(driver, 10).until(expected_conditions.number_of_windows_to_be(2))
            enrollment_window = next(
                window for window in driver.window_handles if window != invitation_window
            )
            driver.switch_to.window(enrollment_window)

            self.browser.wait_until('a[href="/settings/account/security/mfa/totp/enroll/"]')
            self.browser.click_when_visible('a[href="/settings/account/security/mfa/totp/enroll/"]')
            secret = self.browser.element("input[readonly]").get_attribute("value")
            assert secret is not None
            self.browser.element("input:not([readonly])").send_keys(TOTP(secret).generate_otp())
            self.browser.click_when_visible(xpath="//button[normalize-space(.)='Confirm']")
            self.browser.wait_until_script_execution(
                "return window.location.pathname === '/settings/account/security/'"
            )
            assert user.has_2fa()
            self.assert_invite_pending()

            driver.close()
            driver.switch_to.window(invitation_window)
            self.browser.wait_until(xpath="//button[normalize-space(.)='Accept invitation']")
            self.accept_invitation(invite_path, user)

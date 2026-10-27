from urllib.parse import parse_qs, urlencode, urlsplit

from django.contrib.auth.hashers import make_password
from django.urls import reverse

from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.apidevicecode import DeviceCodeStatus
from sentry.models.apigrant import ApiGrant
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test
from sentry.users.models.user import User

PASSWORD = "correct-password"


@no_silo_test
class OAuthConsentTest(AcceptanceTestCase):
    def test_oauth_authorization_with_inline_login(self) -> None:
        user = self.create_user(password=make_password(PASSWORD))
        organization = self.create_organization(owner=user)
        callback_uri = self.browser.route("/oauth/device/")
        application = self.create_api_application(
            owner=user,
            redirect_uris=callback_uri,
            requires_org_level_access=True,
            scopes=["org:read"],
        )
        state = "return to OAuth & preserve state"
        code_challenge = "a" * 43
        authorize_query = urlencode(
            {
                "client_id": application.client_id,
                "response_type": "code",
                "redirect_uri": callback_uri,
                "scope": "org:read",
                "state": state,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            }
        )
        authorize_path = f"{reverse('sentry-oauth-authorize')}?{authorize_query}"

        self.browser.get(authorize_path)
        self.browser.wait_until('[aria-label="Email"]')
        login_location = urlsplit(self.browser.current_url)
        assert login_location.path == reverse("sentry-oauth-authorize")
        assert login_location.query == authorize_query

        self.sign_in(user)
        self.browser.wait_until('button[aria-label="Authorize"]')
        assert urlsplit(self.browser.current_url).path == reverse("sentry-oauth-authorize")
        assert not ApiGrant.objects.filter(application=application).exists()

        self.authorize()
        self.browser.wait_until('input[aria-label="Device code"]')

        grant = ApiGrant.objects.get(application=application, user=user)
        assert grant.redirect_uri == callback_uri
        assert grant.get_scopes() == ["org:read"]
        assert grant.organization_id == organization.id
        assert grant.code_challenge == code_challenge
        assert grant.code_challenge_method == "S256"
        assert parse_qs(urlsplit(self.browser.current_url).query) == {
            "code": [grant.code],
            "state": [state],
        }

    def test_device_authorization_with_inline_login_and_mfa(self) -> None:
        user = self.create_user(password=make_password(PASSWORD))
        self.create_organization(owner=user)
        totp = TotpInterface()
        totp.enroll(user)
        application = self.create_api_application(owner=user)
        device_code = self.create_api_device_code(
            application=application, scope_list=["project:read"]
        )
        device_path = (
            f"{reverse('sentry-oauth-device')}?{urlencode({'user_code': device_code.user_code})}"
        )

        self.browser.get(device_path)
        self.browser.wait_until('[aria-label="Email"]')
        assert urlsplit(self.browser.current_url).path == reverse("sentry-oauth-device")
        assert parse_qs(urlsplit(self.browser.current_url).query)["user_code"] == [
            device_code.user_code
        ]
        self.sign_in(user)
        self.submit_second_factor(totp.make_otp().generate_otp())
        self.browser.wait_until('button[aria-label="Authorize"]')
        assert urlsplit(self.browser.current_url).path == reverse("sentry-oauth-device")
        assert (
            device_code.user_code
            in self.browser.element('[role="group"][aria-label="Device code"]').text
        )
        device_code.refresh_from_db()
        assert device_code.status == DeviceCodeStatus.PENDING

        self.authorize()
        self.browser.wait_until(xpath="//*[contains(text(), 'Application authorized.')]")

        device_code.refresh_from_db()
        assert device_code.status == DeviceCodeStatus.APPROVED
        assert device_code.user_id == user.id

    def authorize(self) -> None:
        self.browser.move_to('button[aria-label="Authorize"]')
        self.browser.wait_until_clickable('button[aria-label="Authorize"]')
        self.browser.click_when_visible('button[aria-label="Authorize"]')

    def sign_in(self, user: User) -> None:
        self.browser.wait_until_clickable('[aria-label="Email"]')
        self.browser.element('[aria-label="Email"]').send_keys(user.email)
        self.browser.element('[aria-label="Password"]').send_keys(PASSWORD)
        self.browser.click_when_visible(xpath="//button[normalize-space(.)='Log in to Sentry']")

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

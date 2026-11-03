from selenium.webdriver.common.keys import Keys

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AuthTest(AcceptanceTestCase):
    def enter_auth(self, username: str, password: str) -> None:
        self.browser.get("/auth/login/")
        self.browser.driver.execute_script(
            "document.addEventListener('invalid', function(e) { e.preventDefault(); }, true);"
        )
        self.browser.wait_until_clickable('[aria-label="Email"]')
        self.browser.element('[aria-label="Email"]').send_keys(username)
        self.browser.element('[aria-label="Password"]').send_keys(password, Keys.ENTER)

    def test_renders(self) -> None:
        self.browser.get("/auth/login/")

    def test_no_credentials(self) -> None:
        self.enter_auth("", "")

    def test_invalid_credentials(self) -> None:
        self.enter_auth("bad-username", "bad-username")

    def test_success(self) -> None:
        email = "dummy@example.com"
        password = "dummy"
        user = self.create_user(email=email)
        user.set_password(password)
        user.save()

        self.enter_auth(email, password)
        self.browser.wait_until_script_execution(
            "return window.location.pathname === '/organizations/new/'"
        )

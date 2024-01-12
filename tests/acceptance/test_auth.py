from selenium.webdriver.common.by import By

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AuthTest(AcceptanceTestCase):
    def enter_auth(self, username, password):
        self.browser.get("/auth/login/")
        self.browser.driver.execute_script(
            "document.addEventListener('invalid', function(e) { e.preventDefault(); }, true);"
        )
        self.browser.find_element(by=By.ID, value="id_username").send_keys(username)
        self.browser.find_element(by=By.ID, value="id_password").send_keys(password)
        self.browser.find_element(
            by=By.XPATH, value="//button[contains(text(), 'Continue')]"
        ).click()

    def test_renders(self):
        self.browser.get("/auth/login/")

    def test_no_credentials(self):
        self.enter_auth("", "")

    def test_invalid_credentials(self):
        self.enter_auth("bad-username", "bad-username")

    def test_success(self):
        email = "dummy@example.com"
        password = "dummy"
        user = self.create_user(email=email)
        user.set_password(password)
        user.save()

        self.enter_auth(email, password)
        self.browser.wait_until_not(".loading")

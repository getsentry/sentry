from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class AuthTest(AcceptanceTestCase):
    def enter_auth(self, username, password):
        self.browser.get("/auth/login/")
        self.browser.driver.execute_script(
            "document.addEventListener('invalid', function(e) { e.preventDefault(); }, true);"
        )
        self.browser.find_element_by_id("id_username").send_keys(username)
        self.browser.find_element_by_id("id_password").send_keys(password)
        self.browser.find_element_by_xpath("//button[contains(text(), 'Continue')]").click()

    def test_renders(self):
        self.browser.get("/auth/login/")
        self.browser.snapshot(name="login")

    def test_no_credentials(self):
        self.enter_auth("", "")
        self.browser.snapshot(name="login fields required")

    def test_invalid_credentials(self):
        self.enter_auth("bad-username", "bad-username")
        self.browser.snapshot(name="login fields invalid")

    def test_success(self):
        email = "dummy@example.com"
        password = "dummy"
        user = self.create_user(email=email)
        user.set_password(password)
        user.save()

        self.enter_auth(email, password)
        self.browser.wait_until_not(".loading")
        self.browser.snapshot(name="login success")

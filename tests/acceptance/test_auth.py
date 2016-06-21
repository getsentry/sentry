from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class AuthTest(AcceptanceTestCase):
    def enter_auth(self, username, password):
        # disable captcha as it makes these tests flakey (and requires waiting
        # on external resources)
        with self.settings(RECAPTCHA_PUBLIC_KEY=None):
            self.browser.get(self.route('/auth/login/'))
            self.browser.find_element_by_id('id_username').send_keys(username)
            self.browser.find_element_by_id('id_password').send_keys(password)
            self.browser.find_element_by_xpath("//button[contains(text(), 'Login')]").click()

    def test_auth_page(self):
        self.browser.get(self.live_server_url)
        self.snapshot(name='login')

    def test_auth_failures(self):
        self.enter_auth('', '')
        self.snapshot(name='login fields required')

        self.enter_auth('bad-username', 'bad-username')
        self.snapshot(name='login fields invalid')

    def test_auth_success(self):
        email = 'dummy@example.com'
        password = 'dummy'
        user = self.create_user(email=email)
        user.set_password(password)
        user.save()

        self.enter_auth(email, password)
        self.snapshot(name='login success')

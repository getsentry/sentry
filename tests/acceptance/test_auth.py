from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class AuthTest(AcceptanceTestCase):
    def test_auth_page(self):
        self.browser.get(self.live_server_url)
        self.percy.snapshot(name='login')

    def test_auth_failures(self):
        self.login('', '')
        self.percy.snapshot(name='login fields required')

        self.login('bad-username', 'bad-username')
        self.percy.snapshot(name='login fields invalid')

    def test_new_organization(self):
        email = 'dummy@example.com'
        password = 'dummy'
        user = self.create_user(email=email)
        user.set_password(password)
        user.save()

        self.login(email, password)
        self.percy.snapshot()

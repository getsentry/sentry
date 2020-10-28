from __future__ import absolute_import

from django.conf import settings

from sentry.testutils import AcceptanceTestCase


class CreateOrganizationTest(AcceptanceTestCase):
    def setUp(self):
        super(CreateOrganizationTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)

    def test_simple(self):
        settings.PRIVACY_URL = "https://sentry.io/privacy/"
        settings.TERMS_URL = "https://sentry.io/terms/"
        self.browser.get("/organizations/new/")
        assert self.browser.element_exists('input[id="id-name"]')
        assert self.browser.element_exists('input[id="id-agreeTerms"]')
        self.browser.snapshot(name="create organization")
        self.browser.element('input[name="name"]').send_keys("new org")
        self.browser.element('input[id="id-agreeTerms"]').click()
        self.browser.click('button[type="submit"]')
        # After creating an org should end up on create project
        self.browser.wait_until_test_id("platform-javascript-react")
        assert self.browser.element_exists_by_test_id("create-project")

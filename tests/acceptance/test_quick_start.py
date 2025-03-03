from django.conf import settings

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationQuickStartTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)

    @with_feature("organizations:onboarding")
    def test_quick_start_sidebar_is_not_automatically_opened_after_project_creation(self):
        settings.PRIVACY_URL = "https://sentry.io/privacy/"
        settings.TERMS_URL = "https://sentry.io/terms/"

        # navigate to the new organization page form
        self.browser.get("/organizations/new/")

        # create new organization
        self.browser.element('input[name="name"]').send_keys("new org")
        self.browser.element('input[name="agreeTerms"]').click()
        self.browser.click('button[type="submit"]')

        # create new project
        self.browser.wait_until_test_id("platform-javascript-react")
        self.browser.click('[data-test-id="platform-javascript-react"')
        self.browser.click('button[aria-label="Create Project"]')

        # open the getting start docs for react
        self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')

        # verify that the quick start sidebar is not automatically opened
        assert not self.browser.element_exists_by_test_id("quick-start-content")

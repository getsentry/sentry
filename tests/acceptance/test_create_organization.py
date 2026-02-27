from django.test import override_settings

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class CreateOrganizationTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.login_as(self.user)

    @override_settings(
        PRIVACY_URL="https://sentry.io/privacy/", TERMS_URL="https://sentry.io/terms/"
    )
    def test_simple(self) -> None:
        self.browser.get("/organizations/new/")
        assert self.browser.wait_until('input[name="name"]')
        assert self.browser.element_exists('input[name="name"]')
        assert self.browser.element_exists('input[name="agreeTerms"]')
        self.browser.element('input[name="name"]').send_keys("new org")
        self.browser.element('input[name="agreeTerms"]').click()
        self.browser.click('button[type="submit"]')
        # After creating an org should end up on create project
        self.browser.wait_until_test_id("platform-javascript-react")
        assert self.browser.element_exists_by_test_id("create-project")

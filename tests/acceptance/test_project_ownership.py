from sentry.testutils import AcceptanceTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectOwnershipTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.path = f"/settings/{self.organization.slug}/projects/{self.project.slug}/ownership/"

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.wait_until_test_id("issueowners-panel")
        self.browser.snapshot("project ownership")

    def test_open_modal(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.wait_until_test_id("issueowners-panel")
        self.browser.click('[aria-label="Edit"]')
        self.browser.wait_until("[role='dialog']")
        self.browser.wait_until_not("div[class$='loadingIndicator']")
        self.browser.snapshot("project ownership modal")

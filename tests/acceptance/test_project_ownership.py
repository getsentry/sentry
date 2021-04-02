from sentry.testutils import AcceptanceTestCase


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

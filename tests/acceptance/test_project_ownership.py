from sentry.testutils import AcceptanceTestCase


class ProjectOwnershipTest(AcceptanceTestCase):
    def setUp(self):
        super(ProjectOwnershipTest, self).setUp()
        self.login_as(self.user)
        self.path = "/settings/{}/projects/{}/ownership/".format(
            self.organization.slug, self.project.slug
        )

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.wait_until('[name="select-type"]')
        self.browser.wait_until_not(".Select-loading")
        self.browser.snapshot("project ownership")

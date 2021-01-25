from sentry.testutils import AcceptanceTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now

FEATURE_NAMES = [
    "organizations:discover-basic",
    "organizations:discover-query",
    "organizations:dashboards-v2",
]


class OrganizationDashboardsAcceptanceTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationDashboardsAcceptanceTest, self).setUp()
        min_ago = iso_format(before_now(minutes=1))
        self.default_path = "/organizations/{}/dashboards/default-overview/".format(
            self.organization.slug
        )
        self.store_event(
            data={"event_id": "a" * 32, "message": "oh no", "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.login_as(self.user)

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def test_view_dashboard(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.default_path)
            self.wait_until_loaded()
            self.browser.snapshot("dashboards - default overview")

    def test_edit_dashboard(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.default_path)
            self.wait_until_loaded()

            button = self.browser.element('[data-test-id="dashboard-edit"]')
            button.click()
            self.browser.snapshot("dashboards - edit state")

    def test_add_widget(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.default_path)
            self.wait_until_loaded()

            # Go to edit mode.
            button = self.browser.element('[data-test-id="dashboard-edit"]')
            button.click()

            # Add a widget
            button = self.browser.element('[data-test-id="widget-add"]')
            button.click()
            self.browser.snapshot("dashboards - add widget")

    def test_edit_widget(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.default_path)
            self.wait_until_loaded()

            # Go to edit mode.
            button = self.browser.element('[data-test-id="dashboard-edit"]')
            button.click()

            # Edit the first widget.
            button = self.browser.element('[data-test-id="widget-edit"]')
            button.click()
            self.browser.snapshot("dashboards - edit widget")

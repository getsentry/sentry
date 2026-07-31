from selenium.webdriver.common.keys import Keys

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationUptimeTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.uptime_path = f"/organizations/{self.organization.slug}/insights/uptime/"
        self.team = self.create_team(organization=self.organization, name="Uptime Team")

        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Uptime Test Project"
        )
        self.create_team_membership(self.team, user=self.user)
        self.login_as(self.user)

    def _monitor_details_path(self, detector_id: int) -> str:
        return f"/organizations/{self.organization.slug}/monitors/{detector_id}/"

    @with_feature("organizations:uptime")
    def test_create_uptime_monitor_flow(self) -> None:
        """
        Test complete flow:
          -> empty overview
          -> create monitor (via the new /monitors/ UI)
          -> pick monitor type
          -> fill form
          -> see on details page
          -> return to overview
        """
        # Step 1: Start from empty uptime overview page
        self.browser.get(self.uptime_path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Verify we're on the empty state
        self.browser.wait_until(xpath="//*[text()='The selected projects have no uptime monitors']")

        # Step 2: Click "Add Uptime Monitor". This redirects to the new monitor
        # creation flow with the uptime detector type preselected.
        self.browser.click_when_visible("a[aria-label='Add Uptime Monitor']")

        # Step 3: Detector type selection (step 1 of 2). Uptime is preselected via
        # the redirect's detectorType query param, so continue to the settings step.
        self.browser.click_when_visible(xpath="//button[normalize-space()='Next']")

        # Step 4: Fill out the uptime monitor settings form.
        # The monitor name is an editable-text field in the header.
        self.browser.click_when_visible('[data-test-id="editable-text-label"]')
        name_input = self.browser.element(xpath='//input[@aria-label="Monitor Name"]')
        name_input.send_keys("My Test Uptime Monitor", Keys.ENTER)

        url_input = self.browser.find_element_by_name("url")
        url_input.send_keys("https://example.com")

        environment_input = self.browser.element(xpath='//input[@aria-label="Select Environment"]')
        environment_input.click()
        environment_input.send_keys("production", Keys.ENTER)

        # Step 5: Submit the form
        self.browser.click_when_visible(xpath="//button[normalize-space()='Create Monitor']")

        # Step 6: Should navigate to the monitor details page
        self.browser.wait_until_not('[data-test-id="loading-indicator"]', timeout=10)
        self.browser.wait_until(xpath="//*[contains(text(), 'My Test Uptime Monitor')]")

        # Step 7: Navigate back to uptime overview
        self.browser.get(self.uptime_path)

        # Step 8: Verify the monitor is now shown in the overview list
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until(xpath="//*[contains(text(), 'My Test Uptime Monitor')]")

    @with_feature("organizations:uptime")
    def test_edit_uptime_monitor(self) -> None:
        """Test editing an existing uptime monitor"""
        uptime_subscription = self.create_uptime_subscription(
            url="https://sentry.io",
            timeout_ms=5000,
        )
        detector = self.create_uptime_detector(
            name="My Awesome Monitor",
            project=self.project,
            uptime_subscription=uptime_subscription,
        )

        # Navigate to uptime overview
        self.browser.get(self.uptime_path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Verify the monitor is visible in the list
        self.browser.wait_until(xpath="//h3[contains(text(), 'My Awesome Monitor')]")

        # Open the monitor details page
        self.browser.get(self._monitor_details_path(detector.id))
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until(xpath="//*[contains(text(), 'My Awesome Monitor')]")

        # Click edit button
        self.browser.click_when_visible(xpath="//a[normalize-space()='Edit']")

        # Should show edit form
        self.browser.wait_until('[name="url"]')

        # Verify the form fields are populated with existing values
        url_input = self.browser.find_element_by_name("url")
        assert url_input.get_attribute("value") == "https://sentry.io"

        # Update the name via the editable-text field
        self.browser.click_when_visible('[data-test-id="editable-text-label"]')
        name_input = self.browser.element(xpath='//input[@aria-label="Monitor Name"]')
        name_input.clear()
        name_input.send_keys("Updated Monitor Name", Keys.ENTER)

        self.browser.click_when_visible(xpath="//button[normalize-space()='Save']")

        # After form submission, wait for success and verify the updated name
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until(xpath="//*[contains(text(), 'Updated Monitor Name')]")

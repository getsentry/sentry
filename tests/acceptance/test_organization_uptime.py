from typing import int
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

    @with_feature("organizations:uptime")
    def test_create_uptime_monitor_flow(self) -> None:
        """
        Test complete flow:
          -> empty overview
          -> create monitor
          -> fill form
          -> see on details page
          -> return to overview
        """
        # Step 1: Start from empty uptime overview page
        self.browser.get(self.uptime_path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Verify we're on the empty state
        self.browser.wait_until(xpath="//*[text()='The selected projects have no uptime monitors']")

        # Step 2: Click "Add Uptime Monitor" button in empty state
        self.browser.click_when_visible("a[aria-label='Add Uptime Monitor']")

        # Should navigate to uptime alert creation form
        self.browser.wait_until('[name="name"]')

        # Step 3: Fill out the uptime monitor form
        name_input = self.browser.find_element_by_name("name")
        name_input.send_keys("My Test Uptime Monitor")

        url_input = self.browser.find_element_by_name("url")
        url_input.send_keys("https://example.com")

        self.browser.click_when_visible(xpath='//label[@aria-label="Environment"]')
        self.browser.element(
            xpath='//label[@aria-label="Environment"]/following-sibling::div//input'
        ).send_keys("production", Keys.ENTER)

        # Step 4: Submit the form using the manual approach from debug test
        # Find the submit button in the form
        self.browser.element("button[aria-label='Create Rule']").click()

        # Step 5: Should navigate to uptime monitor details page
        # Wait for page to load and check URL change
        self.browser.wait_until_not('[data-test-id="loading-indicator"]', timeout=10)

        self.browser.wait_until(xpath="//h1[contains(text(), 'My Test Uptime Monitor')]")
        self.browser.element_exists(xpath="//*[contains(text(), 'https://example.com')]")

        # Step 6: Navigate back to uptime overview
        self.browser.get(self.uptime_path)

        # Step 7: Verify the monitor is now shown in the overview list
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until(xpath="//*[contains(text(), 'My Test Uptime Monitor')]")

    @with_feature("organizations:uptime")
    def test_edit_uptime_monitor(self) -> None:
        """Test editing an existing uptime monitor"""
        uptime_subscription = self.create_uptime_subscription(
            url="https://sentry.io",
            timeout_ms=5000,
        )
        self.create_uptime_detector(
            name="My Awesome Monitor",
            project=self.project,
            uptime_subscription=uptime_subscription,
        )

        # Navigate to uptime overview
        self.browser.get(self.uptime_path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Verify the monitor is visible in the list
        self.browser.wait_until(xpath="//h3[contains(text(), 'My Awesome Monitor')]")

        # Click on the monitor to edit it
        self.browser.click_when_visible(xpath="//a//h3[contains(text(), 'My Awesome Monitor')]")

        # Should navigate to monitor details page
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until(xpath="//h1[contains(text(), 'My Awesome Monitor')]")

        # Click edit button
        self.browser.click_when_visible("a[aria-label='Edit Rule']")

        # Should show edit form
        self.browser.wait_until('[name="name"]')

        # Verify the form fields are populated with existing values
        name_input = self.browser.find_element_by_name("name")
        assert name_input.get_attribute("value") == "My Awesome Monitor"

        url_input = self.browser.find_element_by_name("url")
        assert url_input.get_attribute("value") == "https://sentry.io"

        # Update the name
        name_input.clear()
        name_input.send_keys("Updated Monitor Name")

        self.browser.element("button[aria-label='Save Rule']").click()

        # After form submission, wait for success and verify the updated name
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until(xpath="//h1[contains(text(), 'Updated Monitor Name')]")

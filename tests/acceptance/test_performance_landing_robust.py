"""
Sample implementation of robust acceptance test for performance landing page.
This demonstrates the improvements proposed in the test robustness analysis.
"""
import time
from unittest.mock import patch

from django.db.models import F

from fixtures.page_objects.base import BasePage
from sentry.models.project import Project
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test
from sentry.utils.samples import load_data

FEATURE_NAMES = (
    "organizations:discover-basic",
    "organizations:performance-view",
)


class TestWaitUtils:
    """Utility class for robust waiting in tests"""

    @staticmethod
    def wait_for_condition(
        condition_func,
        timeout: int = 30,
        poll_interval: float = 0.1,
        error_message: str = "Condition not met within timeout"
    ):
        """Wait for a condition to be true with exponential backoff"""
        start_time = time.time()
        current_interval = poll_interval

        while time.time() - start_time < timeout:
            if condition_func():
                return True
            time.sleep(current_interval)
            current_interval = min(current_interval * 1.2, 2.0)  # Exponential backoff

        raise TimeoutError(error_message)


@no_silo_test
class RobustPerformanceLandingTest(AcceptanceTestCase, SnubaTestCase):
    """
    Robust version of performance landing test with improved reliability.

    Key improvements:
    1. Better event processing synchronization
    2. Increased timeouts with exponential backoff
    3. More robust wait conditions
    4. Better error handling and debugging
    """

    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/performance/"
        self.page = BasePage(self.browser)

    def wait_for_event_processing(self, project_id, expected_count=1, timeout=30):
        """
        Wait for events to be processed with exponential backoff.

        This addresses the race condition where UI loads before events are processed.
        """
        def check_events():
            try:
                # Check if events are available in the system
                event_count = self.get_event_count(project_id)
                return event_count >= expected_count
            except Exception:
                # If we can't check, assume not ready
                return False

        return TestWaitUtils.wait_for_condition(
            check_events,
            timeout=timeout,
            error_message=f"Event processing timed out after {timeout}s. "
                         f"Expected {expected_count} events for project {project_id}"
        )

    def wait_for_project_transaction_flag(self, project):
        """Wait for project to have transaction flag set"""
        def check_flag():
            project.refresh_from_db()
            return bool(project.flags & Project.flags.has_transactions)

        return TestWaitUtils.wait_for_condition(
            check_flag,
            timeout=10,
            error_message="Project transaction flag not set within timeout"
        )

    def wait_for_ui_element_stable(self, selector, timeout=15):
        """
        Wait for UI element to be stable (not changing) for a period.

        This helps with elements that might flicker or change during loading.
        """
        stable_duration = 2  # seconds element should be stable
        check_interval = 0.5

        def element_stable():
            try:
                element = self.browser.find_element_by_css_selector(selector)
                if not element:
                    return False

                # Check if element is stable for the required duration
                start_check = time.time()
                last_state = element.get_attribute('outerHTML')

                while time.time() - start_check < stable_duration:
                    time.sleep(check_interval)
                    current_state = element.get_attribute('outerHTML')
                    if current_state != last_state:
                        return False  # Element changed, not stable
                    last_state = current_state

                return True
            except Exception:
                return False

        return TestWaitUtils.wait_for_condition(
            element_stable,
            timeout=timeout,
            error_message=f"UI element {selector} did not stabilize within {timeout}s"
        )

    @patch("django.utils.timezone.now")
    def test_with_data_robust(self, mock_now):
        """
        Robust version of the performance landing test.

        Key improvements:
        1. Proper event processing synchronization
        2. Better timeout handling
        3. More stable UI element detection
        4. Better error messages for debugging
        """
        mock_now.return_value = before_now()

        # Store event and update project
        event = load_data("transaction", timestamp=before_now(minutes=10))
        self.store_event(data=event, project_id=self.project.id)
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        # Wait for event processing before UI interaction
        self.wait_for_event_processing(self.project.id, expected_count=1)

        # Wait for project flag to be properly set
        self.wait_for_project_transaction_flag(self.project)

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()

            # More robust wait for data table to be populated
            # Instead of waiting for empty state to disappear, wait for data to appear
            data_table_selector = '[data-test-id="grid-editable"] tbody tr'

            try:
                # Wait for at least one data row to appear
                self.browser.wait_until(data_table_selector, timeout=15)

                # Wait for the UI to stabilize (no more loading states)
                self.wait_for_ui_element_stable(data_table_selector, timeout=10)

                # Verify we have actual data, not just empty rows
                rows = self.browser.find_elements_by_css_selector(data_table_selector)
                assert len(rows) > 0, "No data rows found in performance table"

                # Verify the data contains expected transaction data
                first_row = rows[0]
                assert first_row.text.strip(), "First row appears to be empty"

            except Exception as e:
                # Enhanced error reporting for debugging
                page_source = self.browser.page_source
                current_url = self.browser.current_url

                # Check for any error messages on the page
                error_elements = self.browser.find_elements_by_css_selector('[data-test-id="error"]')
                error_messages = [elem.text for elem in error_elements]

                error_context = {
                    "current_url": current_url,
                    "page_contains_error": bool(error_elements),
                    "error_messages": error_messages,
                    "project_id": self.project.id,
                    "event_stored": True,
                    "feature_flags": FEATURE_NAMES,
                }

                raise AssertionError(f"Test failed with context: {error_context}") from e

    @patch("django.utils.timezone.now")
    def test_with_data_and_new_widget_designs_robust(self, mock_now):
        """
        Robust version of the widget designs test.

        This test includes the same robustness improvements as the main test.
        """
        mock_now.return_value = before_now()

        event = load_data("transaction", timestamp=before_now(minutes=10))
        self.store_event(data=event, project_id=self.project.id)
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        # Wait for event processing
        self.wait_for_event_processing(self.project.id, expected_count=1)
        self.wait_for_project_transaction_flag(self.project)

        FEATURES = (
            "organizations:discover-basic",
            "organizations:performance-view",
            "organizations:performance-new-widget-designs",
        )

        with self.feature(FEATURES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()

            # More robust wait with better error handling
            try:
                self.browser.wait_until_not(
                    '[data-test-id="grid-editable"] [data-test-id="empty-state"]',
                    timeout=15  # Increased timeout
                )

                # Additional verification that new widget designs are loaded
                widget_elements = self.browser.find_elements_by_css_selector('[data-test-id="performance-widget"]')
                assert len(widget_elements) > 0, "No performance widgets found with new designs"

            except Exception as e:
                # Enhanced debugging for widget design failures
                feature_flags_active = self.browser.execute_script(
                    "return window.__SENTRY_FEATURE_FLAGS__ || {}"
                )

                error_context = {
                    "active_features": feature_flags_active,
                    "expected_features": FEATURES,
                    "widget_elements_count": len(self.browser.find_elements_by_css_selector('[data-test-id="performance-widget"]')),
                }

                raise AssertionError(f"Widget design test failed: {error_context}") from e

    def test_empty_state_handling(self):
        """
        Test proper handling of empty state without flakiness.

        This test ensures that when there's no data, the empty state is shown consistently.
        """
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()

            # Wait for empty state to be stable
            empty_state_selector = '[data-test-id="grid-editable"] [data-test-id="empty-state"]'

            # Use stable wait instead of immediate assertion
            self.wait_for_ui_element_stable(empty_state_selector, timeout=10)

            # Verify empty state is displayed
            empty_state = self.browser.find_element_by_css_selector(empty_state_selector)
            assert empty_state.is_displayed(), "Empty state should be visible when no data"

            # Verify no data rows are present
            data_rows = self.browser.find_elements_by_css_selector('[data-test-id="grid-editable"] tbody tr')
            assert len(data_rows) == 0, "Should not have data rows in empty state"

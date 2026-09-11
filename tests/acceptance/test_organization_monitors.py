from datetime import UTC, datetime, timedelta
from unittest import mock

from django.utils import timezone
from selenium.webdriver.common.keys import Keys

from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    ScheduleType,
)
from sentry.monitors.utils import ensure_cron_detector
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationMonitorsTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.path = f"/organizations/{self.organization.slug}/monitors/crons/"
        self.team = self.create_team(organization=self.organization, name="Mariachi Band")

        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        # Create a second project so the org has multiple projects; this prevents
        # the page filter from auto-selecting the single project and rendering a
        # platform icon that overlaps the form's project input field in Selenium.
        self.create_project(organization=self.organization, teams=[self.team], name="Bengal 2")
        self.create_team_membership(self.team, user=self.user)
        self.login_as(self.user)

    def test_empty_crons_page(self) -> None:
        self.browser.get(self.path)
        self.browser.wait_until(xpath="//h3[text()='Monitor Your Cron Jobs']")

    def test_quick_start_flow(self) -> None:
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # The platform buttons link to the settings step with that platform's
        # auto-instrumentation guide preselected.
        self.browser.click_when_visible("a[aria-label='Create php Monitor']")

        # Auto-instrumentation creates the monitor on first check-in, so the
        # guide is shown in place of the monitor form.
        self.browser.wait_until(xpath="//*[text()='Select Instrumentation Method']")
        self.browser.wait_until(xpath="//*[contains(text(), 'Auto-Instrument with')]")

        # Falling back to manual setup reveals the form and lets us create one.
        self.browser.click_when_visible(xpath="//*[text()='Manually Create a Monitor']")

        self.browser.click_when_visible('[data-test-id="editable-text-label"]')
        name_input = self.browser.element(xpath='//input[@aria-label="Monitor Name"]')
        name_input.send_keys("My Monitor", Keys.ENTER)

        schedule_input = self.browser.find_element_by_name("scheduleCrontab")
        schedule_input.clear()
        schedule_input.send_keys("10 0 * * *")

        self.browser.click_when_visible(xpath="//button[normalize-space()='Create Monitor']")

        self.browser.wait_until_not('[data-test-id="loading-indicator"]', timeout=10)
        self.browser.wait_until(xpath="//*[contains(text(), 'My Monitor')]")

    def test_create_cron_monitor(self) -> None:
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # Click "Create Monitor". The cron detector type is preselected via the
        # link's detectorType query param.
        self.browser.click_when_visible(xpath="//a[normalize-space()='Create Monitor']")

        # Detector type selection (step 1 of 2). Crons is preselected via the
        # redirect's detectorType query param, so continue to the settings step.
        self.browser.click_when_visible(xpath="//button[normalize-space()='Next']")

        # Set the monitor name (editable-text field in the header).
        self.browser.click_when_visible('[data-test-id="editable-text-label"]')
        name_input = self.browser.element(xpath='//input[@aria-label="Monitor Name"]')
        name_input.send_keys("My Monitor", Keys.ENTER)

        schedule_input = self.browser.find_element_by_name("scheduleCrontab")
        schedule_input.clear()
        schedule_input.send_keys("10 0 * * *")

        self.browser.click_when_visible(xpath="//button[normalize-space()='Create Monitor']")

        # Should navigate to the monitor details page
        self.browser.wait_until_not('[data-test-id="loading-indicator"]', timeout=10)
        self.browser.wait_until(xpath="//*[contains(text(), 'My Monitor')]")
        self.browser.element_exists(xpath="//*[text()='At 12:10 AM']")

    def test_list_monitors(self) -> None:
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="My Monitor",
            config={
                "schedule": "0 0 * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

        ensure_cron_detector(monitor)

        with mock.patch(
            "django.utils.timezone.now",
            return_value=(datetime.now(tz=UTC)),
        ):
            ts = timezone.now() - timedelta(days=1)

        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            last_checkin=ts,
        )
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
            date_added=ts,
        )

        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until(xpath="//a//*[text()='My Monitor']")
        self.browser.wait_until('[data-test-id="monitor-checkin-tick"]')

    def test_edit_monitor(self) -> None:
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="My Monitor",
            config={
                "schedule": "0 0 * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        ensure_cron_detector(monitor)

        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.click_when_visible(xpath="//a//*[text()='My Monitor']")
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        self.browser.click_when_visible(xpath="//a[normalize-space()='Edit']")
        self.browser.wait_until('[name="scheduleCrontab"]')

        self.browser.click_when_visible('[data-test-id="editable-text-label"]')
        name_input = self.browser.element(xpath='//input[@aria-label="Monitor Name"]')
        name_input.clear()
        name_input.send_keys("My Edited Monitor", Keys.ENTER)

        schedule_input = self.browser.find_element_by_name("scheduleCrontab")
        schedule_input.clear()
        schedule_input.send_keys("5 0 * * *")

        self.browser.click_when_visible(xpath="//button[normalize-space()='Save']")

        self.browser.wait_until_not('[data-test-id="loading-indicator"]', timeout=10)
        self.browser.wait_until(xpath="//*[contains(text(), 'My Edited Monitor')]")

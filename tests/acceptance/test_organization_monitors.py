from datetime import UTC, datetime, timedelta
from unittest import mock

from django.utils import timezone

from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationMontorsTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.path = f"/organizations/{self.organization.slug}/crons/"
        self.team = self.create_team(organization=self.organization, name="Mariachi Band")

        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        self.create_team_membership(self.team, user=self.user)
        self.login_as(self.user)

    def test_empty_crons_page(self):
        self.browser.get(self.path)
        self.browser.wait_until(xpath="//h3[text()='Monitor Your Cron Jobs']")

    def test_quick_start_flow(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.click_when_visible("[aria-label='Create php Monitor']")
        self.browser.click_when_visible(xpath="//li[@role='tab']//*[text()='Manual']")

        self.browser.wait_until('[name="name"]')
        name_input = self.browser.find_element_by_name("name")
        name_input.send_keys("My Monitor")

        schedule_input = self.browser.find_element_by_name("config.schedule")
        schedule_input.clear()
        schedule_input.send_keys("10 0 * * *")

        self.browser.click_when_visible('button[aria-label="Create"]')
        self.browser.wait_until(xpath="//h1[text()='My Monitor']")

    def test_create_cron_monitor(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.click_when_visible("a[aria-label='Add Monitor']")

        self.browser.wait_until('[name="name"]')
        name_input = self.browser.find_element_by_name("name")
        name_input.send_keys("My Monitor")

        schedule_input = self.browser.find_element_by_name("config.schedule")
        schedule_input.clear()
        schedule_input.send_keys("10 0 * * *")

        margin = self.browser.find_element_by_name("config.checkinMargin")
        margin.send_keys("5")

        max_runtime = self.browser.find_element_by_name("config.maxRuntime")
        max_runtime.send_keys("10")

        self.browser.click_when_visible('button[aria-label="Create"]')
        self.browser.wait_until(xpath="//h1[text()='My Monitor']")
        self.browser.element_exists(xpath="//*[text()='At 12:10 AM']")
        self.browser.element_exists(xpath="//*[text()='Check-ins missed after 5 mins']")
        self.browser.element_exists(xpath="//*[text()='Check-ins longer than 10 mins or errors']")

    def test_list_monitors(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Monitor",
            config={
                "schedule": "0 0 * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

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

    def test_edit_monitor(self):
        Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Monitor",
            config={
                "schedule": "0 0 * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.click_when_visible(xpath="//a//*[text()='My Monitor']")
        self.browser.click_when_visible('a[aria-label="Edit Monitor"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        name_input = self.browser.find_element_by_name("name")
        name_input.clear()
        name_input.send_keys("My Edited Monitor")

        slug_input = self.browser.find_element_by_name("slug")
        slug_input.clear()
        slug_input.send_keys("my-monitor-edited-slug")

        schedule_input = self.browser.find_element_by_name("config.schedule")
        schedule_input.clear()
        schedule_input.send_keys("5 0 * * *")

        self.browser.click_when_visible('button[aria-label="Save Changes"]')

        self.browser.wait_until(xpath="//h1[text()='My Edited Monitor']")
        assert self.browser.element_exists(xpath="//*[text()='At 12:05 AM']")
        assert "my-monitor-edited-slug" in self.browser.current_url

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import patch

from sentry.monitors.models import Monitor, MonitorStatus, MonitorType, ScheduleType
from sentry.testutils import MonitorTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ListOrganizationMonitorsTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitors"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def check_valid_response(self, response, expected_monitors):
        assert [monitor.slug for monitor in expected_monitors] == [
            monitor_resp["slug"] for monitor_resp in response.data
        ]

    def check_valid_environments_response(self, response, monitor, expected_environments):
        assert {
            monitor_environment.environment.name for monitor_environment in expected_environments
        } == {
            monitor_environment_resp["name"]
            for monitor_environment_resp in monitor.get("environments", [])
        }

    def test_simple(self):
        monitor = self._create_monitor()
        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [monitor])

    def test_sort(self):
        last_checkin = datetime.now() - timedelta(minutes=1)
        last_checkin_older = datetime.now() - timedelta(minutes=5)

        def add_status_monitor(status_key: str, date: datetime | None = None):
            return self._create_monitor(
                status=getattr(MonitorStatus, status_key),
                last_checkin=date or last_checkin,
                name=status_key,
            )

        # Subsort next checkin time
        monitor_active = add_status_monitor("ACTIVE")
        monitor_ok = add_status_monitor("OK")
        monitor_disabled = add_status_monitor("DISABLED")
        monitor_error_older_checkin = add_status_monitor("ERROR", last_checkin_older)
        monitor_error = add_status_monitor("ERROR")
        monitor_missed_checkin = add_status_monitor("MISSED_CHECKIN")

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(
            response,
            [
                monitor_error,
                monitor_error_older_checkin,
                monitor_missed_checkin,
                monitor_ok,
                monitor_active,
                monitor_disabled,
            ],
        )

    def test_all_monitor_environments(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor, name="test")

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [monitor])
        for monitor in response.data:
            self.check_valid_environments_response(response, monitor, [monitor_environment])

    def test_monitor_environment(self):
        monitor = self._create_monitor()
        self._create_monitor_environment(monitor)

        monitor_hidden = self._create_monitor(name="hidden")
        self._create_monitor_environment(monitor_hidden, name="hidden")

        response = self.get_success_response(self.organization.slug, environment="production")
        self.check_valid_response(response, [monitor])

    def test_monitor_environment_include_new(self):
        monitor = self._create_monitor(
            status=MonitorStatus.OK, last_checkin=datetime.now() - timedelta(minutes=1)
        )
        self._create_monitor_environment(monitor)

        monitor_visible = self._create_monitor(name="visible")

        response = self.get_success_response(
            self.organization.slug, environment="production", includeNew=True
        )
        self.check_valid_response(response, [monitor, monitor_visible])


@region_silo_test(stable=True)
class CreateOrganizationMonitorTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitors"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @patch("sentry.analytics.record")
    def test_simple(self, mock_record):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        response = self.get_success_response(self.organization.slug, **data)

        monitor = Monitor.objects.get(slug=response.data["slug"])
        assert monitor.organization_id == self.organization.id
        assert monitor.project_id == self.project.id
        assert monitor.name == "My Monitor"
        assert monitor.status == MonitorStatus.ACTIVE
        assert monitor.type == MonitorType.CRON_JOB
        assert monitor.config == {
            "schedule_type": ScheduleType.CRONTAB,
            "schedule": "0 0 * * *",
            "checkin_margin": None,
            "max_runtime": None,
        }

        self.project.refresh_from_db()
        assert self.project.flags.has_cron_monitors

        mock_record.assert_called_with(
            "first_cron_monitor.created",
            user_id=self.user.id,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

    def test_slug(self):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "slug": "my-monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        response = self.get_success_response(self.organization.slug, **data)

        assert response.data["slug"] == "my-monitor"

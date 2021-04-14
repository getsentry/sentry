from sentry.models import Monitor, MonitorStatus, MonitorType, ScheduleType
from sentry.testutils import APITestCase


class OrganizationMonitorsTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-monitors"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


class ListOrganizationMonitorsTest(OrganizationMonitorsTestBase):
    def check_valid_response(self, response, expected_monitors):
        assert [str(monitor.guid) for monitor in expected_monitors] == [
            str(monitor_resp["id"]) for monitor_resp in response.data
        ]

    def test_simple(self):
        monitor = Monitor.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            name="My Monitor",
        )
        with self.feature({"organizations:monitors": True}):
            response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [monitor])


class CreateOrganizationMonitorTest(OrganizationMonitorsTestBase):
    method = "post"

    def test_simple(self):
        with self.feature({"organizations:monitors": True}):
            data = {
                "project": self.project.slug,
                "name": "My Monitor",
                "type": "cron_job",
                "config": {"schedule_type": "crontab", "schedule": "@daily"},
            }
            response = self.get_success_response(self.organization.slug, **data)

        assert response.data["id"]

        monitor = Monitor.objects.get(guid=response.data["id"])
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

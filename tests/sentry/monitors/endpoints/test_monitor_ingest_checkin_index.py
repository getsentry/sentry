from unittest import mock
from unittest.mock import patch
from uuid import UUID

from django.conf import settings
from django.test.utils import override_settings
from django.urls import reverse
from django.utils.http import urlquote
from freezegun import freeze_time

from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.testutils import MonitorIngestTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
@freeze_time()
class CreateMonitorCheckInTest(MonitorIngestTestCase):
    endpoint = "sentry-api-0-monitor-ingest-check-in-index"
    endpoint_with_org = "sentry-api-0-organization-monitor-check-in-index"

    def test_checkin_using_slug(self):
        monitor = self._create_monitor(slug="my-monitor")

        path = reverse(self.endpoint_with_org, args=[self.organization.slug, monitor.slug])
        resp = self.client.post(path, {"status": "ok"}, **self.token_auth_headers)

        assert resp.status_code == 201, resp.content

    def test_checkin_slug_orgless(self):
        monitor = self._create_monitor(slug="my-monitor")

        path = reverse(self.endpoint, args=[monitor.slug])
        resp = self.client.post(path, {"status": "ok"}, **self.token_auth_headers)

        # Slug based check-ins only work when using the organization routes.
        assert resp.status_code == 404, resp.content

    def test_headers_on_creation(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor.guid)

            resp = self.client.post(path, {"status": "ok"}, **self.token_auth_headers)
            assert resp.status_code == 201, resp.content

            # XXX(dcramer): pretty gross assertion but due to the pathing theres no easier way
            assert (
                resp["Link"]
                == f'<http://testserver{urlquote(path)}checkins/latest/>; rel="latest">'
            )
            assert resp["Location"] == f'http://testserver{path}checkins/{resp.data["id"]}/'

    @patch("sentry.analytics.record")
    def test_passing(self, mock_record):
        tested_monitors = []

        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            tested_monitors.append(monitor)

            path = path_func(monitor.guid)

            resp = self.client.post(path, {"status": "ok"}, **self.token_auth_headers)
            assert resp.status_code == 201, resp.content

            checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
            assert checkin.status == CheckInStatus.OK

            monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
            assert monitor_environment.status == MonitorStatus.OK
            assert monitor_environment.last_checkin == checkin.date_added
            assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
                checkin.date_added
            )

        self.project.refresh_from_db()
        assert self.project.flags.has_cron_checkins

        mock_record.assert_called_with(
            "first_cron_checkin.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            user_id=self.user.id,
            monitor_id=str(tested_monitors[0].guid),
        )

    def test_failing(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor.guid)

            resp = self.client.post(path, {"status": "error"}, **self.token_auth_headers)
            assert resp.status_code == 201, resp.content

            checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
            assert checkin.status == CheckInStatus.ERROR

            monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
            assert monitor_environment.status == MonitorStatus.ERROR
            assert monitor_environment.last_checkin == checkin.date_added
            assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
                checkin.date_added
            )

    def test_disabled(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor(status=ObjectStatus.DISABLED)
            path = path_func(monitor.guid)

            resp = self.client.post(path, {"status": "error"}, **self.token_auth_headers)
            assert resp.status_code == 201, resp.content

            checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
            assert checkin.status == CheckInStatus.ERROR

            monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)

            # The created monitor environment is active, but the parent monitor
            # is disabled
            assert monitor_environment.status == MonitorStatus.ACTIVE
            assert monitor_environment.last_checkin == checkin.date_added
            assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
                checkin.date_added
            )

    def test_pending_deletion(self):
        monitor = self._create_monitor(status=ObjectStatus.PENDING_DELETION)

        for path_func in self._get_path_functions():
            path = path_func(monitor.guid)

            resp = self.client.post(path, {"status": "error"}, **self.token_auth_headers)
            assert resp.status_code == 404

    def test_invalid_duration(self):
        monitor = self._create_monitor(slug="my-monitor")

        path = reverse(self.endpoint_with_org, args=[self.organization.slug, monitor.slug])
        resp = self.client.post(path, {"status": "ok", "duration": -1}, **self.token_auth_headers)

        assert resp.status_code == 400, resp.content
        assert resp.data["duration"][0] == "Ensure this value is greater than or equal to 0."

        resp = self.client.post(
            path,
            {"status": "ok", "duration": BoundedPositiveIntegerField.MAX_VALUE + 1},
            **self.token_auth_headers,
        )

        assert resp.status_code == 400, resp.content
        assert (
            resp.data["duration"][0]
            == f"Ensure this value is less than or equal to {BoundedPositiveIntegerField.MAX_VALUE}."
        )

    def test_deletion_in_progress(self):
        monitor = self._create_monitor(status=ObjectStatus.DELETION_IN_PROGRESS)

        for path_func in self._get_path_functions():
            path = path_func(monitor.guid)

            resp = self.client.post(path, {"status": "error"}, **self.token_auth_headers)
            assert resp.status_code == 404

    def test_monitor_creation_and_update_via_checkin(self):
        for i, path_func in enumerate(self._get_path_functions()):
            slug = f"my-new-monitor-{i}"
            path = path_func(slug)

            resp = self.client.post(
                path,
                {
                    "status": "ok",
                    "monitor_config": {
                        "schedule_type": "crontab",
                        "schedule": "5 * * * *",
                        "checkin_margin": 5,
                    },
                },
                **self.dsn_auth_headers,
            )
            assert resp.status_code == 201, resp.content
            monitor = Monitor.objects.get(slug=slug)
            assert monitor.config["schedule"] == "5 * * * *"
            assert monitor.config["checkin_margin"] == 5

            checkins = MonitorCheckIn.objects.filter(monitor=monitor)
            assert len(checkins) == 1

            resp = self.client.post(
                path,
                {
                    "status": "ok",
                    "monitor_config": {"schedule_type": "crontab", "schedule": "10 * * * *"},
                },
                **self.dsn_auth_headers,
            )
            assert resp.status_code == 201, resp.content

            monitor = Monitor.objects.get(guid=monitor.guid)
            assert monitor.config["schedule"] == "10 * * * *"
            # The monitor config is merged, so checkin_margin is not overwritten
            assert monitor.config["checkin_margin"] == 5

            checkins = MonitorCheckIn.objects.filter(monitor=monitor)
            assert len(checkins) == 2

    def test_monitor_creation_invalid_slug(self):
        for i, path_func in enumerate(self._get_path_functions()):
            slug = f"@my-new-monitor-{i}"
            path = path_func(slug)

            resp = self.client.post(
                path,
                {
                    "status": "ok",
                    "monitor_config": {"schedule_type": "crontab", "schedule": "5 * * * *"},
                },
                **self.dsn_auth_headers,
            )
            assert resp.status_code == 400, resp.content
            assert (
                resp.data["slug"][0]
                == "Invalid monitor slug. Must match the pattern [a-zA-Z0-9_-]+"
            )

    @override_settings(MAX_MONITORS_PER_ORG=2)
    def test_monitor_creation_over_limit(self):
        for i, path_func in enumerate(self._get_path_functions()):
            for m in range(settings.MAX_MONITORS_PER_ORG):
                slug = f"my-new-monitor-{i}-{m}"
                path = path_func(slug)

                resp = self.client.post(
                    path,
                    {
                        "status": "ok",
                        "monitor_config": {"schedule_type": "crontab", "schedule": "5 * * * *"},
                    },
                    **self.dsn_auth_headers,
                )
                assert resp.status_code == 201

            slug = f"my-new-monitor-{i}-{settings.MAX_MONITORS_PER_ORG}"
            path = path_func(slug)

            resp = self.client.post(
                path,
                {
                    "status": "ok",
                    "monitor_config": {"schedule_type": "crontab", "schedule": "5 * * * *"},
                },
                **self.dsn_auth_headers,
            )
            assert resp.status_code == 403
            assert "MonitorLimitsExceeded" in resp.data.keys()

            Monitor.objects.filter(organization_id=self.organization.id).delete()

    @override_settings(MAX_ENVIRONMENTS_PER_MONITOR=2)
    def test_monitor_environment_creation_over_limit(self):
        for i, path_func in enumerate(self._get_path_functions()):
            slug = f"my-new-monitor-{i}"
            path = path_func(slug)

            for m in range(settings.MAX_ENVIRONMENTS_PER_MONITOR):
                resp = self.client.post(
                    path,
                    {
                        "status": "ok",
                        "monitor_config": {"schedule_type": "crontab", "schedule": "5 * * * *"},
                        "environment": f"environment-{m}",
                    },
                    **self.dsn_auth_headers,
                )
                assert resp.status_code == 201

            resp = self.client.post(
                path,
                {
                    "status": "ok",
                    "monitor_config": {"schedule_type": "crontab", "schedule": "5 * * * *"},
                    "environment": f"environment-{settings.MAX_ENVIRONMENTS_PER_MONITOR}",
                },
                **self.dsn_auth_headers,
            )
            assert resp.status_code == 403
            assert "MonitorEnvironmentLimitsExceeded" in resp.data.keys()

    def test_with_dsn_auth_and_guid(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor.guid)

            resp = self.client.post(
                path,
                {"status": "ok"},
                **self.dsn_auth_headers,
            )
            assert resp.status_code == 201, resp.content

            # DSN auth should only return id
            assert list(resp.data.keys()) == ["id"]
            assert UUID(resp.data["id"])

    def test_with_dsn_auth_and_slug(self):
        monitor = self._create_monitor(slug="my-test-monitor")

        for path_func in self._get_path_functions():
            path = path_func(monitor.slug)

            resp = self.client.post(
                path,
                {"status": "ok"},
                **self.dsn_auth_headers,
            )
            assert resp.status_code == 201, resp.content

            # DSN auth should only return id
            assert list(resp.data.keys()) == ["id"]
            assert UUID(resp.data["id"])

    def test_with_dsn_auth_invalid_project(self):
        project2 = self.create_project()

        monitor = Monitor.objects.create(
            organization_id=project2.organization_id,
            project_id=project2.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        for path_func in self._get_path_functions():
            path = path_func(monitor.guid)

            resp = self.client.post(
                path,
                {"status": "ok"},
                **self.dsn_auth_headers,
            )

            assert resp.status_code == 404, resp.content

    def test_with_token_auth_invalid_org(self):
        org2 = self.create_organization()
        project2 = self.create_project(organization=org2)
        monitor = Monitor.objects.create(
            organization_id=org2.id,
            project_id=project2.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        path = reverse(self.endpoint, args=[monitor.slug])
        resp = self.client.post(path, **self.token_auth_headers)

        assert resp.status_code == 404

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        path = reverse(self.endpoint_with_org, args=["asdf", monitor.slug])

        resp = self.client.post(path, **self.token_auth_headers)

        assert resp.status_code == 404

    def test_with_dsn_and_missing_monitor_without_create(self):
        path = reverse(self.endpoint, args=["my-missing-monitor"])
        resp = self.client.post(path, {"status": "ok"}, **self.dsn_auth_headers)

        assert resp.status_code == 404

    def test_rate_limit(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()

            path = path_func(monitor.guid)

            with mock.patch(
                "sentry.monitors.endpoints.monitor_ingest_checkin_index.CHECKIN_QUOTA_LIMIT", 1
            ):
                resp = self.client.post(path, {"status": "ok"}, **self.token_auth_headers)
                assert resp.status_code == 201, resp.content
                resp = self.client.post(path, {"status": "ok"}, **self.token_auth_headers)
                assert resp.status_code == 429, resp.content

                # Keyed on environment
                resp = self.client.post(
                    path, {"status": "ok", "environment": "dev"}, **self.token_auth_headers
                )
                assert resp.status_code == 201, resp.content
                resp = self.client.post(
                    path, {"status": "ok", "environment": "dev"}, **self.token_auth_headers
                )
                assert resp.status_code == 429, resp.content

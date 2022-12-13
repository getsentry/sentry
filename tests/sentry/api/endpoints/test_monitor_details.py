from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from sentry.models import Monitor, MonitorStatus, MonitorType, ScheduledDeletion, ScheduleType
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorDetailsTest(APITestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, members=[self.user])
        self.project = self.create_project(teams=[self.team])

        self.monitor = Monitor.objects.create(
            organization_id=self.org.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        self.paths = (
            f"/api/0/monitors/{self.monitor.guid}/",
            f"/api/0/monitors/{self.org.slug}/{self.monitor.guid}/",
        )

    def test_simple(self):
        self.login_as(user=self.user)

        with self.feature({"organizations:monitors": True}):
            for path in self.paths:
                resp = self.client.get(path)

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(self.monitor.guid)

    def test_mismatched_org_slugs(self):
        path = f"/api/0/monitors/asdf/{self.monitor.guid}/"
        self.login_as(user=self.user)

        with self.feature({"organizations:monitors": True}):
            resp = self.client.get(path)

            assert resp.status_code == 400


@region_silo_test(stable=True)
class UpdateMonitorTest(APITestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, members=[self.user])
        self.project = self.create_project(teams=[self.team])
        self.num_paths = 2

        self.login_as(user=self.user)

    def _get_urls(self):
        return ("sentry-api-0-monitor-details", "sentry-api-0-monitor-details-with-org")

    def _get_path(self, i, monitor):
        urls = self._get_urls()
        if i:
            return reverse(urls[i], args=[self.org.slug, monitor.guid])
        return reverse(urls[i], args=[monitor.guid])

    def _create_monitor(self):
        return Monitor.objects.create(
            organization_id=self.org.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

    def test_name(self):
        monitor = self._create_monitor()

        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                path = self._get_path(i, monitor)
                resp = self.client.put(path, data={"name": f"Monitor Name {i}"})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.name == f"Monitor Name {i}"

    def test_can_disable(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"status": "disabled"})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.status == MonitorStatus.DISABLED

    def test_can_enable(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                monitor.update(status=MonitorStatus.DISABLED)
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"status": "active"})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.status == MonitorStatus.ACTIVE

    def test_cannot_enable_if_enabled(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                monitor.update(status=MonitorStatus.OK)
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"status": "active"})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.status == MonitorStatus.OK

    def test_checkin_margin(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"config": {"checkin_margin": 30}})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.config["checkin_margin"] == 30

    def test_max_runtime(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"config": {"max_runtime": 30}})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.config["max_runtime"] == 30

    def test_invalid_config_param(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"config": {"invalid": True}})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert "invalid" not in monitor.config

    def test_cronjob_crontab(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"config": {"schedule": "*/5 * * * *"}})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.config["schedule_type"] == ScheduleType.CRONTAB
                assert monitor.config["schedule"] == "*/5 * * * *"

    # TODO(dcramer): would be lovely to run the full spectrum, but it requires
    # this test to not be class-based
    # @pytest.mark.parametrize('input,expected', (
    #     ['@yearly', '0 0 1 1 *'],
    #     ['@annually', '0 0 1 1 *'],
    #     ['@monthly', '0 0 1 * *'],
    #     ['@weekly', '0 0 * * 0'],
    #     ['@daily', '0 0 * * *'],
    #     ['@hourly', '0 * * * *'],
    # ))
    def test_cronjob_nonstandard(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"config": {"schedule": "@monthly"}})

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.config["schedule_type"] == ScheduleType.CRONTAB
                assert monitor.config["schedule"] == "0 0 1 * *"

    def test_cronjob_crontab_invalid(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(path, data={"config": {"schedule": "*/0.5 * * * *"}})

                assert resp.status_code == 400, resp.content

                resp = self.client.put(path, data={"config": {"schedule": "* * * *"}})

                assert resp.status_code == 400, resp.content

    def test_cronjob_interval(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(
                    path, data={"config": {"schedule_type": "interval", "schedule": [1, "month"]}}
                )

                assert resp.status_code == 200, resp.content
                assert resp.data["id"] == str(monitor.guid)

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.config["schedule_type"] == ScheduleType.INTERVAL
                assert monitor.config["schedule"] == [1, "month"]

    def test_cronjob_interval_invalid_inteval(self):
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.put(
                    path, data={"config": {"schedule_type": "interval", "schedule": [1, "decade"]}}
                )

                assert resp.status_code == 400, resp.content

                resp = self.client.put(
                    path,
                    data={"config": {"schedule_type": "interval", "schedule": ["foo", "month"]}},
                )

                assert resp.status_code == 400, resp.content

                resp = self.client.put(
                    path, data={"config": {"schedule_type": "interval", "schedule": "bar"}}
                )

                assert resp.status_code == 400, resp.content

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        path = f"/api/0/monitors/asdf/{monitor.guid}/"
        self.login_as(user=self.user)

        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(
                path, data={"config": {"schedule_type": "interval", "schedule": [1, "month"]}}
            )

            assert resp.status_code == 400


@region_silo_test()
class DeleteMonitorTest(APITestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, members=[self.user])
        self.project = self.create_project(teams=[self.team])
        self.num_paths = 2

    def _create_monitor(self):
        return Monitor.objects.create(
            organization_id=self.org.id,
            project_id=self.project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

    def _get_urls(self):
        return ("sentry-api-0-monitor-details", "sentry-api-0-monitor-details-with-org")

    def _get_path(self, i, monitor):
        urls = self._get_urls()
        if i:
            return reverse(urls[i], args=[self.org.slug, monitor.guid])
        return reverse(urls[i], args=[monitor.guid])

    def test_simple(self):
        self.login_as(user=self.user)
        with self.feature({"organizations:monitors": True}):
            for i in range(self.num_paths):
                monitor = self._create_monitor()
                path = self._get_path(i, monitor)

                resp = self.client.delete(path)

                assert resp.status_code == 202, resp.content

                monitor = Monitor.objects.get(id=monitor.id)
                assert monitor.status == MonitorStatus.PENDING_DELETION
                # ScheduledDeletion only available in control silo
                assert ScheduledDeletion.objects.filter(
                    object_id=monitor.id, model_name="Monitor"
                ).exists()

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        path = f"/api/0/monitors/asdf/{monitor.guid}/"
        self.login_as(user=self.user)

        with self.feature({"organizations:monitors": True}):
            resp = self.client.delete(path)

            assert resp.status_code == 400

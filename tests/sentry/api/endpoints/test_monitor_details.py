from __future__ import absolute_import, print_function

import six

from datetime import timedelta
from django.utils import timezone

from sentry.models import Monitor, MonitorStatus, MonitorType, ScheduleType
from sentry.testutils import APITestCase


class MonitorDetailsTest(APITestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        self.login_as(user=user)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.get("/api/0/monitors/{}/".format(monitor.guid))

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(monitor.guid)


class UpdateMonitorTest(APITestCase):
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
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        self.path = "/api/0/monitors/{}/".format(self.monitor.guid)

        self.login_as(user=self.user)

    def test_name(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"name": "Monitor Name"})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert monitor.name == "Monitor Name"

    def test_can_disable(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"status": "disabled"})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert monitor.status == MonitorStatus.DISABLED

    def test_can_enable(self):
        self.monitor.update(status=MonitorStatus.DISABLED)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"status": "active"})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert monitor.status == MonitorStatus.ACTIVE

    def test_cannot_enable_if_enabled(self):
        self.monitor.update(status=MonitorStatus.OK)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"status": "active"})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert monitor.status == MonitorStatus.OK

    def test_checkin_margin(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"config": {"checkin_margin": 30}})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert monitor.config["checkin_margin"] == 30

    def test_max_runtime(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"config": {"max_runtime": 30}})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert monitor.config["max_runtime"] == 30

    def test_invalid_config_param(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"config": {"invalid": True}})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert "invalid" not in monitor.config

    def test_cronjob_crontab(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"config": {"schedule": "*/5 * * * *"}})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
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
            resp = self.client.put(self.path, data={"config": {"schedule": "@monthly"}})

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert monitor.config["schedule_type"] == ScheduleType.CRONTAB
        assert monitor.config["schedule"] == "0 0 1 * *"

    def test_cronjob_crontab_invalid(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(self.path, data={"config": {"schedule": "*/0.5 * * * *"}})

            assert resp.status_code == 400, resp.content

            resp = self.client.put(self.path, data={"config": {"schedule": "* * * *"}})

            assert resp.status_code == 400, resp.content

    def test_cronjob_interval(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(
                self.path, data={"config": {"schedule_type": "interval", "schedule": [1, "month"]}}
            )

        assert resp.status_code == 200, resp.content
        assert resp.data["id"] == six.text_type(self.monitor.guid)

        monitor = Monitor.objects.get(id=self.monitor.id)
        assert monitor.config["schedule_type"] == ScheduleType.INTERVAL
        assert monitor.config["schedule"] == [1, "month"]

    def test_cronjob_interval_invalid_inteval(self):
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(
                self.path, data={"config": {"schedule_type": "interval", "schedule": [1, "decade"]}}
            )

            assert resp.status_code == 400, resp.content

            resp = self.client.put(
                self.path,
                data={"config": {"schedule_type": "interval", "schedule": ["foo", "month"]}},
            )

            assert resp.status_code == 400, resp.content

            resp = self.client.put(
                self.path, data={"config": {"schedule_type": "interval", "schedule": "bar"}}
            )

            assert resp.status_code == 400, resp.content


class DeleteMonitorTest(APITestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        self.login_as(user=user)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.delete("/api/0/monitors/{}/".format(monitor.guid))

        assert resp.status_code == 202, resp.content

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.PENDING_DELETION

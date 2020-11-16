from __future__ import absolute_import, print_function

import pytest
from datetime import timedelta
from django.utils import timezone
from freezegun import freeze_time

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.testutils import APITestCase


@freeze_time("2019-01-01")
class CreateMonitorCheckInTest(APITestCase):
    def test_passing(self):
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
            resp = self.client.post(
                "/api/0/monitors/{}/checkins/".format(monitor.guid), data={"status": "ok"}
            )

        assert resp.status_code == 201, resp.content

        checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.OK
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

    def test_failing(self):
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
            resp = self.client.post(
                "/api/0/monitors/{}/checkins/".format(monitor.guid), data={"status": "error"}
            )

        assert resp.status_code == 201, resp.content

        checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
        assert checkin.status == CheckInStatus.ERROR

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.ERROR
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

    def test_disabled(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            status=MonitorStatus.DISABLED,
            config={"schedule": "* * * * *"},
        )

        self.login_as(user=user)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.post(
                "/api/0/monitors/{}/checkins/".format(monitor.guid), data={"status": "error"}
            )

        assert resp.status_code == 201, resp.content

        checkin = MonitorCheckIn.objects.get(guid=resp.data["id"])
        assert checkin.status == CheckInStatus.ERROR

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.DISABLED
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

    def test_pending_deletion(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            status=MonitorStatus.PENDING_DELETION,
            config={"schedule": "* * * * *"},
        )

        self.login_as(user=user)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.post(
                "/api/0/monitors/{}/checkins/".format(monitor.guid), data={"status": "error"}
            )

        assert resp.status_code == 404, resp.content

    def test_deletion_in_progress(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            status=MonitorStatus.DELETION_IN_PROGRESS,
            config={"schedule": "* * * * *"},
        )

        self.login_as(user=user)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.post(
                "/api/0/monitors/{}/checkins/".format(monitor.guid), data={"status": "error"}
            )

        assert resp.status_code == 404, resp.content

    def test_with_dsn_auth(self):
        project = self.create_project()
        project_key = self.create_project_key(project=project)

        monitor = Monitor.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        with self.feature({"organizations:monitors": True}):
            resp = self.client.post(
                "/api/0/monitors/{}/checkins/".format(monitor.guid),
                HTTP_AUTHORIZATION=u"DSN {}".format(project_key.dsn_public),
                data={"status": "ok"},
            )

        assert resp.status_code == 201, resp.content
        # DSN auth shouldn't return any data
        assert not resp.data

    @pytest.mark.xfail(
        reason="There's a bug in sentry/api/bases/monitor that needs fixed, until then, this returns 500"
    )
    def test_with_dsn_auth_invalid_project(self):
        project = self.create_project()
        project2 = self.create_project()
        project_key = self.create_project_key(project=project)

        monitor = Monitor.objects.create(
            organization_id=project2.organization_id,
            project_id=project2.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )

        with self.feature({"organizations:monitors": True}):
            resp = self.client.post(
                "/api/0/monitors/{}/checkins/".format(monitor.guid),
                HTTP_AUTHORIZATION=u"DSN {}".format(project_key.dsn_public),
                data={"status": "ok"},
            )

        assert resp.status_code == 400, resp.content

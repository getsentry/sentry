from __future__ import absolute_import, print_function

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

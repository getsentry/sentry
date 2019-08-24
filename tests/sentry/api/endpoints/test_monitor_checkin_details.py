from __future__ import absolute_import, print_function

from datetime import timedelta
from django.utils import timezone

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.testutils import APITestCase


class UpdateMonitorCheckInTest(APITestCase):
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
            date_added=timezone.now() - timedelta(minutes=1),
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor, project_id=project.id, date_added=monitor.date_added
        )

        self.login_as(user=user)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(
                "/api/0/monitors/{}/checkins/{}/".format(monitor.guid, checkin.guid),
                data={"status": "ok"},
            )

        assert resp.status_code == 200, resp.content

        checkin = MonitorCheckIn.objects.get(id=checkin.id)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.next_checkin > checkin.date_added
        assert monitor.status == MonitorStatus.OK
        assert monitor.last_checkin > checkin.date_added

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
            date_added=timezone.now() - timedelta(minutes=1),
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor, project_id=project.id, date_added=monitor.date_added
        )

        self.login_as(user=user)
        with self.feature({"organizations:monitors": True}):
            resp = self.client.put(
                "/api/0/monitors/{}/checkins/{}/".format(monitor.guid, checkin.guid),
                data={"status": "error"},
            )

        assert resp.status_code == 200, resp.content

        checkin = MonitorCheckIn.objects.get(id=checkin.id)
        assert checkin.status == CheckInStatus.ERROR

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.next_checkin > checkin.date_added
        assert monitor.status == MonitorStatus.ERROR
        assert monitor.last_checkin > checkin.date_added

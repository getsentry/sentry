import uuid
from datetime import timedelta
from unittest.mock import call, patch

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.grouping.utils import hash_from_values
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.monitors.tasks.detect_broken_monitor_envs import detect_broken_monitor_envs
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature


class MonitorDetectBrokenMonitorEnvTaskTest(TestCase):
    def create_monitor_env(self, monitor, environment_id):
        return MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=environment_id,
            status=MonitorStatus.OK,
        )

    def create_monitor_and_env(
        self, name="test monitor", organization_id=None, project_id=None, environment_id=None
    ):
        if organization_id is None:
            organization_id = self.organization.id
        if project_id is None:
            project_id = self.project.id
        if environment_id is None:
            environment_id = self.environment.id

        monitor = Monitor.objects.create(
            name=name,
            organization_id=organization_id,
            project_id=project_id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "day"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": 1,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        return (monitor, self.create_monitor_env(monitor=monitor, environment_id=environment_id))

    def create_incident_for_monitor_env(self, monitor, monitor_environment):
        first_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            date_added=timezone.now() - timedelta(days=14),
        )
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=first_checkin,
            starting_timestamp=first_checkin.date_added,
            grouphash=hash_from_values([uuid.uuid4()]),
        )
        for i in range(3, -1, -1):
            MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.ERROR,
                date_added=timezone.now() - timedelta(days=i),
            )
        return incident

    @with_feature("organizations:crons-broken-monitor-detection")
    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_creates_broken_detection_no_duplicates(self, mock_now, builder):
        now = before_now()
        mock_now.return_value = now
        monitor, monitor_environment = self.create_monitor_and_env()
        incident = self.create_incident_for_monitor_env(monitor, monitor_environment)

        detect_broken_monitor_envs()
        broken_detections = MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)
        assert len(broken_detections) == 1
        assert broken_detections.first().user_notified_timestamp == now
        assert builder.call_count == 1

        # running the task again shouldn't create duplicates or send additional emails
        detect_broken_monitor_envs()
        assert len(MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)) == 1
        assert builder.call_count == 1

    @with_feature("organizations:crons-broken-monitor-detection")
    def test_does_not_create_broken_detection_insufficient_duration(self):
        monitor, monitor_environment = self.create_monitor_and_env()

        first_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            date_added=timezone.now() - timedelta(days=10),
        )
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=first_checkin,
            starting_timestamp=first_checkin.date_added,
            grouphash=hash_from_values([uuid.uuid4()]),
        )

        for i in range(4):
            MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.ERROR,
                date_added=timezone.now() - timedelta(days=1),
            )

        detect_broken_monitor_envs()
        assert len(MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)) == 0

    @with_feature("organizations:crons-broken-monitor-detection")
    def test_does_not_create_broken_detection_insufficient_checkins(self):
        monitor, monitor_environment = self.create_monitor_and_env()

        first_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            date_added=timezone.now() - timedelta(days=14),
        )
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=first_checkin,
            starting_timestamp=first_checkin.date_added,
            grouphash=hash_from_values([uuid.uuid4()]),
        )

        for i in range(1, -1, -1):
            MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.ERROR,
                date_added=timezone.now() - timedelta(days=i),
            )

        detect_broken_monitor_envs()
        assert len(MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)) == 0

    def test_does_not_create_broken_detection_no_feature(self):
        monitor, monitor_environment = self.create_monitor_and_env()
        incident = self.create_incident_for_monitor_env(monitor, monitor_environment)

        detect_broken_monitor_envs()
        assert len(MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)) == 0

    @with_feature("organizations:crons-broken-monitor-detection")
    def test_does_not_create_for_disabled_monitor(self):
        monitor, monitor_environment = self.create_monitor_and_env()
        monitor.status = ObjectStatus.DISABLED
        monitor.save()

        incident = self.create_incident_for_monitor_env(monitor, monitor_environment)

        detect_broken_monitor_envs()
        assert len(MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)) == 0

    @with_feature("organizations:crons-broken-monitor-detection")
    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_sends_emails_to_all_users_across_orgs(self, mock_now, builder):
        now = before_now()
        mock_now.return_value = now
        monitor, monitor_environment = self.create_monitor_and_env()

        second_user = self.create_user("second_user@example.com")
        second_org = self.create_organization(owner=second_user)
        self.create_member(user=self.user, organization=second_org)
        second_team = self.create_team(organization=second_org, members=[second_user, self.user])
        second_project = self.create_project(organization=second_org, teams=[second_team])
        second_env = self.create_environment(second_project, name="production")

        second_monitor, second_monitor_environment = self.create_monitor_and_env(
            name="second monitor",
            organization_id=second_org.id,
            project_id=second_project.id,
            environment_id=second_env.id,
        )

        self.create_incident_for_monitor_env(monitor, monitor_environment)
        self.create_incident_for_monitor_env(second_monitor, second_monitor_environment)

        detect_broken_monitor_envs()
        broken_detections = MonitorEnvBrokenDetection.objects.all()
        assert len(broken_detections) == 2
        assert broken_detections[0].user_notified_timestamp == now
        assert broken_detections[1].user_notified_timestamp == now
        # should build 3 emails, 2 for self.user from the 2 orgs, and 1 for second_user
        expected_contexts = [
            {
                "broken_monitors": [
                    (
                        monitor.slug,
                        f"http://testserver/organizations/{self.organization.slug}/crons/{self.project.slug}/{monitor.slug}/?environment={self.environment.name}",
                        timezone.now() - timedelta(days=14),
                    )
                ],
                "view_monitors_link": f"http://testserver/organizations/{self.organization.slug}/crons/",
            },
            {
                "broken_monitors": [
                    (
                        second_monitor.slug,
                        f"http://testserver/organizations/{second_org.slug}/crons/{second_project.slug}/{second_monitor.slug}/?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    )
                ],
                "view_monitors_link": f"http://testserver/organizations/{second_org.slug}/crons/",
            },
            {
                "broken_monitors": [
                    (
                        second_monitor.slug,
                        f"http://testserver/organizations/{second_org.slug}/crons/{second_project.slug}/{second_monitor.slug}/?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    )
                ],
                "view_monitors_link": f"http://testserver/organizations/{second_org.slug}/crons/",
            },
        ]

        builder.assert_has_calls(
            [
                call(
                    **{
                        "subject": "Your monitors are broken!",
                        "template": "sentry/emails/crons/broken-monitors.txt",
                        "html_template": "sentry/emails/crons/broken-monitors.html",
                        "type": "crons.broken_monitors",
                        "context": context,
                    }
                )
                for context in expected_contexts[:1]
            ],
            any_order=True,
        )

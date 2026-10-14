import uuid
from datetime import timedelta
from unittest.mock import MagicMock, Mock, call, patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.grouping.utils import hash_from_values
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    ScheduleType,
)
from sentry.monitors.tasks.detect_broken_monitor_envs import detect_broken_monitor_envs
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.workflow_engine.models import DataSourceDetector


class MonitorDetectBrokenMonitorEnvTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.detector_ids: dict[str, int] = {}
        self._run_tasks = self.tasks()
        self._run_tasks.__enter__()

    def tearDown(self) -> None:
        super().tearDown()
        self._run_tasks.__exit__(None, None, None)

    def create_monitor_env(self, monitor, environment_id):
        return MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=environment_id,
            status=MonitorStatus.OK,
        )

    def generate_cron_monitor_url(self, org_slug: str, project_slug: str, monitor_slug: str) -> str:
        return (
            f"http://testserver/organizations/{org_slug}/monitors/"
            f"{self.detector_ids[monitor_slug]}/"
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
            config={
                "schedule": [1, "day"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": 1,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        data_source = self.create_data_source(
            organization=Organization.objects.get(id=monitor.organization_id),
            source_id=str(monitor.id),
            type=DATA_SOURCE_CRON_MONITOR,
        )
        detector = self.create_detector(
            project=Project.objects.get(id=monitor.project_id),
            type=MonitorIncidentType.slug,
        )
        self.create_data_source_detector(data_source=data_source, detector=detector)
        self.detector_ids[monitor.slug] = detector.id
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

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_creates_broken_detection_no_duplicates(
        self, mock_now: MagicMock, builder: MagicMock
    ) -> None:
        now = before_now()
        mock_now.return_value = now
        monitor, monitor_environment = self.create_monitor_and_env()
        incident = self.create_incident_for_monitor_env(monitor, monitor_environment)

        detect_broken_monitor_envs()
        broken_detection = MonitorEnvBrokenDetection.objects.get(monitor_incident=incident)
        assert broken_detection.user_notified_timestamp == now
        assert builder.call_count == 1

        # running the task again shouldn't create duplicates or send additional emails
        detect_broken_monitor_envs()
        assert len(MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)) == 1
        assert builder.call_count == 1

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    def test_preserves_environment_query_parameters(self, builder: MagicMock) -> None:
        first_environment = self.create_environment(self.project, name="production & staging")
        second_environment = self.create_environment(self.project, name="canary/us")
        monitor, first_monitor_environment = self.create_monitor_and_env(
            environment_id=first_environment.id
        )
        second_monitor_environment = self.create_monitor_env(monitor, second_environment.id)
        self.create_incident_for_monitor_env(monitor, first_monitor_environment)
        self.create_incident_for_monitor_env(monitor, second_monitor_environment)

        detect_broken_monitor_envs()

        monitor_url = builder.call_args.kwargs["context"]["broken_monitors"][0][2]
        assert monitor_url == (
            f"http://testserver/organizations/{self.organization.slug}/monitors/"
            f"{self.detector_ids[monitor.slug]}/"
            "?environment=production+%26+staging&environment=canary%2Fus"
        )

    @with_feature("system:multi-region")
    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    def test_uses_customer_domain_urls(self, builder: MagicMock) -> None:
        monitor, monitor_environment = self.create_monitor_and_env()
        self.create_incident_for_monitor_env(monitor, monitor_environment)

        detect_broken_monitor_envs()

        context = builder.call_args.kwargs["context"]
        assert context["broken_monitors"][0][2] == (
            f"http://{self.organization.slug}.testserver/monitors/"
            f"{self.detector_ids[monitor.slug]}/?environment={self.environment.name}"
        )
        assert context["view_monitors_link"] == (
            f"http://{self.organization.slug}.testserver/monitors/crons/"
        )

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    def test_missing_detector_falls_back_to_monitor_list(self, builder: MagicMock) -> None:
        monitor, monitor_environment = self.create_monitor_and_env()
        DataSourceDetector.objects.filter(detector_id=self.detector_ids[monitor.slug]).delete()
        self.create_incident_for_monitor_env(monitor, monitor_environment)

        detect_broken_monitor_envs()

        monitor_url = builder.call_args.kwargs["context"]["broken_monitors"][0][2]
        assert monitor_url == (
            f"http://testserver/organizations/{self.organization.slug}/monitors/crons/"
        )

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    def test_queries_detectors_once_for_multiple_monitors(self, builder: MagicMock) -> None:
        first_monitor, first_monitor_environment = self.create_monitor_and_env()
        second_monitor, second_monitor_environment = self.create_monitor_and_env(name="second")
        self.create_incident_for_monitor_env(first_monitor, first_monitor_environment)
        self.create_incident_for_monitor_env(second_monitor, second_monitor_environment)

        with CaptureQueriesContext(connection) as queries:
            detect_broken_monitor_envs()

        detector_queries = [
            query
            for query in queries.captured_queries
            if "workflow_engine_datasourcedetector" in query["sql"]
        ]
        assert len(detector_queries) == 1
        assert len(builder.call_args.kwargs["context"]["broken_monitors"]) == 2

    def test_does_not_create_broken_detection_insufficient_duration(self) -> None:
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

        for _ in range(4):
            MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.ERROR,
                date_added=timezone.now() - timedelta(days=1),
            )

        detect_broken_monitor_envs()
        assert len(MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)) == 0

    def test_does_not_create_broken_detection_insufficient_checkins(self) -> None:
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

    def test_does_not_create_for_disabled_monitor(self) -> None:
        monitor, monitor_environment = self.create_monitor_and_env()
        monitor.status = ObjectStatus.DISABLED
        monitor.save()

        incident = self.create_incident_for_monitor_env(monitor, monitor_environment)

        detect_broken_monitor_envs()
        assert len(MonitorEnvBrokenDetection.objects.filter(monitor_incident=incident)) == 0

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_sends_emails_to_all_users_across_orgs(
        self, mock_now: MagicMock, builder: MagicMock
    ) -> None:
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
        third_monitor, third_monitor_environment = self.create_monitor_and_env(
            name="third monitor",
            organization_id=second_org.id,
            project_id=second_project.id,
            environment_id=second_env.id,
        )

        self.create_incident_for_monitor_env(monitor, monitor_environment)
        self.create_incident_for_monitor_env(second_monitor, second_monitor_environment)
        self.create_incident_for_monitor_env(third_monitor, third_monitor_environment)

        detect_broken_monitor_envs()
        broken_detections = MonitorEnvBrokenDetection.objects.all()
        assert len(broken_detections) == 3
        assert broken_detections[0].user_notified_timestamp == now
        assert broken_detections[1].user_notified_timestamp == now
        assert broken_detections[2].user_notified_timestamp == now
        # should build 3 emails, 2 for self.user from the 2 orgs, and 1 for second_user
        expected_contexts = [
            {
                "broken_monitors": [
                    (
                        monitor.slug,
                        self.project.slug,
                        f"{self.generate_cron_monitor_url(self.organization.slug, self.project.slug, monitor.slug)}?environment={self.environment.name}",
                        timezone.now() - timedelta(days=14),
                    )
                ],
                "view_monitors_link": f"http://testserver/organizations/{self.organization.slug}/monitors/crons/",
            },
            {
                "broken_monitors": [
                    (
                        second_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, second_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    ),
                    (
                        third_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, third_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    ),
                ],
                "view_monitors_link": f"http://testserver/organizations/{second_org.slug}/monitors/crons/",
            },
            {
                "broken_monitors": [
                    (
                        second_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, second_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    ),
                    (
                        third_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, third_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    ),
                ],
                "view_monitors_link": f"http://testserver/organizations/{second_org.slug}/monitors/crons/",
            },
        ]
        expected_subjects = [
            "1 of your Cron Monitors isn't working",
            "2 of your Cron Monitors aren't working",
            "2 of your Cron Monitors aren't working",
        ]

        builder.assert_has_calls(
            [
                call(
                    **{
                        "subject": subject,
                        "template": "sentry/emails/crons/broken-monitors.txt",
                        "html_template": "sentry/emails/crons/broken-monitors.html",
                        "type": "crons.broken_monitors",
                        "context": context,
                    }
                )
                for subject, context in zip(expected_subjects, expected_contexts)
            ],
            any_order=True,
        )

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_disables_environments_and_sends_email(
        self, mock_now: MagicMock, builder: MagicMock
    ) -> None:
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
        third_monitor, third_monitor_environment = self.create_monitor_and_env(
            name="third monitor",
            organization_id=second_org.id,
            project_id=second_project.id,
            environment_id=second_env.id,
        )

        incident = self.create_incident_for_monitor_env(monitor, monitor_environment)
        second_incident = self.create_incident_for_monitor_env(
            second_monitor, second_monitor_environment
        )
        third_incident = self.create_incident_for_monitor_env(
            third_monitor, third_monitor_environment
        )

        broken_detection = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident,
            detection_timestamp=now - timedelta(days=14),
            user_notified_timestamp=now - timedelta(days=14),
        )
        second_broken_detection = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=second_incident,
            detection_timestamp=now - timedelta(days=14),
            user_notified_timestamp=now - timedelta(days=14),
        )
        third_broken_detection = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=third_incident,
            detection_timestamp=now - timedelta(days=14),
            user_notified_timestamp=now - timedelta(days=14),
        )

        detect_broken_monitor_envs()

        # should have the two monitor environments as muted
        monitor_environment.refresh_from_db()
        second_monitor_environment.refresh_from_db()
        third_monitor_environment.refresh_from_db()
        assert monitor_environment.is_muted
        assert second_monitor_environment.is_muted
        assert third_monitor_environment.is_muted

        broken_detection.refresh_from_db()
        second_broken_detection.refresh_from_db()
        third_broken_detection.refresh_from_db()

        assert broken_detection.env_muted_timestamp == now
        assert second_broken_detection.env_muted_timestamp == now
        assert third_broken_detection.env_muted_timestamp == now

        # should build 3 emails, 2 for self.user from the 2 orgs, and 1 for second_user
        expected_contexts = [
            {
                "muted_monitors": [
                    (
                        monitor.slug,
                        self.project.slug,
                        f"{self.generate_cron_monitor_url(self.organization.slug, self.project.slug, monitor.slug)}?environment={self.environment.name}",
                        timezone.now() - timedelta(days=14),
                    )
                ],
                "view_monitors_link": f"http://testserver/organizations/{self.organization.slug}/monitors/crons/",
            },
            {
                "muted_monitors": [
                    (
                        second_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, second_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    ),
                    (
                        third_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, third_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    ),
                ],
                "view_monitors_link": f"http://testserver/organizations/{second_org.slug}/monitors/crons/",
            },
            {
                "muted_monitors": [
                    (
                        second_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, second_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    ),
                    (
                        third_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, third_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    ),
                ],
                "view_monitors_link": f"http://testserver/organizations/{second_org.slug}/monitors/crons/",
            },
        ]
        expected_subjects = [
            "1 of your Cron Monitors has been muted",
            "2 of your Cron Monitors have been muted",
            "2 of your Cron Monitors have been muted",
        ]

        builder.assert_has_calls(
            [
                call(
                    **{
                        "subject": subject,
                        "template": "sentry/emails/crons/muted-monitors.txt",
                        "html_template": "sentry/emails/crons/muted-monitors.html",
                        "type": "crons.muted_monitors",
                        "context": context,
                    }
                )
                for subject, context in zip(expected_subjects, expected_contexts)
            ],
            any_order=True,
        )

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_disables_corrects_environments_and_sends_email(
        self, mock_now: MagicMock, builder: MagicMock
    ) -> None:
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

        incident = self.create_incident_for_monitor_env(monitor, monitor_environment)
        second_incident = self.create_incident_for_monitor_env(
            second_monitor, second_monitor_environment
        )

        # This broken detection shouldn't be automatically disabled, because it's not long enough
        broken_detection = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident,
            detection_timestamp=now - timedelta(days=0),
            user_notified_timestamp=now - timedelta(days=0),
        )
        second_broken_detection = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=second_incident,
            detection_timestamp=now - timedelta(days=14),
            user_notified_timestamp=now - timedelta(days=14),
        )

        detect_broken_monitor_envs()

        # should have the one monitor environment as muted
        monitor_environment.refresh_from_db()
        second_monitor_environment.refresh_from_db()
        assert not monitor_environment.is_muted
        assert second_monitor_environment.is_muted

        broken_detection.refresh_from_db()
        second_broken_detection.refresh_from_db()
        assert broken_detection.env_muted_timestamp is None
        assert second_broken_detection.env_muted_timestamp == now

        # should build 3 emails, 2 for self.user from the 2 orgs, and 1 for second_user
        expected_contexts = [
            {
                "muted_monitors": [
                    (
                        second_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, second_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    )
                ],
                "view_monitors_link": f"http://testserver/organizations/{second_org.slug}/monitors/crons/",
            },
            {
                "muted_monitors": [
                    (
                        second_monitor.slug,
                        second_project.slug,
                        f"{self.generate_cron_monitor_url(second_org.slug, second_project.slug, second_monitor.slug)}?environment={second_env.name}",
                        timezone.now() - timedelta(days=14),
                    )
                ],
                "view_monitors_link": f"http://testserver/organizations/{second_org.slug}/monitors/crons/",
            },
        ]

        builder.assert_has_calls(
            [
                call(
                    **{
                        "subject": "1 of your Cron Monitors has been muted",
                        "template": "sentry/emails/crons/muted-monitors.txt",
                        "html_template": "sentry/emails/crons/muted-monitors.html",
                        "type": "crons.muted_monitors",
                        "context": context,
                    }
                )
                for context in expected_contexts
            ],
            any_order=True,
        )

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_sends_emails_to_owners_user_id(self, mock_now: MagicMock, builder: MagicMock) -> None:
        now = before_now()
        mock_now.return_value = now
        builder.return_value.send_async = Mock()
        monitor, monitor_environment = self.create_monitor_and_env()
        new_owner = self.create_user("newowner@example.com")
        self.create_member(
            user=new_owner,
            organization=self.organization,
        )
        monitor.update(owner_user_id=new_owner.id)

        self.create_incident_for_monitor_env(monitor, monitor_environment)
        detect_broken_monitor_envs()

        builder.return_value.send_async.assert_called_with(["newowner@example.com"])

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_sends_emails_to_owners_team_id(self, mock_now: MagicMock, builder: MagicMock) -> None:
        now = before_now()
        mock_now.return_value = now
        builder.return_value.send_async = Mock()
        monitor, monitor_environment = self.create_monitor_and_env()
        team_member1 = self.create_user("teammember1@example.com")
        team_member2 = self.create_user("teammember2@example.com")
        team_member3 = self.create_user("teammember3@example.com")

        # Respects alternate email sending
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserEmail.objects.create(
                user=team_member3, email="newemail3@example.com", is_verified=True
            )
            UserOption.objects.create(
                user=team_member3,
                key="mail:email",
                project_id=self.project.id,
                value="newemail3@example.com",
            )

            # Test that it won't send to this unverified email
            UserEmail.objects.create(
                user=team_member2, email="unverified2@example.com", is_verified=False
            )
            UserOption.objects.create(
                user=team_member2,
                key="mail:email",
                project_id=self.project.id,
                value="unverified2@example.com",
            )

        self.create_member(user=team_member1, organization=self.organization)
        self.create_member(user=team_member2, organization=self.organization)
        self.create_member(user=team_member3, organization=self.organization)
        team = self.create_team(members=[team_member1, team_member2, team_member3])
        monitor.update(owner_team_id=team.id)

        self.create_incident_for_monitor_env(monitor, monitor_environment)
        detect_broken_monitor_envs()

        builder.return_value.send_async.assert_has_calls(
            [
                call(["newemail3@example.com"]),
                call(["teammember1@example.com"]),
            ]
        )

    @patch("sentry.monitors.tasks.detect_broken_monitor_envs.MessageBuilder")
    @patch("django.utils.timezone.now")
    def test_does_not_send_emails_to_users_with_disabled_nudges(
        self, mock_now: MagicMock, builder: MagicMock
    ) -> None:
        now = before_now()
        mock_now.return_value = now
        builder.return_value.send_async = Mock()
        monitor, monitor_environment = self.create_monitor_and_env()
        second_monitor, second_monitor_environment = self.create_monitor_and_env(
            name="second monitor",
        )
        disabled_owner = self.create_user("disabled_owner@example.com")
        self.create_member(
            user=disabled_owner,
            organization=self.organization,
        )
        enabled_owner = self.create_user("enabled_owner@example.com")
        self.create_member(
            user=enabled_owner,
            organization=self.organization,
        )

        # Disable Nudges for this disabled_owner
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                type="brokenMonitors",
                scope_type="user",
                scope_identifier=disabled_owner.id,
                user_id=disabled_owner.id,
                value="never",
            )

        monitor.update(owner_user_id=disabled_owner.id)
        second_monitor.update(owner_user_id=enabled_owner.id)

        self.create_incident_for_monitor_env(monitor, monitor_environment)
        self.create_incident_for_monitor_env(second_monitor, second_monitor_environment)
        detect_broken_monitor_envs()

        builder.return_value.send_async.assert_called_with(["enabled_owner@example.com"])

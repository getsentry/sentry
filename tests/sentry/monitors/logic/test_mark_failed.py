import uuid
from unittest.mock import patch

from django.utils import timezone

from sentry.grouping.utils import hash_from_values
from sentry.issues.grouptype import (
    MonitorCheckInFailure,
    MonitorCheckInMissed,
    MonitorCheckInTimeout,
)
from sentry.monitors.constants import SUBTITLE_DATETIME_FORMAT
from sentry.monitors.logic.mark_failed import MonitorFailure, mark_failed
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorEnvironmentTestCase(TestCase):
    @with_feature({"organizations:issue-platform": False})
    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_default_params_legacy(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        assert mark_failed(monitor_environment)

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "environment": monitor_environment.environment.name,
                "platform": "other",
                "contexts": {
                    "monitor": {
                        "status": "error",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"]},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "logentry": {"formatted": "Monitor failure: test monitor (unknown)"},
                "fingerprint": ["monitor", str(monitor.guid), "unknown"],
                "logger": "",
                "type": "default",
            },
        ) == dict(event)

    @with_feature({"organizations:issue-platform": False})
    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_with_reason_legacy(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        assert mark_failed(monitor_environment, reason=MonitorFailure.DURATION)

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "environment": monitor_environment.environment.name,
                "platform": "other",
                "contexts": {
                    "monitor": {
                        "status": "timeout",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"]},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "logentry": {"formatted": "Monitor failure: test monitor (duration)"},
                "fingerprint": ["monitor", str(monitor.guid), "duration"],
                "logger": "",
                "type": "default",
            },
        ) == dict(event)

    @with_feature({"organizations:issue-platform": False})
    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_with_missed_reason_legacy(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        assert mark_failed(monitor_environment, reason=MonitorFailure.MISSED_CHECKIN)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.MISSED_CHECKIN

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "environment": monitor_environment.environment.name,
                "platform": "other",
                "contexts": {
                    "monitor": {
                        "status": "missed_checkin",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"]},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "logentry": {"formatted": "Monitor failure: test monitor (missed_checkin)"},
                "fingerprint": ["monitor", str(monitor.guid), "missed_checkin"],
                "logger": "",
                "type": "default",
            },
        ) == dict(event)

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_default_params_issue_platform(self, mock_produce_occurrence_to_kafka):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )

        successful_check_in = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        last_checkin = timezone.now()
        trace_id = uuid.uuid4().hex
        assert mark_failed(
            monitor_environment,
            last_checkin=last_checkin,
            occurrence_context={"trace_id": trace_id},
        )

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        occurrence, event = mock_produce_occurrence_to_kafka.mock_calls[0].args
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [hash_from_values(["monitor", str(monitor.guid), "error"])],
                "issue_title": f"Monitor failure: {monitor.name}",
                "subtitle": "An error occurred during the latest check-in.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {"name": "Failure reason", "value": "error", "important": True},
                    {
                        "name": "Environment",
                        "value": monitor_environment.environment.name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": successful_check_in.date_added.isoformat(),
                        "important": False,
                    },
                ],
                "type": MonitorCheckInFailure.type_id,
                "level": "error",
                "culprit": "error",
            },
        ) == dict(occurrence)

        assert dict(
            event,
            **{
                "contexts": {
                    "monitor": {
                        "status": "error",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"]},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": ["monitor", str(monitor.guid), "error"],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": monitor.slug,
                },
                "trace_id": trace_id,
            },
        ) == dict(event)

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_with_reason_issue_platform(self, mock_produce_occurrence_to_kafka):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": 10,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        successful_check_in = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )
        last_checkin = timezone.now()
        assert mark_failed(
            monitor_environment,
            last_checkin=last_checkin,
            reason=MonitorFailure.DURATION,
            occurrence_context={"duration": monitor.config.get("max_runtime")},
        )

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        occurrence, event = mock_produce_occurrence_to_kafka.mock_calls[0].args
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [hash_from_values(["monitor", str(monitor.guid), "duration"])],
                "issue_title": f"Monitor failure: {monitor.name}",
                "subtitle": "Check-in exceeded maximum duration of 10 minutes.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {"name": "Failure reason", "value": "duration", "important": True},
                    {
                        "name": "Environment",
                        "value": monitor_environment.environment.name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": successful_check_in.date_added.isoformat(),
                        "important": False,
                    },
                ],
                "type": MonitorCheckInTimeout.type_id,
                "level": "error",
                "culprit": "duration",
            },
        ) == dict(occurrence)

        assert dict(
            event,
            **{
                "contexts": {
                    "monitor": {
                        "status": "timeout",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"], "max_runtime": 10},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": ["monitor", str(monitor.guid), "duration"],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": monitor.slug,
                },
                "trace_id": None,
            },
        ) == dict(event)

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_with_missed_reason_issue_platform(self, mock_produce_occurrence_to_kafka):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        last_checkin = timezone.now()
        expected_time = monitor.get_next_expected_checkin(last_checkin)

        assert mark_failed(
            monitor_environment,
            last_checkin=last_checkin,
            reason=MonitorFailure.MISSED_CHECKIN,
            occurrence_context={"expected_time": expected_time.strftime(SUBTITLE_DATETIME_FORMAT)},
        )

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.MISSED_CHECKIN

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        occurrence, event = mock_produce_occurrence_to_kafka.mock_calls[0].args
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [hash_from_values(["monitor", str(monitor.guid), "missed_checkin"])],
                "issue_title": f"Monitor failure: {monitor.name}",
                "subtitle": f"No check-in reported on {expected_time.strftime(SUBTITLE_DATETIME_FORMAT)}.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {"name": "Failure reason", "value": "missed_checkin", "important": True},
                    {
                        "name": "Environment",
                        "value": monitor_environment.environment.name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": "None",
                        "important": False,
                    },
                ],
                "type": MonitorCheckInMissed.type_id,
                "level": "warning",
                "culprit": "missed_checkin",
            },
        ) == dict(occurrence)

        assert dict(
            event,
            **{
                "contexts": {
                    "monitor": {
                        "status": "missed_checkin",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"]},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": ["monitor", str(monitor.guid), "missed_checkin"],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": monitor.slug,
                },
                "trace_id": None,
            },
        ) == dict(event)

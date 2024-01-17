import uuid
from datetime import timedelta
from itertools import cycle
from unittest.mock import patch

from django.utils import timezone

from sentry.issues.grouptype import (
    MonitorCheckInFailure,
    MonitorCheckInMissed,
    MonitorCheckInTimeout,
)
from sentry.monitors.constants import SUBTITLE_DATETIME_FORMAT
from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class MarkFailedTestCase(TestCase):
    @with_feature({"organizations:issue-platform": False})
    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_default_params_legacy(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.UNKNOWN,
        )
        assert mark_failed(checkin, ts=checkin.date_added)

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
                        "config": {
                            "schedule_type": 2,
                            "schedule": [1, "month"],
                            "max_runtime": None,
                            "checkin_margin": None,
                        },
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": str(monitor.slug),
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
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.TIMEOUT,
        )
        assert mark_failed(checkin, ts=checkin.date_added)

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
                        "config": {
                            "schedule_type": 2,
                            "schedule": [1, "month"],
                            "max_runtime": None,
                            "checkin_margin": None,
                        },
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
        last_checkin = timezone.now().replace(second=0, microsecond=0)
        next_checkin = last_checkin + timedelta(hours=1)

        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "hour"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            last_checkin=last_checkin,
            next_checkin=next_checkin,
            next_checkin_latest=next_checkin + timedelta(minutes=1),
            status=monitor.status,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.MISSED,
        )
        assert mark_failed(checkin, ts=checkin.date_added)

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
                        "config": {
                            "schedule_type": 2,
                            "schedule": [1, "hour"],
                            "max_runtime": None,
                            "checkin_margin": None,
                        },
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
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
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
        trace_id = uuid.uuid4()

        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            trace_id=trace_id,
            date_added=last_checkin,
        )
        assert mark_failed(checkin, ts=checkin.date_added)

        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.ERROR

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 1

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        event = kwargs["event_data"]
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [monitor_incidents[0].grouphash],
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
                        "config": {
                            "schedule_type": 2,
                            "schedule": [1, "month"],
                            "max_runtime": None,
                            "checkin_margin": None,
                        },
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    },
                    "trace": {
                        "trace_id": trace_id.hex,
                        "span_id": None,
                    },
                },
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": [monitor_incidents[0].grouphash],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": str(monitor.slug),
                },
            },
        ) == dict(event)

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_with_timeout_reason_issue_platform(self, mock_produce_occurrence_to_kafka):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": 10,
                "checkin_margin": None,
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

        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.TIMEOUT,
            date_added=last_checkin,
            duration=monitor.config.get("max_runtime"),
        )
        assert mark_failed(failed_checkin, ts=failed_checkin.date_added)

        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.ERROR

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 1

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        event = kwargs["event_data"]
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [monitor_incidents[0].grouphash],
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
                        "status": "error",
                        "type": "cron_job",
                        "config": {
                            "schedule_type": 2,
                            "schedule": [1, "month"],
                            "max_runtime": 10,
                            "checkin_margin": None,
                        },
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": str(monitor.slug),
                    }
                },
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": [monitor_incidents[0].grouphash],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": str(monitor.slug),
                },
            },
        ) == dict(event)

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_with_missed_reason_issue_platform(self, mock_produce_occurrence_to_kafka):
        last_checkin = timezone.now().replace(second=0, microsecond=0)
        next_checkin = last_checkin + timedelta(hours=1)

        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "hour"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            last_checkin=last_checkin,
            next_checkin=next_checkin,
            next_checkin_latest=next_checkin + timedelta(minutes=1),
            status=monitor.status,
        )

        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.MISSED,
            expected_time=next_checkin,
            date_added=next_checkin + timedelta(minutes=1),
        )
        assert mark_failed(failed_checkin, ts=failed_checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.ERROR

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 1

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        event = kwargs["event_data"]
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [monitor_incidents[0].grouphash],
                "issue_title": f"Monitor failure: {monitor.name}",
                "subtitle": f"No check-in reported on {next_checkin.strftime(SUBTITLE_DATETIME_FORMAT)}.",
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
                        "status": "error",
                        "type": "cron_job",
                        "config": {
                            "schedule_type": 2,
                            "schedule": [1, "hour"],
                            "max_runtime": None,
                            "checkin_margin": None,
                        },
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": str(monitor.slug),
                    }
                },
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": [monitor_incidents[0].grouphash],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": str(monitor.slug),
                },
            },
        ) == dict(event)

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_muted(self, mock_produce_occurrence_to_kafka):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
            },
            is_muted=True,
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=MonitorStatus.OK,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.UNKNOWN,
        )
        assert mark_failed(checkin, ts=checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor.is_muted
        assert monitor_environment.status == MonitorStatus.ERROR

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 0

        # Test for when monitor environment is muted
        monitor.update(is_muted=False)
        monitor_environment.update(is_muted=True, status=MonitorStatus.OK)

        checkin_2 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.UNKNOWN,
        )
        assert mark_failed(checkin_2, ts=checkin_2.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert not monitor.is_muted
        assert monitor_environment.is_muted
        assert monitor_environment.status == MonitorStatus.ERROR

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 0

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_issue_threshold(self, mock_produce_occurrence_to_kafka):
        failure_issue_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": failure_issue_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=MonitorStatus.OK,
            last_state_change=None,
        )

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        failure_statuses = cycle([CheckInStatus.ERROR, CheckInStatus.TIMEOUT, CheckInStatus.MISSED])

        for _ in range(0, failure_issue_threshold - 1):
            status = next(failure_statuses)
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=status,
            )
            mark_failed(checkin, ts=checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        # check that timestamp has not updated
        assert monitor_environment.last_state_change is None

        # create another OK check-in to break the chain
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        first_checkin = None
        for _ in range(0, failure_issue_threshold):
            status = next(failure_statuses)
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=status,
            )
            if _ == 0:
                first_checkin = checkin
            mark_failed(checkin, ts=checkin.date_added)

        # failure has hit threshold, monitor should be in a failed state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_state_change == monitor_environment.last_checkin
        prior_last_state_change = monitor_environment.last_state_change

        # check that an incident has been created correctly
        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 1
        monitor_incident = monitor_incidents.first()
        assert monitor_incident.starting_checkin == first_checkin
        assert monitor_incident.starting_timestamp == first_checkin.date_added
        assert monitor_incident.grouphash == monitor_environment.incident_grouphash

        # assert correct number of occurrences was sent
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == failure_issue_threshold
        # assert that the correct uuid fingerprint was sent
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        occurrence = occurrence.to_dict()
        assert occurrence["fingerprint"][0] == monitor_incident.grouphash

        # send another check-in to make sure we don't update last_state_change
        status = next(failure_statuses)
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=status,
        )
        mark_failed(checkin, ts=checkin.date_added)
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_state_change == prior_last_state_change

        # check that incident has not changed
        monitor_incident = MonitorIncident.objects.get(id=monitor_incident.id)
        assert monitor_incident.grouphash == monitor_environment.incident_grouphash

        # assert correct number of occurrences was sent
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == failure_issue_threshold + 1
        # assert that the correct uuid fingerprint was sent
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        occurrence = occurrence.to_dict()
        assert occurrence["fingerprint"][0] == monitor_incident.grouphash

    # Test to make sure that timeout mark_failed (which occur in the past)
    # correctly create issues once passing the failure_issue_threshold
    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_issue_threshold_timeout(self, mock_produce_occurrence_to_kafka):
        failure_issue_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": failure_issue_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=MonitorStatus.OK,
            last_state_change=None,
        )

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        # create in-progress check-ins
        first_checkin = None
        checkins = []
        for i in range(0, failure_issue_threshold + 1):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.IN_PROGRESS,
            )
            checkins.append(checkin)
            if i == 0:
                first_checkin = checkin

        # mark check-ins as failed
        for _ in range(0, failure_issue_threshold - 1):
            checkin = checkins.pop(0)
            checkin.update(status=CheckInStatus.TIMEOUT)
            mark_failed(checkin, ts=checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        # check that timestamp has not updated
        assert monitor_environment.last_state_change is None

        checkin = checkins.pop(0)
        checkin.update(status=CheckInStatus.TIMEOUT)
        mark_failed(checkin, ts=checkin.date_added)

        # failure has hit threshold, monitor should be in a failed state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_state_change == monitor_environment.last_checkin

        # check that an incident has been created correctly
        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 1
        monitor_incident = monitor_incidents.first()
        assert monitor_incident.starting_checkin == first_checkin
        assert monitor_incident.starting_timestamp == first_checkin.date_added
        assert monitor_incident.grouphash == monitor_environment.incident_grouphash

        # assert correct number of occurrences was sent
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == failure_issue_threshold
        # assert that the correct uuid fingerprint was sent
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        occurrence = occurrence.to_dict()
        assert occurrence["fingerprint"][0] == monitor_incident.grouphash

    # we are duplicating this test as the code paths are different, for now
    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_issue_threshold_disabled(self, mock_produce_occurrence_to_kafka):
        failure_issue_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": failure_issue_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
            is_muted=True,
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=MonitorStatus.OK,
        )
        for _ in range(0, failure_issue_threshold):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.UNKNOWN,
            )
            mark_failed(checkin, ts=checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor.is_muted
        assert monitor_environment.status == MonitorStatus.ERROR

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 0

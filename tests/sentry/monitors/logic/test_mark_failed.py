import uuid
from itertools import cycle
from unittest.mock import patch

from django.utils import timezone

from sentry.issues.grouptype import MonitorIncidentType
from sentry.issues.ingest import process_occurrence_data
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
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


class MarkFailedTestCase(TestCase):
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_default_params(self, mock_produce_occurrence_to_kafka):
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
            environment_id=self.environment.id,
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
        assert mark_failed(checkin, failed_at=checkin.date_added)

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
                "subtitle": "Your monitor has reached its failure threshold.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {
                        "name": "Failure reason",
                        "value": "An error check-in was detected",
                        "important": True,
                    },
                    {
                        "name": "Environment",
                        "value": monitor_environment.get_environment().name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": successful_check_in.date_added.isoformat(),
                        "important": False,
                    },
                ],
                "type": MonitorIncidentType.type_id,
                "level": "error",
                "culprit": "",
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
                "environment": monitor_environment.get_environment().name,
                "event_id": occurrence["event_id"],
                "fingerprint": [monitor_incidents[0].grouphash],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": str(monitor.slug),
                    "monitor.incident": str(monitor_incidents[0].id),
                },
            },
        ) == dict(event)

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
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )
        assert monitor_environment.active_incident is None
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.UNKNOWN,
        )
        assert mark_failed(checkin, failed_at=checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor.is_muted
        assert monitor_environment.status == MonitorStatus.ERROR

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0
        assert monitor_environment.active_incident is not None

    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_env_muted(self, mock_produce_occurrence_to_kafka):
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
            is_muted=False,
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            is_muted=True,
        )
        assert monitor_environment.active_incident is None

        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.UNKNOWN,
        )
        assert mark_failed(checkin, failed_at=checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert not monitor.is_muted
        assert monitor_environment.is_muted
        assert monitor_environment.status == MonitorStatus.ERROR
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0
        assert monitor_environment.active_incident is not None

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
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
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
            mark_failed(checkin, failed_at=checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK

        # create another OK check-in to break the chain
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

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
            mark_failed(checkin, failed_at=checkin.date_added)

        # failure has hit threshold, monitor should be in a failed state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR

        # check that an incident has been created correctly
        monitor_incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert monitor_incident.starting_checkin == first_checkin
        assert monitor_incident.starting_timestamp == first_checkin.date_added
        assert monitor_environment.active_incident is not None
        assert monitor_incident.grouphash == monitor_environment.active_incident.grouphash

        # assert correct number of occurrences was sent
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == failure_issue_threshold
        # assert that the correct uuid fingerprint was sent
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        occurrence = occurrence.to_dict()
        assert occurrence["fingerprint"][0] == monitor_incident.grouphash

        # Human readible failure reason
        assert (
            occurrence["evidence_display"][0]["value"]
            == "3 timeout, 3 missed and 2 error check-ins detected"
        )

        # send another check-in to make sure the incident does not change
        status = next(failure_statuses)
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=status,
        )
        mark_failed(checkin, failed_at=checkin.date_added)
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR

        # check that incident has not changed
        monitor_incident = MonitorIncident.objects.get(id=monitor_incident.id)
        assert monitor_environment.active_incident is not None
        assert monitor_incident.grouphash == monitor_environment.active_incident.grouphash

        # assert correct number of occurrences was sent
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == failure_issue_threshold + 1
        # assert that the correct uuid fingerprint was sent
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        occurrence = occurrence.to_dict()
        assert occurrence["fingerprint"][0] == monitor_incident.grouphash

        # Resolve the incident with an OK check-in
        ok_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=MonitorStatus.OK,
        )
        monitor_incident.resolving_checkin = ok_checkin
        monitor_incident.resolving_timestamp = ok_checkin.date_added
        monitor_incident.save()
        monitor_environment.status = MonitorStatus.OK
        monitor_environment.save()

        # Cause a new incident and ensure we create a new incident
        for _ in range(0, failure_issue_threshold):
            status = next(failure_statuses)
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=status,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 2

    # Test to make sure that timeout mark_failed (which occur in the past)
    # correctly create issues once passing the failure_issue_threshold
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
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        # create in-progress check-ins
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
            mark_failed(checkin, failed_at=checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK

        checkin = checkins.pop(0)
        checkin.update(status=CheckInStatus.TIMEOUT)
        mark_failed(checkin, failed_at=checkin.date_added)

        # failure has hit threshold, monitor should be in a failed state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR

        # check that an incident has been created correctly
        monitor_incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert monitor_incident.starting_checkin == first_checkin
        assert monitor_incident.starting_timestamp == first_checkin.date_added
        assert monitor_environment.active_incident is not None
        assert monitor_incident.grouphash == monitor_environment.active_incident.grouphash

        # assert correct number of occurrences was sent
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == failure_issue_threshold
        # assert that the correct uuid fingerprint was sent
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        occurrence = occurrence.to_dict()
        assert occurrence["fingerprint"][0] == monitor_incident.grouphash

        # Human readible failure reason
        assert occurrence["evidence_display"][0]["value"] == "8 timeout check-ins detected"

    # we are duplicating this test as the code paths are different, for now
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
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )
        assert monitor_environment.active_incident is None
        for _ in range(0, failure_issue_threshold):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.UNKNOWN,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor.is_muted
        assert monitor_environment.status == MonitorStatus.ERROR

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0
        assert monitor_environment.active_incident is not None

    def test_mark_failed_issue_assignment(self):
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
            owner_user_id=self.user.id,
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.IN_PROGRESS,
        )
        mark_failed(checkin, failed_at=checkin.date_added)

        # failure has hit threshold, monitor should be in a failed state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR

        # check that an incident has been created correctly
        monitor_incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert monitor_incident.starting_checkin == checkin
        assert monitor_incident.starting_timestamp == checkin.date_added
        assert monitor_environment.active_incident is not None
        assert monitor_incident.grouphash == monitor_environment.active_incident.grouphash
        occurrence_data = {"fingerprint": [monitor_environment.active_incident.grouphash]}
        process_occurrence_data(occurrence_data)
        issue_platform_hash = occurrence_data["fingerprint"][0]

        grouphash = GroupHash.objects.get(hash=issue_platform_hash)
        group_assignee = GroupAssignee.objects.get(group_id=grouphash.group_id)
        assert group_assignee.user_id == monitor.owner_user_id

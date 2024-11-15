import uuid
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.issues.grouptype import MonitorIncidentType
from sentry.monitors.logic.incident_occurrence import get_failure_reason, send_incident_occurrence
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


class IncidentOccurrenceTestCase(TestCase):
    @patch("sentry.monitors.logic.incident_occurrence.produce_occurrence_to_kafka")
    def test_send_incident_occurrence(self, mock_produce_occurrence_to_kafka):
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
            status=MonitorStatus.ERROR,
        )

        successful_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        last_checkin = timezone.now()
        trace_id = uuid.uuid4()

        timeout_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.TIMEOUT,
            trace_id=uuid.uuid4(),
            date_added=last_checkin - timedelta(minutes=1),
        )
        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            trace_id=trace_id,
            date_added=last_checkin,
        )
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=failed_checkin,
            starting_timestamp=last_checkin,
            grouphash="abcd",
        )

        send_incident_occurrence(
            failed_checkin,
            [timeout_checkin, failed_checkin],
            incident,
            last_checkin,
        )

        assert mock_produce_occurrence_to_kafka.call_count == 1
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs

        occurrence = kwargs["occurrence"]
        event = kwargs["event_data"]
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [incident.grouphash],
                "issue_title": f"Monitor failure: {monitor.name}",
                "subtitle": "Your monitor has reached its failure threshold.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {
                        "name": "Failure reason",
                        "value": "1 timeout and 1 error check-ins detected",
                        "important": True,
                    },
                    {
                        "name": "Environment",
                        "value": monitor_environment.get_environment().name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": successful_checkin.date_added.isoformat(),
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
                        "config": monitor.config,
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
                "fingerprint": [incident.grouphash],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": str(monitor.slug),
                    "monitor.incident": str(incident.id),
                },
            },
        ) == dict(event)

    def test_failure_reason(self):
        monitor = self.create_monitor()
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
        )
        timeout_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.TIMEOUT,
        )
        error_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
        )
        miss_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.MISSED,
        )

        assert get_failure_reason([error_checkin]) == "An error check-in was detected"
        assert get_failure_reason([timeout_checkin]) == "A timeout check-in was detected"
        assert get_failure_reason([miss_checkin]) == "A missed check-in was detected"

        assert (
            get_failure_reason([error_checkin, miss_checkin, timeout_checkin])
            == "1 error, 1 missed and 1 timeout check-ins detected"
        )
        assert (
            get_failure_reason([miss_checkin, timeout_checkin])
            == "1 missed and 1 timeout check-ins detected"
        )

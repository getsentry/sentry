from datetime import timedelta
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MarkUnknown

from sentry.monitors.clock_tasks.mark_unknown import dispatch_mark_unknown, mark_checkin_unknown
from sentry.monitors.clock_tasks.producer import MONITORS_CLOCK_TASKS_CODEC
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


class MonitorClockTasksMarkUnknownTest(TestCase):
    @mock.patch("sentry.monitors.clock_tasks.mark_unknown.produce_task")
    def test_mark_unknown(self, mock_produce_task):
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Schedule is once a day
        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "0 0 * * *",
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

        monitor_environment = MonitorEnvironment.objects.create(
            # XXX(epurkhiser): Arbitrarily large id to make sure we can
            # correctly use the monitor_environment.id as the partition key
            id=62702371781194950,
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts,
            next_checkin=ts + timedelta(hours=24),
            next_checkin_latest=ts + timedelta(hours=24, minutes=1),
            status=MonitorStatus.OK,
        )
        # Checkin will timeout in 30 minutes
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts,
            date_updated=ts,
            timeout_at=ts + timedelta(minutes=30),
        )

        dispatch_mark_unknown(ts)

        message: MarkUnknown = {
            "type": "mark_unknown",
            "ts": ts.timestamp(),
            "monitor_environment_id": checkin.monitor_environment_id,
            "checkin_id": checkin.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )

        # assert that task is called for the specific environment
        assert mock_produce_task.call_count == 1
        assert mock_produce_task.mock_calls[0] == mock.call(payload)

        mark_checkin_unknown(checkin.id, ts)

        # Checkin is marked as unknown
        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.UNKNOWN).exists()

        # Monitor status does not change
        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.OK
        ).exists()

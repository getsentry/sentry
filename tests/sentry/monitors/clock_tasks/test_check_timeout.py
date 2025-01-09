from datetime import timedelta
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MarkTimeout

from sentry.monitors.clock_tasks.check_timeout import dispatch_check_timeout, mark_checkin_timeout
from sentry.monitors.clock_tasks.producer import MONITORS_CLOCK_TASKS_CODEC
from sentry.monitors.logic.mark_failed import mark_failed
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


class MonitorClockTasksCheckTimeoutTest(TestCase):
    @mock.patch("sentry.monitors.clock_tasks.check_timeout.mark_failed", wraps=mark_failed)
    @mock.patch("sentry.monitors.clock_tasks.check_timeout.produce_task")
    def test_timeout(self, mock_produce_task, mock_mark_failed):
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
                "checkin_margin": None,
                "max_runtime": 30,
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

        # Does not time out at 12:00
        dispatch_check_timeout(ts)
        assert mock_produce_task.call_count == 0

        # Does not time out at 12:29
        dispatch_check_timeout(ts + timedelta(minutes=29))
        assert mock_produce_task.call_count == 0

        # Timout at 12:30
        dispatch_check_timeout(ts + timedelta(minutes=30))

        message: MarkTimeout = {
            "type": "mark_timeout",
            "ts": (ts + timedelta(minutes=30)).timestamp(),
            "monitor_environment_id": checkin.monitor_environment_id,
            "checkin_id": checkin.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        assert mock_produce_task.call_count == 1
        assert mock_produce_task.mock_calls[0] == mock.call(payload)

        mark_checkin_timeout(
            checkin.id,
            ts + timedelta(minutes=30),
        )

        # Check in is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.TIMEOUT).exists()

        # mark_failed called with the check-in with the status correctly updated
        assert mock_mark_failed.call_count == 1
        assert mock_mark_failed.mock_calls[0].args[0].status == CheckInStatus.TIMEOUT

        # Monitor is in an error state
        monitor_env = MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.ERROR,
        )
        assert monitor_env.exists()

        # Next check-in time has NOT changed
        assert monitor_env[0].next_checkin == ts + timedelta(hours=24)

    @mock.patch("sentry.monitors.clock_tasks.check_timeout.produce_task")
    def test_timeout_with_overlapping_concurrent_checkins(self, mock_produce_task):
        """
        Tests the scenario where the max_runtime is larger than the gap between
        the schedule.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(hour=0, second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                # Every hour, 90 minute run time allowed
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "0 * * * *",
                "checkin_margin": None,
                "max_runtime": 90,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts,
            next_checkin=ts + timedelta(hours=1),
            next_checkin_latest=ts + timedelta(hours=1, minutes=1),
            status=MonitorStatus.OK,
        )

        # In progress started an hour ago
        checkin1_start = ts - timedelta(hours=1)

        # Timesout 90 minutes from when it started
        checkin1 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=checkin1_start,
            date_updated=checkin1_start,
            timeout_at=checkin1_start + timedelta(minutes=90),
        )

        # Second check in was started now, giving us the overlapping
        # "concurrent" checkin scenario.
        checkin2 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts,
            date_updated=ts,
            timeout_at=ts + timedelta(minutes=90),
        )

        # Nothing happens running the task now. Both check-ins are running
        # concurrently.
        dispatch_check_timeout(ts)
        assert mock_produce_task.call_count == 0

        # First checkin has not timed out yet
        dispatch_check_timeout(ts + timedelta(minutes=29))
        assert mock_produce_task.call_count == 0

        # First checkin timed out
        dispatch_check_timeout(ts + timedelta(minutes=30))

        message: MarkTimeout = {
            "type": "mark_timeout",
            "ts": (ts + timedelta(minutes=30)).timestamp(),
            "monitor_environment_id": checkin1.monitor_environment_id,
            "checkin_id": checkin1.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        assert mock_produce_task.call_count == 1
        assert mock_produce_task.mock_calls[0] == mock.call(payload)

        mark_checkin_timeout(
            checkin1.id,
            ts + timedelta(minutes=30),
        )

        # First checkin is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin1.id, status=CheckInStatus.TIMEOUT).exists()

        # Second checkin is not marked as timed out
        assert MonitorCheckIn.objects.filter(
            id=checkin2.id, status=CheckInStatus.IN_PROGRESS
        ).exists()

        # XXX(epurkhiser): We do NOT update the MonitorStatus, another check-in
        # has already happened. It may be worth re-visiting this logic later.
        monitor_env = MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.OK,
        )
        assert monitor_env.exists()

        # Next check-in time has NOT changed
        assert monitor_env[0].next_checkin == ts + timedelta(hours=1)

    @mock.patch("sentry.monitors.clock_tasks.check_timeout.produce_task")
    def test_timeout_at_next_checkin_time(self, mock_produce_task):
        """
        Test that timeouts that happen the same time we expect another check-in
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(hour=1, minute=0, second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                # Every hour, 90 minute run time allowed
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "0 * * * *",
                "checkin_margin": None,
                "max_runtime": 60,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(hours=1),
            next_checkin=ts,
            next_checkin_latest=ts + timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        # In progress started an hour ago
        checkin_start_time = ts - timedelta(hours=1)
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=checkin_start_time,
            date_updated=checkin_start_time,
            timeout_at=checkin_start_time + timedelta(hours=1),
        )

        # Check in was marked as timed out
        dispatch_check_timeout(ts)

        message: MarkTimeout = {
            "type": "mark_timeout",
            "ts": ts.timestamp(),
            "monitor_environment_id": checkin.monitor_environment_id,
            "checkin_id": checkin.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        assert mock_produce_task.call_count == 1
        assert mock_produce_task.mock_calls[0] == mock.call(payload)
        mark_checkin_timeout(checkin.id, ts)

        # First checkin is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.TIMEOUT).exists()

        # Monitor is in an error state
        monitor_env = MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.ERROR
        )
        assert monitor_env.exists()

        # Next check-in time has NOT changed, it will be happening now
        assert monitor_env[0].next_checkin == ts

    @mock.patch("sentry.monitors.clock_tasks.check_timeout.produce_task")
    def test_timeout_using_interval(self, mock_produce_task):
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Schedule is once a day
        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.INTERVAL,
                "schedule": [10, "minute"],
                "checkin_margin": None,
                "max_runtime": 5,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts,
            next_checkin=ts + timedelta(minutes=10),
            next_checkin_latest=ts + timedelta(minutes=11),
            status=MonitorStatus.OK,
        )
        # Checkin will timeout in 5 minutes
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts,
            date_updated=ts,
            timeout_at=ts + timedelta(minutes=5),
        )

        # Timout at 12:05
        dispatch_check_timeout(ts + timedelta(minutes=5))

        message: MarkTimeout = {
            "type": "mark_timeout",
            "ts": (ts + timedelta(minutes=5)).timestamp(),
            "monitor_environment_id": checkin.monitor_environment_id,
            "checkin_id": checkin.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        assert mock_produce_task.call_count == 1
        assert mock_produce_task.mock_calls[0] == mock.call(payload)
        mark_checkin_timeout(
            checkin.id,
            ts + timedelta(minutes=5),
        )

        # Check in is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.TIMEOUT).exists()

        # Monitor is in an error state
        monitor_env = MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.ERROR,
        )
        assert monitor_env.exists()

        # XXX(epurkhiser): Next check-in timeout is STILL 10 minutes from when
        # we started our check-in. This is likely WRONG for the user, since we
        # do't know when their system computed the next check-in.
        assert monitor_env[0].next_checkin == ts + timedelta(minutes=10)

    @mock.patch("sentry.monitors.clock_tasks.check_timeout.produce_task")
    def test_timeout_with_future_complete_checkin(self, mock_produce_task):
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(second=0, microsecond=0)
        check_in_24hr_ago = ts - timedelta(hours=24)

        # Schedule is once a day
        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "0 0 * * *",
                "checkin_margin": None,
                "max_runtime": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            # Next checkin is in the future, we just completed our last checkin
            last_checkin=ts,
            next_checkin=ts + timedelta(hours=24),
            next_checkin_latest=ts + timedelta(hours=24, minutes=1),
            status=MonitorStatus.OK,
        )
        # Checkin 24hr ago
        checkin1 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=check_in_24hr_ago,
            date_updated=check_in_24hr_ago,
            timeout_at=check_in_24hr_ago + timedelta(minutes=30),
        )
        checkin2 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.OK,
            date_added=ts,
            date_updated=ts,
            timeout_at=ts + timedelta(minutes=30),
        )

        assert checkin1.date_added == checkin1.date_updated == check_in_24hr_ago

        # Running check monitor will mark the first checkin as timed out. The
        # second checkin was already marked as OK.
        dispatch_check_timeout(ts)

        # assert that task is called for the specific checkin
        message: MarkTimeout = {
            "type": "mark_timeout",
            "ts": ts.timestamp(),
            "monitor_environment_id": checkin1.monitor_environment_id,
            "checkin_id": checkin1.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        assert mock_produce_task.call_count == 1
        assert mock_produce_task.mock_calls[0] == mock.call(payload)

        mark_checkin_timeout(checkin1.id, ts)

        # The first checkin is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin1.id, status=CheckInStatus.TIMEOUT).exists()
        # The second checkin has not changed status
        assert MonitorCheckIn.objects.filter(id=checkin2.id, status=CheckInStatus.OK).exists()

        # Monitor does not change from OK to TIMED OUT since it was already OK.
        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.OK,
        ).exists()

    @mock.patch("sentry.monitors.clock_tasks.check_timeout.mark_failed")
    def test_timeout_checkin_backlog_handled(self, mock_mark_failed):
        """
        In the scenario where we have a clock-tick backlog we may produce
        multiple tasks to update a timed-out check-in.

        We want to make sure we do not call mark_failed when we marked it as
        timed_out in an earlier task.
        """
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
                "checkin_margin": None,
                "max_runtime": 30,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
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

        # Mark as timed out
        mark_checkin_timeout(checkin.id, ts + timedelta(minutes=30))
        assert mock_mark_failed.call_count == 1

        # Second call does NOT trigger a mark_failed
        mark_checkin_timeout(checkin.id, ts + timedelta(minutes=31))
        assert mock_mark_failed.call_count == 1

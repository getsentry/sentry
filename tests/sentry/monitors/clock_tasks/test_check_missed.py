from datetime import UTC, timedelta
from unittest import mock
from zoneinfo import ZoneInfo

import pytest
from arroyo.backends.kafka import KafkaPayload
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MarkMissing

from sentry.constants import ObjectStatus
from sentry.monitors.clock_tasks.check_missed import (
    dispatch_check_missing,
    mark_environment_missing,
)
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


class MonitorClockTasksCheckMissingTest(TestCase):
    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def test_missing_checkin(self, mock_produce_task):
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "* * * * *",
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

        # Expected check-in was a full minute ago.
        monitor_environment = MonitorEnvironment.objects.create(
            # XXX(epurkhiser): Arbitrarily large id to make sure we can
            # correctly use the monitor_environment.id as the partition key
            id=62702371781194950,
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=2),
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
            status=MonitorStatus.OK,
        )

        dispatch_check_missing(ts)

        message: MarkMissing = {
            "type": "mark_missing",
            "ts": ts.timestamp(),
            "monitor_environment_id": monitor_environment.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )

        # assert that task is called for the specific environment
        assert mock_produce_task.call_count == 1
        assert mock_produce_task.mock_calls[0] == mock.call(payload)

        mark_environment_missing(monitor_environment.id, ts)

        # Monitor status is updated
        monitor_environment = MonitorEnvironment.objects.get(
            id=monitor_environment.id, status=MonitorStatus.ERROR
        )

        # last_checkin was NOT updated. We only update this for real user check-ins.
        assert monitor_environment.last_checkin == ts - timedelta(minutes=2)

        # next_checkin IS updated for when we're expecting the next checkin
        assert monitor_environment.next_checkin == ts

        # Because our checkin was a minute ago we'll have produced a missed checkin
        missed_checkin = MonitorCheckIn.objects.get(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        )

        next_checkin = monitor_environment.last_checkin + timedelta(minutes=1)
        next_checkin = next_checkin.replace(second=0, microsecond=0)

        assert missed_checkin.date_added == next_checkin
        assert missed_checkin.expected_time == next_checkin
        assert missed_checkin.monitor_config == monitor.config

    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def test_missing_checkin_with_timezone(self, mock_produce_task):
        """
        Validate that monitors configured wih a timezone correctly compute the
        next_checkin and next_checkin_latest when marking monitors as missed.

        See commit ed986f16286f32c459a53cd5df65a03d9bdbe80f
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        # 1st of Febuary midnight Arizona time
        ts_tz = timezone.now().replace(
            month=2,
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
            tzinfo=ZoneInfo("US/Arizona"),
        )
        ts = ts_tz.astimezone(UTC)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "0 0 * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "timezone": "US/Arizona",
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

        # Last check-in was yesterday
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts_tz - timedelta(days=1),
            next_checkin=ts_tz,
            next_checkin_latest=ts_tz + timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        # No missed check-ins generated any hour between the last check-in and
        # the upcoming checkin. Testing like this to validate any kind of
        # strange timezone related issues.
        for hour in range(24):
            dispatch_check_missing(
                ts - timedelta(days=1) + timedelta(hours=hour + 1),
            )

        assert mock_produce_task.call_count == 0

        # Mark check in missed a minute later
        dispatch_check_missing(ts + timedelta(minutes=1))
        assert mock_produce_task.call_count == 1

        # Missed check-in correctly updates
        mark_environment_missing(monitor_environment.id, ts + timedelta(minutes=1))
        monitor_environment.refresh_from_db()

        assert MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id,
            status=CheckInStatus.MISSED,
        ).exists()

        assert monitor_environment.next_checkin == ts + timedelta(days=1)
        assert monitor_environment.next_checkin_latest == ts + timedelta(days=1, minutes=1)

    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def test_missing_checkin_with_margin(self, mock_produce_task):
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [10, "minute"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": 5,
            },
        )

        # Last check-in was 12 minutes ago.
        #
        # The expected checkin was 2 min ago, but has a 5 minute margin, so we
        # still have 3 minutes to check in.
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=12),
            next_checkin=ts - timedelta(minutes=2),
            next_checkin_latest=ts + timedelta(minutes=3),
            status=MonitorStatus.OK,
        )

        # No missed check-in generated as we're still within the check-in margin
        dispatch_check_missing(ts)

        # assert that task is not called for the specific environment
        assert mock_produce_task.call_count == 0

        assert not MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.ERROR,
        ).exists()

        assert not MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id,
            status=CheckInStatus.MISSED,
        ).exists()

        # Missed check-in generated as clock now exceeds expected time plus margin
        dispatch_check_missing(ts + timedelta(minutes=4))

        message: MarkMissing = {
            "type": "mark_missing",
            "ts": (ts + timedelta(minutes=4)).timestamp(),
            "monitor_environment_id": monitor_environment.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )

        # assert that task is called for the specific environment
        assert mock_produce_task.call_count == 1
        assert mock_produce_task.mock_calls[0] == mock.call(payload)

        mark_environment_missing(
            monitor_environment.id,
            ts + timedelta(minutes=4),
        )

        monitor_environment = MonitorEnvironment.objects.get(
            id=monitor_environment.id, status=MonitorStatus.ERROR
        )

        missed_checkin = MonitorCheckIn.objects.get(
            monitor_environment=monitor_environment.id,
            status=CheckInStatus.MISSED,
        )

        # Missed checkins are back-dated to when the checkin was expected to
        # happen. In this case the expected_time is equal to the date_added.
        assert monitor_environment.last_checkin is not None
        checkin_date = monitor_environment.last_checkin + timedelta(minutes=10)
        checkin_date = checkin_date.replace(second=0, microsecond=0)

        assert missed_checkin.date_added == checkin_date
        assert missed_checkin.expected_time == checkin_date
        assert missed_checkin.monitor_config == monitor.config

        monitor_env = MonitorEnvironment.objects.get(id=monitor_environment.id)

        # next_checkin should happen 10 minutes after the missed checkin, or 8
        # minutes after the reference ts
        assert monitor_env.next_checkin == missed_checkin.date_added + timedelta(minutes=10)
        assert monitor_env.next_checkin == ts + timedelta(minutes=8)

        # next_checkin_latest has the correct margin offset
        assert monitor_env.next_checkin_latest == monitor_env.next_checkin + timedelta(minutes=5)

    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def test_missing_checkin_with_margin_schedule_overlap(self, mock_produce_task):
        """
        Tests the case where the checkin_margin is configured to be larger than
        the gap in the schedule.

        In this scenario we will not mark missed check-ins while it's waiting
        for the checkin_margin to pass.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        # ts falls on the 5 minute schedule so our every 5 minute schedule
        # makes sense
        ts = timezone.now().replace(minute=15, second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                # Every 5 minutes
                "schedule": "*/5 * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "max_runtime": None,
                "checkin_margin": 10,
            },
        )

        # Last check-in was 5 minutes ago. Next checkin is now, latest 10
        # minutes from now. There will be 5 minutes of overlap.
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=5),
            next_checkin=ts,
            next_checkin_latest=ts + timedelta(minutes=10),
            status=MonitorStatus.OK,
        )

        # No missed check-in generated as we're still within the check-in margin
        dispatch_check_missing(ts)
        assert mock_produce_task.call_count == 0

        # Missed checkin is STILL not produced 5 minutes in, even though this
        # is when another check-in should be happening.
        dispatch_check_missing(ts + timedelta(minutes=5))
        assert mock_produce_task.call_count == 0

        # Still nothing 9 minutes in
        dispatch_check_missing(ts + timedelta(minutes=9))
        assert mock_produce_task.call_count == 0

        # We have missed our check-in at 10 minutes
        dispatch_check_missing(ts + timedelta(minutes=10))
        assert mock_produce_task.call_count == 1

        message: MarkMissing = {
            "type": "mark_missing",
            "ts": (ts + timedelta(minutes=10)).timestamp(),
            "monitor_environment_id": monitor_environment.id,
        }
        payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        assert mock_produce_task.mock_calls[0] == mock.call(payload)

        mark_environment_missing(
            monitor_environment.id,
            ts + timedelta(minutes=10),
        )

        # The missed checkin is created when it was supposed to happen
        missed_checkin = MonitorCheckIn.objects.get(
            monitor_environment=monitor_environment.id,
            status=CheckInStatus.MISSED,
        )
        assert missed_checkin.date_added == ts
        assert missed_checkin.expected_time == ts

        monitor_env = MonitorEnvironment.objects.get(
            id=monitor_environment.id,
            status=MonitorStatus.ERROR,
        )

        # The next checkin is at the 10 minute mark now
        assert monitor_env.next_checkin == ts + timedelta(minutes=10)

    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def test_missing_checkin_with_skipped_clock_ticks(self, mock_produce_task):
        """
        Test that skipped dispatch_check_missing tasks does NOT cause the missed
        check-ins to fall behind, and instead that missed check-ins simply will
        be skipped, but at the correct times
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "* * * * *",
                "checkin_margin": None,
                "max_runtime": None,
            },
        )

        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=1),
            next_checkin=ts,
            next_checkin_latest=ts + timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        # Nothing happens first run, we're not at the next_checkin_latest
        dispatch_check_missing(ts)
        assert mock_produce_task.call_count == 0

        # Generate a missed-checkin
        dispatch_check_missing(ts + timedelta(minutes=1))
        assert mock_produce_task.call_count == 1
        mark_environment_missing(
            monitor_environment.id,
            ts + timedelta(minutes=1),
        )

        # MonitorEnvironment is correctly updated with the next checkin time
        monitor_environment.refresh_from_db()
        assert monitor_environment.next_checkin == ts + timedelta(minutes=1)

        # One minute later we SKIP the task...
        # noop

        # Two minutes later we do NOT skip the task
        dispatch_check_missing(ts + timedelta(minutes=3))
        assert mock_produce_task.call_count == 2
        mark_environment_missing(
            monitor_environment.id,
            ts + timedelta(minutes=3),
        )

        # MonitorEnvironment is updated with the next_checkin correctly being
        # computed from the most most recent check-in that should have happened
        monitor_environment.refresh_from_db()
        assert monitor_environment.next_checkin == ts + timedelta(minutes=3)

        # Missed check-in is created at the time it should have happened, NOT
        # at the most recent expected check in time, that slot was missed.
        missed_checkin = MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id,
            status=CheckInStatus.MISSED,
        ).order_by("-date_added")[0]
        assert missed_checkin.date_added == ts + timedelta(minutes=1)

    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def assert_state_does_not_change_for_status(
        self,
        state,
        mock_produce_task,
        is_muted=False,
        environment_is_muted=False,
    ):
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "* * * * *",
                "checkin_margin": None,
                "max_runtime": None,
            },
            status=state,
            is_muted=is_muted,
        )
        # Expected checkin was a full minute ago, if this monitor wasn't in the
        # `state` the monitor would usually end up marked as timed out
        MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
            status=MonitorStatus.ACTIVE,
            is_muted=environment_is_muted,
        )

        dispatch_check_missing(ts)

        # We do not fire off any tasks
        assert mock_produce_task.call_count == 0

    def test_missing_checkin_but_disabled(self):
        self.assert_state_does_not_change_for_status(ObjectStatus.DISABLED)

    def test_missing_checkin_but_pending_deletion(self):
        self.assert_state_does_not_change_for_status(ObjectStatus.PENDING_DELETION)

    def test_missing_checkin_but_deletion_in_progress(self):
        self.assert_state_does_not_change_for_status(ObjectStatus.DELETION_IN_PROGRESS)

    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def test_not_missing_checkin(self, mock_produce_task):
        """
        Our monitor task runs once per minute, we want to test that when it
        runs within the minute we correctly do not mark missed checkins that
        may happen within that minute, only at the start of the next minute do
        we mark those checkins as missed.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(second=0, microsecond=0)
        last_checkin_ts = ts - timedelta(minutes=1)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "* * * * *",
                "checkin_margin": None,
                "max_runtime": None,
            },
        )
        # Expected checkin is this minute
        MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=last_checkin_ts,
            next_checkin=ts,
            next_checkin_latest=ts + timedelta(minutes=1),
            status=MonitorStatus.OK,
        )
        # Last checkin was a minute ago
        MonitorCheckIn.objects.create(
            monitor=monitor,
            project_id=project.id,
            status=CheckInStatus.OK,
            date_added=last_checkin_ts,
        )

        # Running the task will not mark the monitor as missed, since the next
        # checkin time will be exactly the same as the reference time for the
        # monitor.
        dispatch_check_missing(ts)

        # We do not fire off any tasks
        assert mock_produce_task.call_count == 0

    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def test_missed_exception_handling(self, mock_produce_task):
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(second=0, microsecond=0)

        exception_monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.INTERVAL,
                # XXX: Note the invalid schedule will cause an exception,
                # typically the validator protects us against this
                "schedule": [-2, "minute"],
                "checkin_margin": None,
                "max_runtime": None,
            },
        )
        failing_monitor_environment = MonitorEnvironment.objects.create(
            monitor=exception_monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=2),
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
            status=MonitorStatus.OK,
        )

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "* * * * *",
                "checkin_margin": None,
                "max_runtime": None,
            },
        )
        successful_monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=2),
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
            status=MonitorStatus.OK,
        )

        dispatch_check_missing(ts)

        # assert that task is called for the specific environments
        assert mock_produce_task.call_count == 2

        # assert failing monitor raises an error
        with pytest.raises(ValueError):
            mark_environment_missing(failing_monitor_environment.id, ts)

        # assert regular monitor works
        mark_environment_missing(successful_monitor_environment.id, ts)

        # We still put the monitor in an error state
        assert MonitorEnvironment.objects.filter(
            id=successful_monitor_environment.id, status=MonitorStatus.ERROR
        ).exists()
        assert MonitorCheckIn.objects.filter(
            monitor_environment=successful_monitor_environment.id, status=CheckInStatus.MISSED
        ).exists()

    @mock.patch("sentry.monitors.clock_tasks.check_missed.produce_task")
    def test_missed_checkin_backlog_handled(self, mock_produce_task):
        """
        In cases where the clock ticks quickly, we may have a queue of mark
        missed tasks for the same monitor_environment_id.

        This happens because of the dependency on next_checkin_latest.

        When the clock ticks quickly the result is that we will find the same
        monitor as needing to be marked as missed for multiple clock ticks. In
        a scenario where we have a monitor that is intended to run every 10
        minutes with a missed margin of 1:

        - tick 1
          wall-time            12:05:00
          clock-tick           12:00:00 (there is a backlog)
          next_checkin_latest  12:01:00
          XXX: Monitor expected to run. It did not

        - tick 2
          wall-time            12:05:01
          clock-tick:          12:01:00
          next_checkin_latest  12:01:00
          XXX: Monitor is detected as missed. Queue mark_missing (12:01:00)

        - tick 3
          wall-time            12:05:01
          clock-tick:          12:02:00
          next_checkin_latest  12:01:00
          XXX: The queued mark_missing from the last tick **has not yet
               executed** thus next_checkin_latest has not moved forward. This
               means WE WILL DETECT THE MISS AGAIN. Queue mark_missing (12:02:00)

        - mark_missing (12:01:00) executes
          wall-time            12:05:01
          next_checkin_latest  12:11:00 (has been updated since the schedule is every 10 minutes)

        - mark_missing (12:02:00) executes
          wall-time            12:05:01
          next_checkin_latest  12:11:00
          XXX: This execution **MUST DETECT** that the next_checkin_latest has
               already moved forward, as we do not want to produce a missed
               check-in again.

        - ... Continue until the clock tick backlog is burned down back to
              wall-clock time.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        # Timestamp is top of the hour midnight
        ts = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "*/10 * * * *",
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

        # Expected check in
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=10),
            next_checkin=ts,
            next_checkin_latest=ts + timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        # Clock tick at 12:00 does not find the monitor as missed
        dispatch_check_missing(ts)
        assert mock_produce_task.call_count == 0

        # Clock tick at 12:01 produces a missed check-in task
        dispatch_check_missing(ts + timedelta(minutes=1))
        assert mock_produce_task.call_count == 1

        # Clock tick at 12:02 produces another missed check-in task. This
        # happens because the first task has not yet run to re-compute the
        # next_checkin_latest
        dispatch_check_missing(ts + timedelta(minutes=2))
        assert mock_produce_task.call_count == 2

        # Execute the queued mark_missing tasks. This will have moved the
        # next_checkin_latest forward, meaning the next tick should NOT create
        # a missed check-in.
        mark_environment_missing(monitor_environment.id, ts + timedelta(minutes=1))

        # We have created a missed check-in
        missed_checkin = MonitorCheckIn.objects.get(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        )
        assert missed_checkin.date_added == ts
        assert missed_checkin.expected_time == ts

        # Execute the second task. This should detect that we've already moved
        # past the next_checkin_latest and NOT create a new missed
        mark_environment_missing(monitor_environment.id, ts + timedelta(minutes=2))

        missed_count = MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        ).count()
        assert missed_count == 1

    def test_status_updated_before_task_execution(self):
        """
        Test that if we queue a test when a monitor is not disabled, but then
        later disable it before the task executes, we do not create a missed.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        ts = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "* * * * *",
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

        # environment is disabled
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=2),
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
            status=MonitorStatus.DISABLED,
        )

        mark_environment_missing(monitor_environment.id, ts)

        # Do NOT generate a missed check-in
        assert not MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        ).exists()

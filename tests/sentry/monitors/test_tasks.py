from datetime import timedelta
from typing import MutableMapping
from unittest import mock

import msgpack
import pytest
import pytz
from arroyo import Partition, Topic
from arroyo.backends.kafka import KafkaPayload
from confluent_kafka.admin import PartitionMetadata
from django.test import override_settings
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.monitors.tasks import (
    check_missing,
    check_timeout,
    clock_pulse,
    mark_checkin_timeout,
    mark_environment_missing,
    try_monitor_tasks_trigger,
)
from sentry.testutils.cases import TestCase


def make_ref_time(**kwargs):
    """
    To accurately reflect the real usage of this task, we want the ref time
    to be truncated down to a minute for our tests.
    """
    tz_name = kwargs.pop("timezone", "UTC")

    ts = timezone.now().replace(**kwargs, tzinfo=None)
    ts = pytz.timezone(tz_name).localize(ts)

    # Typically the task will not run exactly on the minute, but it will
    # run very close, let's say for our test that it runs 12 seconds after
    # the minute.
    #
    # This is testing that the task correctly clamps its reference time
    # down to the minute.
    #
    # Task timestamps are in UTC, convert our reference time to UTC for this
    task_run_ts = ts.astimezone(timezone.utc).replace(second=12, microsecond=0)

    # Fan-out tasks recieve a floored version of the timestamp
    sub_task_run_ts = task_run_ts.replace(second=0)

    # We truncate down to the minute when we mark the next_checkin, do the
    # same here.
    trimmed_ts = ts.replace(second=0, microsecond=0)

    return task_run_ts, sub_task_run_ts, trimmed_ts


class MonitorTaskCheckMissingTest(TestCase):
    @mock.patch("sentry.monitors.tasks.mark_environment_missing")
    def test_missing_checkin(self, mark_environment_missing_mock):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time()

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
            monitor=monitor,
            environment=self.environment,
            last_checkin=ts - timedelta(minutes=2),
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
            status=MonitorStatus.OK,
        )

        check_missing(task_run_ts)

        # assert that task is called for the specific environment
        assert mark_environment_missing_mock.delay.call_count == 1
        assert mark_environment_missing_mock.delay.mock_calls[0] == mock.call(
            monitor_environment.id,
            sub_task_run_ts,
        )

        mark_environment_missing(monitor_environment.id, sub_task_run_ts)

        # Monitor status is updated
        monitor_environment = MonitorEnvironment.objects.get(
            id=monitor_environment.id, status=MonitorStatus.MISSED_CHECKIN
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

    @mock.patch("sentry.monitors.tasks.mark_environment_missing")
    def test_missing_checkin_with_timezone(self, mark_environment_missing_mock):
        org = self.create_organization()
        project = self.create_project(organization=org)

        # 1st of Febuary midnight Arizona time
        task_run_ts, sub_task_run_ts, ts = make_ref_time(
            month=2, day=1, hour=0, minute=0, timezone="US/Arizona"
        )

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
            environment=self.environment,
            last_checkin=ts - timedelta(days=1),
            next_checkin=ts,
            next_checkin_latest=ts + timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        # No missed check-ins generated any hour between the last check-in and
        # the upcoming checkin. Testing like this to validate any kind of
        # strange timezone related issues.
        for hour in range(24):
            check_missing(task_run_ts - timedelta(days=1) + timedelta(hours=hour + 1))

        assert mark_environment_missing_mock.delay.call_count == 0

        # Mark check in missed a minute later
        check_missing(task_run_ts + timedelta(minutes=1))
        assert mark_environment_missing_mock.delay.call_count == 1

        # Missed check-in correctly updates
        mark_environment_missing(monitor_environment.id, sub_task_run_ts + timedelta(minutes=1))
        monitor_environment.refresh_from_db()

        assert MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id,
            status=CheckInStatus.MISSED,
        ).exists()

        # Use UTC timezone for comparison so failed asserts are easier to read,
        # since next_checkin will bome back as UTC. This does NOT affect the assert
        utc_ts = ts.astimezone(timezone.utc)

        assert monitor_environment.next_checkin == utc_ts + timedelta(days=1)
        assert monitor_environment.next_checkin_latest == utc_ts + timedelta(days=1, minutes=1)

    @mock.patch("sentry.monitors.tasks.mark_environment_missing")
    def test_missing_checkin_with_margin(self, mark_environment_missing_mock):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time()

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
            environment=self.environment,
            last_checkin=ts - timedelta(minutes=12),
            next_checkin=ts - timedelta(minutes=2),
            next_checkin_latest=ts + timedelta(minutes=3),
            status=MonitorStatus.OK,
        )

        # No missed check-in generated as we're still within the check-in margin
        check_missing(task_run_ts)

        # assert that task is not called for the specific environment
        assert mark_environment_missing_mock.delay.call_count == 0

        assert not MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.MISSED_CHECKIN,
        ).exists()

        assert not MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id,
            status=CheckInStatus.MISSED,
        ).exists()

        # Missed check-in generated as clock now exceeds expected time plus margin
        check_missing(task_run_ts + timedelta(minutes=4))

        # assert that task is called for the specific environment
        assert mark_environment_missing_mock.delay.call_count == 1
        assert mark_environment_missing_mock.delay.mock_calls[0] == mock.call(
            monitor_environment.id,
            sub_task_run_ts + timedelta(minutes=4),
        )

        mark_environment_missing(
            monitor_environment.id,
            sub_task_run_ts + timedelta(minutes=4),
        )

        monitor_environment = MonitorEnvironment.objects.get(
            id=monitor_environment.id, status=MonitorStatus.MISSED_CHECKIN
        )

        missed_checkin = MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id,
            status=CheckInStatus.MISSED,
        )

        assert missed_checkin.exists()
        missed_checkin = missed_checkin[0]

        # Missed checkins are back-dated to when the checkin was expected to
        # happen. In this case the expected_time is equal to the date_added.
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

    @mock.patch("sentry.monitors.tasks.mark_environment_missing")
    def test_missing_checkin_with_margin_schedule_overlap(self, mark_environment_missing_mock):
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
        task_run_ts, sub_task_run_ts, ts = make_ref_time(minute=15)

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
            environment=self.environment,
            last_checkin=ts - timedelta(minutes=5),
            next_checkin=ts,
            next_checkin_latest=ts + timedelta(minutes=10),
            status=MonitorStatus.OK,
        )

        # No missed check-in generated as we're still within the check-in margin
        check_missing(task_run_ts)
        assert mark_environment_missing_mock.delay.call_count == 0

        # Missed checkin is STILL not produced 5 minutes in, even though this
        # is when another check-in should be happening.
        check_missing(task_run_ts + timedelta(minutes=5))
        assert mark_environment_missing_mock.delay.call_count == 0

        # Still nothing 9 minutes in
        check_missing(task_run_ts + timedelta(minutes=9))
        assert mark_environment_missing_mock.delay.call_count == 0

        # We have missed our check-in at 10 minutes
        check_missing(task_run_ts + timedelta(minutes=10))
        assert mark_environment_missing_mock.delay.call_count == 1

        assert mark_environment_missing_mock.delay.mock_calls[0] == mock.call(
            monitor_environment.id,
            sub_task_run_ts + timedelta(minutes=10),
        )

        mark_environment_missing(
            monitor_environment.id,
            sub_task_run_ts + timedelta(minutes=10),
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
            status=MonitorStatus.MISSED_CHECKIN,
        )

        # The next checkin is at the 10 minute mark now
        assert monitor_env.next_checkin == ts + timedelta(minutes=10)

    @mock.patch("sentry.monitors.tasks.mark_environment_missing")
    def test_missing_checkin_with_skipped_clock_ticks(self, mark_environment_missing_mock):
        """
        Test that skipped check_missing tasks does NOT cause the missed
        check-ins to fall behind, and instead that missed check-ins simply will
        be skipped, but at the correct times
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time()

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
            environment=self.environment,
            last_checkin=ts - timedelta(minutes=1),
            next_checkin=ts,
            next_checkin_latest=ts + timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        # Nothing happens first run, we're not at the next_checkin_latest
        check_missing(task_run_ts)
        assert mark_environment_missing_mock.delay.call_count == 0

        # Generate a missed-checkin
        check_missing(task_run_ts + timedelta(minutes=1))
        assert mark_environment_missing_mock.delay.call_count == 1
        mark_environment_missing(
            monitor_environment.id,
            sub_task_run_ts + timedelta(minutes=1),
        )

        # MonitorEnvironment is correctly updated with the next checkin time
        monitor_environment.refresh_from_db()
        assert monitor_environment.next_checkin == ts + timedelta(minutes=1)

        # One minute later we SKIP the task...
        # noop

        # Two minutes later we do NOT skip the task
        check_missing(task_run_ts + timedelta(minutes=3))
        assert mark_environment_missing_mock.delay.call_count == 2
        mark_environment_missing(
            monitor_environment.id,
            sub_task_run_ts + timedelta(minutes=3),
        )

        # MonitorEnvironment is updated with the next_checkin correctly being
        # computed from the most most recent check-in that should have happened
        monitor_environment.refresh_from_db()
        assert monitor_environment.next_checkin == ts + timedelta(minutes=3)

        # Missed check-in is created at the time it should have happened, NOT
        # at the most recent expected check in time, that slot was missed.
        missed_checkin = (
            MonitorCheckIn.objects.filter(
                monitor_environment=monitor_environment.id,
                status=CheckInStatus.MISSED,
            )
            .order_by("-date_added")
            .first()
        )
        assert missed_checkin.date_added == ts + timedelta(minutes=1)

    @mock.patch("sentry.monitors.tasks.mark_environment_missing")
    def assert_state_does_not_change_for_status(
        self,
        state,
        mark_environment_missing_mock,
        is_muted=False,
        environment_is_muted=False,
    ):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, _, ts = make_ref_time()

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
            environment=self.environment,
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
            status=MonitorStatus.ACTIVE,
            is_muted=environment_is_muted,
        )

        check_missing(task_run_ts)

        # We do not fire off any tasks
        assert mark_environment_missing_mock.delay.call_count == 0

    def test_missing_checkin_but_disabled(self):
        self.assert_state_does_not_change_for_status(ObjectStatus.DISABLED)

    def test_missing_checkin_but_pending_deletion(self):
        self.assert_state_does_not_change_for_status(ObjectStatus.PENDING_DELETION)

    def test_missing_checkin_but_deletion_in_progress(self):
        self.assert_state_does_not_change_for_status(ObjectStatus.DELETION_IN_PROGRESS)

    # Temporary test until we can move out of celery or reduce load
    def test_missing_checkin_but_muted(self):
        self.assert_state_does_not_change_for_status(ObjectStatus.ACTIVE, is_muted=True)

    # Temporary test until we can move out of celery or reduce load
    def test_missing_checkin_but_environment_muted(self):
        self.assert_state_does_not_change_for_status(ObjectStatus.ACTIVE, environment_is_muted=True)

    @mock.patch("sentry.monitors.tasks.mark_environment_missing")
    def test_not_missing_checkin(self, mark_environment_missing_mock):
        """
        Our monitor task runs once per minute, we want to test that when it
        runs within the minute we correctly do not mark missed checkins that
        may happen within that minute, only at the start of the next minute do
        we mark those checkins as missed.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, _, ts = make_ref_time()
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
            environment=self.environment,
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
        check_missing(task_run_ts)

        # We do not fire off any tasks
        assert mark_environment_missing_mock.delay.call_count == 0

    @mock.patch("sentry.monitors.tasks.mark_environment_missing")
    def test_missed_exception_handling(self, mark_environment_missing_mock):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time()

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
            environment=self.environment,
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
            environment=self.environment,
            last_checkin=ts - timedelta(minutes=2),
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
            status=MonitorStatus.OK,
        )

        check_missing(task_run_ts)

        # assert that task is called for the specific environments
        assert mark_environment_missing_mock.delay.call_count == 2

        # assert failing monitor raises an error
        with pytest.raises(ValueError):
            mark_environment_missing(failing_monitor_environment.id, sub_task_run_ts)

        # assert regular monitor works
        mark_environment_missing(successful_monitor_environment.id, sub_task_run_ts)

        # We still marked a monitor as missed
        assert MonitorEnvironment.objects.filter(
            id=successful_monitor_environment.id, status=MonitorStatus.MISSED_CHECKIN
        ).exists()
        assert MonitorCheckIn.objects.filter(
            monitor_environment=successful_monitor_environment.id, status=CheckInStatus.MISSED
        ).exists()


class MonitorTaskCheckTimeoutTest(TestCase):
    @mock.patch("sentry.monitors.tasks.mark_checkin_timeout")
    def test_timeout(self, mark_checkin_timeout_mock):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time(hour=0, minute=0)

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
            environment=self.environment,
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
        check_timeout(task_run_ts)
        assert mark_checkin_timeout_mock.delay.call_count == 0

        # Does not time out at 12:29
        check_timeout(task_run_ts + timedelta(minutes=29))
        assert mark_checkin_timeout_mock.delay.call_count == 0

        # Timout at 12:30
        check_timeout(task_run_ts + timedelta(minutes=30))
        assert mark_checkin_timeout_mock.delay.call_count == 1
        assert mark_checkin_timeout_mock.delay.mock_calls[0] == mock.call(
            checkin.id,
            sub_task_run_ts + timedelta(minutes=30),
        )
        mark_checkin_timeout(
            checkin.id,
            sub_task_run_ts + timedelta(minutes=30),
        )

        # Check in is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.TIMEOUT).exists()

        # Monitor is marked as timed out
        monitor_env = MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.TIMEOUT,
        )
        assert monitor_env.exists()

        # Next check-in time has NOT changed
        assert monitor_env[0].next_checkin == ts + timedelta(hours=24)

    @mock.patch("sentry.monitors.tasks.mark_checkin_timeout")
    def test_timeout_with_overlapping_concurrent_checkins(self, mark_checkin_timeout_mock):
        """
        Tests the scenario where the max_runtime is larger than the gap between
        the schedule.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time(hour=0)

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
            environment=self.environment,
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

        # Second check in was started now, giving us the the overlapping
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
        check_timeout(task_run_ts)
        assert mark_checkin_timeout_mock.delay.call_count == 0

        # First checkin has not timed out yet
        check_timeout(task_run_ts + timedelta(minutes=29))
        assert mark_checkin_timeout_mock.delay.call_count == 0

        # First checkin timed out
        check_timeout(task_run_ts + timedelta(minutes=30))
        assert mark_checkin_timeout_mock.delay.call_count == 1
        assert mark_checkin_timeout_mock.delay.mock_calls[0] == mock.call(
            checkin1.id,
            sub_task_run_ts + timedelta(minutes=30),
        )

        mark_checkin_timeout(
            checkin1.id,
            sub_task_run_ts + timedelta(minutes=30),
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

    @mock.patch("sentry.monitors.tasks.mark_checkin_timeout")
    def test_timeout_at_next_checkin_time(self, mark_checkin_timeout_mock):
        """
        Test that timeouts that happen the same time we expect another check-in
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time(hour=1, minute=0)

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
            environment=self.environment,
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
        check_timeout(task_run_ts)
        assert mark_checkin_timeout_mock.delay.call_count == 1
        assert mark_checkin_timeout_mock.delay.mock_calls[0] == mock.call(
            checkin.id,
            sub_task_run_ts,
        )
        mark_checkin_timeout(checkin.id, sub_task_run_ts)

        # First checkin is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.TIMEOUT).exists()

        # Monitor was marked as timed out
        monitor_env = MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.TIMEOUT,
        )
        assert monitor_env.exists()

        # Next check-in time has NOT changed, it will be happening now
        assert monitor_env[0].next_checkin == ts

    @mock.patch("sentry.monitors.tasks.mark_checkin_timeout")
    def test_timeout_using_interval(self, mark_checkin_timeout_mock):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time(hour=0, minute=0)

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
            environment=self.environment,
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
        check_timeout(task_run_ts + timedelta(minutes=5))
        assert mark_checkin_timeout_mock.delay.call_count == 1
        assert mark_checkin_timeout_mock.delay.mock_calls[0] == mock.call(
            checkin.id,
            sub_task_run_ts + timedelta(minutes=5),
        )
        mark_checkin_timeout(
            checkin.id,
            sub_task_run_ts + timedelta(minutes=5),
        )

        # Check in is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.TIMEOUT).exists()

        # Monitor is marked as timed out
        monitor_env = MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.TIMEOUT,
        )
        assert monitor_env.exists()

        # XXX(epurkhiser): Next check-in timeout is STILL 10 minutes from when
        # we started our check-in. This is likely WRONG for the user, since we
        # do't know when their system computed the next check-in.
        assert monitor_env[0].next_checkin == ts + timedelta(minutes=10)

    @mock.patch("sentry.monitors.tasks.mark_checkin_timeout")
    def test_timeout_with_future_complete_checkin(self, mark_checkin_timeout_mock):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, sub_task_run_ts, ts = make_ref_time()
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
            environment=self.environment,
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
        check_timeout(task_run_ts)

        # assert that task is called for the specific checkin
        assert mark_checkin_timeout_mock.delay.call_count == 1
        assert mark_checkin_timeout_mock.delay.mock_calls[0] == mock.call(
            checkin1.id,
            sub_task_run_ts,
        )

        mark_checkin_timeout(checkin1.id, sub_task_run_ts)

        # The first checkin is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin1.id, status=CheckInStatus.TIMEOUT).exists()
        # The second checkin has not changed status
        assert MonitorCheckIn.objects.filter(id=checkin2.id, status=CheckInStatus.OK).exists()

        # Monitor does not change from OK to TIMED OUT since it was already OK.
        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id,
            status=MonitorStatus.OK,
        ).exists()


@override_settings(KAFKA_INGEST_MONITORS="monitors-test-topic")
@override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
@mock.patch("sentry.monitors.tasks._checkin_producer")
def test_clock_pulse(checkin_producer_mock):
    partition_count = 2

    mock_partitions: MutableMapping[int, PartitionMetadata] = {}
    for idx in range(partition_count):
        mock_partitions[idx] = PartitionMetadata()
        mock_partitions[idx].id = idx

    with mock.patch("sentry.monitors.tasks._get_partitions", lambda: mock_partitions):
        clock_pulse()

    # One clock pulse per partition
    assert checkin_producer_mock.produce.call_count == len(mock_partitions.items())
    for idx in range(partition_count):
        assert checkin_producer_mock.produce.mock_calls[idx] == mock.call(
            Partition(Topic("monitors-test-topic"), idx),
            KafkaPayload(
                None,
                msgpack.packb({"message_type": "clock_pulse"}),
                [],
            ),
        )


@mock.patch("sentry.monitors.tasks._dispatch_tasks")
def test_monitor_task_trigger(dispatch_tasks):
    now = timezone.now().replace(second=0, microsecond=0)

    # Assumes a single partition for simplicitly. Multi-partition cases are
    # covered in further test cases.

    # First checkin triggers tasks
    try_monitor_tasks_trigger(ts=now, partition=0)
    assert dispatch_tasks.call_count == 1

    # 5 seconds later does NOT trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=5), partition=0)
    assert dispatch_tasks.call_count == 1

    # a minute later DOES trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=0)
    assert dispatch_tasks.call_count == 2

    # Same time does NOT trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=0)
    assert dispatch_tasks.call_count == 2

    # A skipped minute triggers the task AND captures an error
    with mock.patch("sentry_sdk.capture_message") as capture_message:
        assert capture_message.call_count == 0
        try_monitor_tasks_trigger(ts=now + timedelta(minutes=3, seconds=5), partition=0)
        assert dispatch_tasks.call_count == 3
        capture_message.assert_called_with("Monitor task dispatch minute skipped")


@mock.patch("sentry.monitors.tasks._dispatch_tasks")
def test_monitor_task_trigger_partition_desync(dispatch_tasks):
    """
    When consumer partitions are not completely synchronized we may read
    timestamps in a non-monotonic order. In this scenario we want to make
    sure we still only trigger once
    """
    now = timezone.now().replace(second=0, microsecond=0)

    # First message in partition 0 with timestamp just after the minute
    # boundary triggers the task
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=1), partition=0)
    assert dispatch_tasks.call_count == 1

    # Second message in a partition 1 has a timestamp just before the minute
    # boundary, should not trigger anything since we've already ticked ahead of
    # this
    try_monitor_tasks_trigger(ts=now - timedelta(seconds=1), partition=1)
    assert dispatch_tasks.call_count == 1

    # Third message in partition 1 again just after the minute boundary does
    # NOT trigger the task, we've already ticked at that time.
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=1), partition=1)
    assert dispatch_tasks.call_count == 1

    # Next two messages in both partitions move the clock forward
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1, seconds=1), partition=0)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1, seconds=1), partition=1)
    assert dispatch_tasks.call_count == 2


@mock.patch("sentry.monitors.tasks._dispatch_tasks")
def test_monitor_task_trigger_partition_sync(dispatch_tasks):
    """
    When the kafka topic has multiple partitions we want to only tick our clock
    forward once all partitions have caught up. This test simulates that
    """
    now = timezone.now().replace(second=0, microsecond=0)

    # Tick for 4 partitions
    try_monitor_tasks_trigger(ts=now, partition=0)
    try_monitor_tasks_trigger(ts=now, partition=1)
    try_monitor_tasks_trigger(ts=now, partition=2)
    try_monitor_tasks_trigger(ts=now, partition=3)
    assert dispatch_tasks.call_count == 1
    assert dispatch_tasks.mock_calls[0] == mock.call(now)

    # Tick forward 3 of the partitions, global clock does not tick
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=0)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=1)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=2)
    assert dispatch_tasks.call_count == 1

    # Slowest partition ticks forward, global clock ticks
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=3)
    assert dispatch_tasks.call_count == 2
    assert dispatch_tasks.mock_calls[1] == mock.call(now + timedelta(minutes=1))


@mock.patch("sentry.monitors.tasks._dispatch_tasks")
def test_monitor_task_trigger_partition_tick_skip(dispatch_tasks):
    """
    In a scenario where all partitions move multiple ticks past the slowest
    partition we may end up skipping a tick.
    """
    now = timezone.now().replace(second=0, microsecond=0)

    # Tick for 4 partitions
    try_monitor_tasks_trigger(ts=now, partition=0)
    try_monitor_tasks_trigger(ts=now, partition=1)
    try_monitor_tasks_trigger(ts=now, partition=2)
    try_monitor_tasks_trigger(ts=now, partition=3)
    assert dispatch_tasks.call_count == 1
    assert dispatch_tasks.mock_calls[0] == mock.call(now)

    # Tick forward twice for 3 partitions
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=0)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=1)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=2)

    try_monitor_tasks_trigger(ts=now + timedelta(minutes=2), partition=0)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=3), partition=1)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=3), partition=2)
    assert dispatch_tasks.call_count == 1

    # Slowest partition catches up, but has a timestamp gap, capture the fact
    # that we skipped a minute
    with mock.patch("sentry_sdk.capture_message") as capture_message:
        assert capture_message.call_count == 0
        try_monitor_tasks_trigger(ts=now + timedelta(minutes=2), partition=3)
        capture_message.assert_called_with("Monitor task dispatch minute skipped")

    # XXX(epurkhiser): Another approach we could take here is to detect the
    # skipped minute and generate a tick for that minute, since we know
    # processed past that minute.
    #
    # This still could be a problem though since it may mean we will not
    # produce missed check-ins since the monitor already may have already
    # checked-in after and moved the `next_checkin_latest` forward.
    #
    # In practice this should almost never happen since we have a high volume of

    assert dispatch_tasks.call_count == 2
    assert dispatch_tasks.mock_calls[1] == mock.call(now + timedelta(minutes=2))

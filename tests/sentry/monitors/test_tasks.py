from datetime import datetime, timedelta
from unittest import mock

import msgpack
from arroyo.backends.kafka import KafkaPayload
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
    try_monitor_tasks_trigger,
)
from sentry.testutils.cases import TestCase


def make_ref_time():
    """
    To accurately reflect the real usage of this task, we want the ref time
    to be truncated down to a minute for our tests.
    """
    ts = timezone.now()

    # Typically the task will not run exactly on the minute, but it will
    # run very close, let's say for our test that it runs 12 seconds after
    # the minute.
    #
    # This is testing that the task correctly clamps its reference time
    # down to the minute.
    task_run_ts = ts.replace(second=12, microsecond=0)

    # We truncate down to the minute when we mark the next_checkin, do the
    # same here.
    trimmed_ts = ts.replace(second=0, microsecond=0)

    return task_run_ts, trimmed_ts


class MonitorTaskCheckMissingTest(TestCase):
    def test_missing_checkin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
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
            next_checkin_latest=ts - timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        check_missing(task_run_ts)

        # Monitor status is updated
        monitor_environment = MonitorEnvironment.objects.get(
            id=monitor_environment.id, status=MonitorStatus.MISSED_CHECKIN
        )

        # last_checkin was NOT updated. We only update this for real user check-ins.
        assert monitor_environment.last_checkin == ts - timedelta(minutes=2)

        # Because our checkin was a minute ago we'll have produced a missed checkin
        missed_checkin = MonitorCheckIn.objects.get(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        )
        assert missed_checkin.date_added == (
            monitor_environment.last_checkin + timedelta(minutes=1)
        ).replace(second=0, microsecond=0)
        assert missed_checkin.expected_time == (
            monitor_environment.last_checkin + timedelta(minutes=1)
        ).replace(second=0, microsecond=0)
        assert missed_checkin.monitor_config == monitor.config

    def test_missing_checkin_with_margin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()

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

        assert not MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.MISSED_CHECKIN
        ).exists()
        assert not MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        )

        # Missed check-in generated as clock now exceeds expected time plus margin
        check_missing(task_run_ts + timedelta(minutes=4))

        monitor_environment = MonitorEnvironment.objects.get(
            id=monitor_environment.id, status=MonitorStatus.MISSED_CHECKIN
        )

        # last_checkin was NOT updated. We only update this for real user check-ins.
        assert monitor_environment.last_checkin == ts - timedelta(minutes=12)

        assert MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        )
        missed_check = MonitorCheckIn.objects.get(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        )

        # Missed checkins are back-dated to when the checkin was expected to
        # happpen. In this case the expected_time is equal to the date_added.
        assert missed_check.date_added == (
            monitor_environment.last_checkin + timedelta(minutes=10)
        ).replace(second=0, microsecond=0)
        assert missed_check.expected_time == (
            monitor_environment.last_checkin + timedelta(minutes=10)
        ).replace(second=0, microsecond=0)

        assert missed_check.monitor_config == monitor.config

        # Monitor environment next_checkin values are updated correctly
        monitor_environment_updated = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert (
            monitor_environment_updated.next_checkin_latest
            == monitor_environment_updated.next_checkin + timedelta(minutes=5)
        )

    def assert_state_does_not_change_for_state(self, state):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
            status=state,
        )
        # Exepcted checkin was a full minute ago, if this monitor wasn't in the
        # `state` the monitor would usually end up marked as timed out
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts - timedelta(minutes=1),
            status=MonitorStatus.ACTIVE,
        )

        check_missing(task_run_ts)

        # The monitor does not get set to a timeout state
        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.ACTIVE
        ).exists()

        # No missed monitor is created
        assert not MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        ).exists()

    def test_missing_checkin_but_disabled(self):
        self.assert_state_does_not_change_for_state(ObjectStatus.DISABLED)

    def test_missing_checkin_but_pending_deletion(self):
        self.assert_state_does_not_change_for_state(ObjectStatus.PENDING_DELETION)

    def test_missing_checkin_but_deletion_in_progress(self):
        self.assert_state_does_not_change_for_state(ObjectStatus.DELETION_IN_PROGRESS)

    def test_not_missing_checkin(self):
        """
        Our monitor task runs once per minute, we want to test that when it
        runs within the minute we correctly do not mark missed checkins that
        may happen within that minute, only at the start of the next minute do
        we mark those checkins as missed.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()
        last_checkin_ts = ts - timedelta(minutes=1)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )
        # Expected checkin is this minute
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            last_checkin=last_checkin_ts,
            next_checkin=ts,
            next_checkin_latest=ts,
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

        # Monitor stays in OK state
        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.OK
        ).exists()

        # No missed monitor is created
        assert not MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        ).exists()

    @mock.patch("sentry.monitors.tasks.logger")
    def test_missed_exception_handling(self, logger):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()

        exception_monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.INTERVAL,
                # XXX: Note the invalid schedule will cause an exception,
                # typically the validator protects us against this
                "schedule": [-2, "minute"],
            },
        )
        MonitorEnvironment.objects.create(
            monitor=exception_monitor,
            environment=self.environment,
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts - timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *"},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts - timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

        check_missing(task_run_ts)

        # Logged the exception
        assert logger.exception.call_count == 1

        # We still marked a monitor as missed
        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.MISSED_CHECKIN
        ).exists()
        assert MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment.id, status=CheckInStatus.MISSED
        ).exists()


class MonitorTaskCheckTimemoutTest(TestCase):
    def test_timeout_with_no_future_complete_checkin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()
        check_in_24hr_ago = ts - timedelta(hours=24)

        # Schedule is once a day
        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "0 0 * * *"},
        )
        # Next checkin should should have been 24 hours ago
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            last_checkin=check_in_24hr_ago - timedelta(hours=24),
            next_checkin=check_in_24hr_ago,
            next_checkin_latest=check_in_24hr_ago,
            status=MonitorStatus.OK,
        )
        # In progress started 24hr ago
        checkin1 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=check_in_24hr_ago,
            date_updated=check_in_24hr_ago,
            timeout_at=check_in_24hr_ago + timedelta(minutes=30),
        )
        # We started another checkin right now
        checkin2 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts,
            date_updated=ts,
            timeout_at=ts + timedelta(minutes=30),
        )

        assert checkin1.date_added == checkin1.date_updated == check_in_24hr_ago

        # Running check monitor will mark the first checkin as timed out, but
        # the second checkin is not yet timed out.
        check_timeout(task_run_ts)

        # First checkin is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin1.id, status=CheckInStatus.TIMEOUT).exists()

        # Second checkin is marked as timed out
        assert MonitorCheckIn.objects.filter(
            id=checkin2.id, status=CheckInStatus.IN_PROGRESS
        ).exists()

        # XXX(epurkhiser): At the moment we mark the monitor with the MOST
        # RECENT updated checkins status. In this scenario we actually already
        # have checkin2 in progress, but because we just marked
        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.TIMEOUT
        ).exists()

    def test_timeout_with_future_complete_checkin(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()
        check_in_24hr_ago = ts - timedelta(hours=24)

        # Schedule is once a day
        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "0 0 * * *"},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            # Next checkin is in the future, we just completed our last checkin
            last_checkin=ts,
            next_checkin=ts + timedelta(hours=24),
            next_checkin_latest=ts + timedelta(hours=24),
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

        # The first checkin is marked as timed out
        assert MonitorCheckIn.objects.filter(id=checkin1.id, status=CheckInStatus.TIMEOUT).exists()
        # The second checkin has not changed status
        assert MonitorCheckIn.objects.filter(id=checkin2.id, status=CheckInStatus.OK).exists()

        # Monitor does not change from OK to TIMED OUT since it was already OK.
        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.OK
        ).exists()

    def test_timeout_via_max_runtime_configuration(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()
        check_in_24hr_ago = ts - timedelta(hours=24)

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "0 0 * * *", "max_runtime": 60},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            last_checkin=check_in_24hr_ago,
            next_checkin=ts,
            next_checkin_latest=ts,
            status=MonitorStatus.OK,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts,
            date_updated=ts,
            timeout_at=ts + timedelta(minutes=60),
        )

        assert checkin.date_added == checkin.date_updated == ts

        # Running the check_monitors at 35 minutes does not mark the check-in as timed out, it's still allowed to be running
        check_timeout(task_run_ts + timedelta(minutes=35))
        assert MonitorCheckIn.objects.filter(
            id=checkin.id, status=CheckInStatus.IN_PROGRESS
        ).exists()

        # After 60 minutes the checkin will be marked as timed out
        check_timeout(task_run_ts + timedelta(minutes=60))
        assert MonitorCheckIn.objects.filter(id=checkin.id, status=CheckInStatus.TIMEOUT).exists()

        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.TIMEOUT
        ).exists()

    @mock.patch("sentry.monitors.tasks.logger")
    def test_timeout_exception_handling(self, logger):
        org = self.create_organization()
        project = self.create_project(organization=org)

        task_run_ts, ts = make_ref_time()
        check_in_24hr_ago = ts - timedelta(hours=24)

        # This monitor will cause failure
        exception_monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule_type": ScheduleType.INTERVAL,
                # XXX: Note the invalid schedule will cause an exception,
                # typically the validator protects us against this
                "schedule": [-2, "minute"],
            },
        )
        exception_monitor_environment = MonitorEnvironment.objects.create(
            monitor=exception_monitor,
            environment=self.environment,
            last_checkin=ts,
            next_checkin=ts + timedelta(hours=24),
            next_checkin_latest=ts + timedelta(hours=24),
            status=MonitorStatus.OK,
        )
        MonitorCheckIn.objects.create(
            monitor=exception_monitor,
            monitor_environment=exception_monitor_environment,
            project_id=project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=check_in_24hr_ago,
            date_updated=check_in_24hr_ago,
            timeout_at=check_in_24hr_ago + timedelta(minutes=30),
        )

        # This monitor will be fine
        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "0 0 * * *"},
            date_added=check_in_24hr_ago,
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            last_checkin=ts,
            next_checkin=ts + timedelta(hours=24),
            next_checkin_latest=ts + timedelta(hours=24),
            status=MonitorStatus.OK,
        )
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
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts,
            date_updated=ts,
            timeout_at=ts + timedelta(minutes=30),
        )

        assert checkin1.date_added == checkin1.date_updated == check_in_24hr_ago

        check_timeout(task_run_ts)

        # Logged the exception
        assert logger.exception.call_count == 1

        assert MonitorCheckIn.objects.filter(id=checkin1.id, status=CheckInStatus.TIMEOUT).exists()

        assert MonitorCheckIn.objects.filter(
            id=checkin2.id, status=CheckInStatus.IN_PROGRESS
        ).exists()

        assert MonitorEnvironment.objects.filter(
            id=monitor_environment.id, status=MonitorStatus.TIMEOUT
        ).exists()


class MonitorTaskClockPulseTest(TestCase):
    @override_settings(KAFKA_INGEST_MONITORS="monitors-test-topic")
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    @mock.patch("sentry.monitors.tasks._checkin_producer")
    def test_clock_pulse(self, _checkin_producer):
        clock_pulse()

        assert _checkin_producer.produce.call_count == 1
        assert _checkin_producer.produce.mock_calls[0] == mock.call(
            mock.ANY,
            KafkaPayload(
                None,
                msgpack.packb({"message_type": "clock_pulse"}),
                [],
            ),
        )


@mock.patch("sentry.monitors.tasks._dispatch_tasks")
def test_monitor_task_trigger(dispatch_tasks):
    now = datetime.now().replace(second=0, microsecond=0)

    # First checkin triggers tasks
    try_monitor_tasks_trigger(ts=now)
    assert dispatch_tasks.call_count == 1

    # 5 seconds later does NOT trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=5))
    assert dispatch_tasks.call_count == 1

    # a minute later DOES trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1))
    assert dispatch_tasks.call_count == 2

    # Same time does NOT trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1))
    assert dispatch_tasks.call_count == 2

    # A skipped minute trigges the task AND captures an error
    with mock.patch("sentry_sdk.capture_message") as capture_message:
        assert capture_message.call_count == 0
        try_monitor_tasks_trigger(ts=now + timedelta(minutes=3, seconds=5))
        assert dispatch_tasks.call_count == 3
        capture_message.assert_called_with("Monitor task dispatch minute skipped")


@mock.patch("sentry.monitors.tasks._dispatch_tasks")
def test_monitor_task_trigger_partition_desync(dispatch_tasks):
    """
    When consumer partitions are not completely synchronized we may read
    timestamps in a non-monotonic order. In this scenario we want to make
    sure we still only trigger once
    """
    now = datetime.now().replace(second=0, microsecond=0)

    # First message with timestamp just after the minute bounardary
    # triggers the task
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=1))
    assert dispatch_tasks.call_count == 1

    # Second message has a timestamp just before the minute boundary,
    # should not trigger anything since we've already ticked ahead of this
    try_monitor_tasks_trigger(ts=now - timedelta(seconds=1))
    assert dispatch_tasks.call_count == 1

    # Third message again just after the minute bounadry does NOT trigger
    # the task, we've already ticked at that time.
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=1))
    assert dispatch_tasks.call_count == 1

    # Fourth message moves past a new minute boundary, tick
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1, seconds=1))
    assert dispatch_tasks.call_count == 2

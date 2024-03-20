from datetime import UTC, timedelta
from unittest import mock

import pytest

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
from sentry.monitors.tasks.check_missed import check_missing, mark_environment_missing
from sentry.monitors.testutils import make_ref_time
from sentry.testutils.cases import TestCase


class MonitorTaskCheckMissingTest(TestCase):
    @mock.patch("sentry.monitors.tasks.check_missed.mark_environment_missing")
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
            environment_id=self.environment.id,
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

    @mock.patch("sentry.monitors.tasks.check_missed.mark_environment_missing")
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
            environment_id=self.environment.id,
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
        utc_ts = ts.astimezone(UTC)

        assert monitor_environment.next_checkin == utc_ts + timedelta(days=1)
        assert monitor_environment.next_checkin_latest == utc_ts + timedelta(days=1, minutes=1)

    @mock.patch("sentry.monitors.tasks.check_missed.mark_environment_missing")
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
            environment_id=self.environment.id,
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
            status=MonitorStatus.ERROR,
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
            id=monitor_environment.id, status=MonitorStatus.ERROR
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

    @mock.patch("sentry.monitors.tasks.check_missed.mark_environment_missing")
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
            environment_id=self.environment.id,
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
            status=MonitorStatus.ERROR,
        )

        # The next checkin is at the 10 minute mark now
        assert monitor_env.next_checkin == ts + timedelta(minutes=10)

    @mock.patch("sentry.monitors.tasks.check_missed.mark_environment_missing")
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
            environment_id=self.environment.id,
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

    @mock.patch("sentry.monitors.tasks.check_missed.mark_environment_missing")
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
            environment_id=self.environment.id,
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

    @mock.patch("sentry.monitors.tasks.check_missed.mark_environment_missing")
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
        check_missing(task_run_ts)

        # We do not fire off any tasks
        assert mark_environment_missing_mock.delay.call_count == 0

    @mock.patch("sentry.monitors.tasks.check_missed.mark_environment_missing")
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

        check_missing(task_run_ts)

        # assert that task is called for the specific environments
        assert mark_environment_missing_mock.delay.call_count == 2

        # assert failing monitor raises an error
        with pytest.raises(ValueError):
            mark_environment_missing(failing_monitor_environment.id, sub_task_run_ts)

        # assert regular monitor works
        mark_environment_missing(successful_monitor_environment.id, sub_task_run_ts)

        # We still put the monitor in an error state
        assert MonitorEnvironment.objects.filter(
            id=successful_monitor_environment.id, status=MonitorStatus.ERROR
        ).exists()
        assert MonitorCheckIn.objects.filter(
            monitor_environment=successful_monitor_environment.id, status=CheckInStatus.MISSED
        ).exists()

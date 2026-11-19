from datetime import datetime, timedelta, timezone

from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.monitors.logic.monitor_environment import update_monitor_environment
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorStatus, ScheduleType
from sentry.testutils.cases import TestCase


class UpdateMonitorEnvironmentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = datetime(2026, 1, 1, 12, 30, tzinfo=timezone.utc)
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": "0 * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": 5,
            },
        )
        self.monitor_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            last_checkin=self.now,
            next_checkin=self.now.replace(minute=0) + timedelta(hours=1),
            next_checkin_latest=self.now.replace(minute=5) + timedelta(hours=1),
        )

    def _update_queries(
        self,
        last_checkin: datetime | None,
        expected_ts: datetime,
        monitor_status: int | None = None,
    ) -> list[str]:
        with CaptureQueriesContext(connections[router.db_for_write(MonitorEnvironment)]) as ctx:
            update_monitor_environment(self.monitor_env, last_checkin, expected_ts, monitor_status)
        return [
            q["sql"]
            for q in ctx.captured_queries
            if q["sql"].startswith('UPDATE "sentry_monitorenvironment"')
        ]

    def test_unchanged_skips_write(self) -> None:
        later = self.now + timedelta(minutes=10)
        assert self._update_queries(self.now, later) == []
        assert self._update_queries(self.now, later, MonitorStatus.OK) == []

    def test_changed_status_writes(self) -> None:
        assert len(self._update_queries(self.now, self.now, MonitorStatus.ERROR)) == 1
        self.monitor_env.refresh_from_db()
        assert self.monitor_env.status == MonitorStatus.ERROR

    def test_changed_schedule_writes(self) -> None:
        next_hour = self.now + timedelta(hours=1)
        assert len(self._update_queries(next_hour, next_hour)) == 1
        self.monitor_env.refresh_from_db()
        assert self.monitor_env.last_checkin == next_hour
        assert self.monitor_env.next_checkin == self.now.replace(minute=0) + timedelta(hours=2)
        assert self.monitor_env.next_checkin_latest == self.now.replace(minute=5) + timedelta(
            hours=2
        )

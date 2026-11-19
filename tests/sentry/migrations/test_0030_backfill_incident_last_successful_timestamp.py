from datetime import timedelta

from django.utils import timezone

from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorIncident
from sentry.testutils.cases import TestMigrations


class BackfillIncidentLastSuccessfulTimestampTest(TestMigrations):
    app = "monitors"
    migrate_from = "0029_add_incident_last_successful_timestamp"
    migrate_to = "0030_backfill_incident_last_successful_timestamp"
    connection = "secondary"

    def _incident(self, **kwargs: object) -> MonitorIncident:
        monitor = self.create_monitor()
        monitor_environment = self.create_monitor_environment(
            monitor=monitor, environment_id=self.environment.id
        )
        failed = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.ERROR,
            date_added=self.now,
        )
        return MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=failed,
            starting_timestamp=failed.date_added,
            **kwargs,
        )

    def _ok(self, incident: MonitorIncident, minutes: int) -> MonitorCheckIn:
        return self.create_monitor_checkin(
            monitor_environment=incident.monitor_environment,
            status=CheckInStatus.OK,
            date_added=self.now + timedelta(minutes=minutes),
        )

    def setup_initial_state(self) -> None:
        self.now = timezone.now().replace(microsecond=0)

        self.open_incident = self._incident()
        self._ok(self.open_incident, -10)
        self.newest_ok = self._ok(self.open_incident, 5)

        self.never_ok = self._incident()

        self.already_set = self._incident(last_successful_timestamp=self.now - timedelta(days=1))
        self._ok(self.already_set, -1)

        self.resolved = self._incident()
        resolving = self._ok(self.resolved, 1)
        self.resolved.update(resolving_checkin=resolving, resolving_timestamp=resolving.date_added)

    def test(self) -> None:
        self.open_incident.refresh_from_db()
        assert self.open_incident.last_successful_timestamp == self.newest_ok.date_added

        self.never_ok.refresh_from_db()
        assert self.never_ok.last_successful_timestamp is None

        self.already_set.refresh_from_db()
        assert self.already_set.last_successful_timestamp == self.now - timedelta(days=1)

        self.resolved.refresh_from_db()
        assert self.resolved.last_successful_timestamp is None

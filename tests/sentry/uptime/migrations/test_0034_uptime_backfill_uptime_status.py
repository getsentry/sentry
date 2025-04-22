from datetime import timedelta

from django.utils import timezone
import pytest

from sentry.testutils.cases import TestMigrations
from sentry.uptime.models import ProjectUptimeSubscription, UptimeStatus, UptimeSubscription

DATA_SOURCE_UPTIME_SUBSCRIPTION = "uptime_subscription"


class UptimeBackfillUptimeStatusTest(TestMigrations):
    app = "uptime"
    migrate_from = "0033_uptime_backfill_to_detectors"
    migrate_to = "0034_uptime_backfill_uptime_status"

    def setup_before_migration(self, apps):
        self.failing_subscription = UptimeSubscription.objects.create(
            url="https://sentry.io",
            interval_seconds=60,
            timeout_ms=5000,
        )

        self.failing_monitor = ProjectUptimeSubscription.objects.create(
            project=self.project,
            uptime_status=UptimeStatus.FAILED,
            uptime_status_update_date=timezone.now() - timedelta(minutes=5),
            uptime_subscription=self.failing_subscription,
            name="failed monitor",
        )

        assert self.failing_subscription.uptime_status != self.failing_monitor.uptime_status
        assert (
            self.failing_subscription.uptime_status_update_date
            != self.failing_monitor.uptime_status_update_date
        )

    @pytest.mark.skip(reason="No longer needed")
    def test(self):
        self.failing_monitor.refresh_from_db()
        self.failing_subscription.refresh_from_db()

        assert self.failing_subscription.uptime_status == self.failing_monitor.uptime_status
        assert (
            self.failing_subscription.uptime_status_update_date
            == self.failing_monitor.uptime_status_update_date
        )

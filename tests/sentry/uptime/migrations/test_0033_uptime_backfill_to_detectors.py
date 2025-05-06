import pytest

from sentry.testutils.cases import TestMigrations
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription, get_detector
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector

DATA_SOURCE_UPTIME_SUBSCRIPTION = "uptime_subscription"


class UptimeBackfillToDetectorsTest(TestMigrations):
    app = "uptime"
    migrate_from = "0032_stats_on_subscription"
    migrate_to = "0033_uptime_backfill_to_detectors"

    def setup_before_migration(self, apps):
        self.unmigrated_monitor = ProjectUptimeSubscription.objects.create(
            project=self.project,
            uptime_subscription=UptimeSubscription.objects.create(
                url="https://sentry.io",
                interval_seconds=60,
                timeout_ms=5000,
            ),
            name="unmigrated monitor",
        )

        self.migrated_monitor = ProjectUptimeSubscription.objects.create(
            project=self.project,
            uptime_subscription=UptimeSubscription.objects.create(
                url="https://santry.io",
                interval_seconds=60,
                timeout_ms=5000,
            ),
            name="migrated monitor",
        )
        data_source = DataSource.objects.create(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            organization=self.migrated_monitor.project.organization,
            source_id=str(self.migrated_monitor.uptime_subscription.id),
        )
        detector = Detector.objects.create(
            type="uptime_domain_failure",
            project=self.migrated_monitor.project,
            name=self.migrated_monitor.name,
            config={
                "environment": None,
                "mode": self.migrated_monitor.mode,
            },
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

    @pytest.mark.skip(reason="Flaky test causes problems in our CI/CD")
    def test(self):
        from sentry.workflow_engine.models import Detector

        assert Detector.objects.count() == 2
        detector = get_detector(self.unmigrated_monitor.uptime_subscription)
        assert detector
        assert detector.config["mode"] == self.unmigrated_monitor.mode

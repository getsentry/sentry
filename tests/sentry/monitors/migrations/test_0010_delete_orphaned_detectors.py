import pytest

from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.monitors.utils import ensure_cron_detector, get_detector_for_monitor
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector


@pytest.mark.skip
class DeleteOrphanedDetectorsTest(TestMigrations):
    migrate_from = "0009_backfill_monitor_detectors"
    migrate_to = "0010_delete_orphaned_detectors"
    app = "monitors"

    def setup_initial_state(self) -> None:
        self.monitor_with_detector = self.create_monitor(name="Monitor with detector")
        ensure_cron_detector(self.monitor_with_detector)
        self.monitor_without_detector = self.create_monitor(name="Monitor without detector")
        self.orphaned_monitor = self.create_monitor(name="Orphaned monitor")
        ensure_cron_detector(self.orphaned_monitor)
        self.orphaned_data_source = DataSource.objects.get(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.orphaned_monitor.organization_id,
            source_id=str(self.orphaned_monitor.id),
        )
        self.orphaned_datasource_detector = DataSourceDetector.objects.get(
            data_source=self.orphaned_data_source
        )
        self.orphaned_detector = self.orphaned_datasource_detector.detector
        self.orphaned_monitor.delete()
        self.standalone_orphaned_data_source = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.organization.id,
            source_id="999999999",
        )
        self.standalone_orphaned_detector = Detector.objects.create(
            project_id=self.project.id,
            type="monitor_check_in_failure",
            name="Standalone orphaned detector",
            config={},
        )
        DataSourceDetector.objects.create(
            data_source=self.standalone_orphaned_data_source,
            detector=self.standalone_orphaned_detector,
        )
        assert get_detector_for_monitor(self.monitor_with_detector) is not None
        assert get_detector_for_monitor(self.monitor_without_detector) is None
        assert DataSource.objects.filter(id=self.orphaned_data_source.id).exists()
        assert Detector.objects.filter(id=self.orphaned_detector.id).exists()
        assert DataSource.objects.filter(id=self.standalone_orphaned_data_source.id).exists()
        assert Detector.objects.filter(id=self.standalone_orphaned_detector.id).exists()

    def test(self) -> None:
        detector = get_detector_for_monitor(self.monitor_with_detector)
        assert detector is not None
        assert get_detector_for_monitor(self.monitor_without_detector) is None
        assert not DataSource.objects.filter(id=self.orphaned_data_source.id).exists()
        assert not Detector.objects.filter(id=self.orphaned_detector.id).exists()
        assert not DataSource.objects.filter(id=self.standalone_orphaned_data_source.id).exists()
        assert not Detector.objects.filter(id=self.standalone_orphaned_detector.id).exists()
        valid_data_sources = DataSource.objects.filter(type=DATA_SOURCE_CRON_MONITOR)
        assert valid_data_sources.count() == 1
        remaining_data_source = valid_data_sources.first()
        assert remaining_data_source
        assert remaining_data_source.source_id == str(self.monitor_with_detector.id)

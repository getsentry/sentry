import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip
class RenameErrorDetectorsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0068_migrate_anomaly_detection_alerts"
    migrate_to = "0069_rename_error_detectors"

    def setup_before_migration(self, apps):
        self.project = self.create_project()

        self.detector = self.create_detector(
            project=self.project, type="error", name="Error Detector"
        )
        self.detector2 = self.create_detector(
            project=self.project, type="error", name="Error Detector 2"
        )
        self.detector3 = self.create_detector(
            project=self.project, type="monitor_check_in_failure", name="Crons Detector"
        )

    def test(self) -> None:
        self.detector.refresh_from_db()
        assert self.detector.name == "Error Monitor"

        self.detector2.refresh_from_db()
        assert self.detector2.name == "Error Monitor"

        self.detector3.refresh_from_db()
        assert self.detector3.name == "Crons Detector"

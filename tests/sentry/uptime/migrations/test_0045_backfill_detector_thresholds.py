from typing import int
import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip()
class BackfillDetectorThresholdsTest(TestMigrations):
    migrate_from = "0044_remove_project_uptime_subscription"
    migrate_to = "0045_backfill_detector_thresholds"
    app = "uptime"

    def setup_initial_state(self) -> None:
        # Create test organization and project
        self.organization = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.organization)

        # Create uptime detectors with various config states

        # Detector 1: Minimal valid config without thresholds (should get both thresholds)
        self.detector_no_config = self.create_detector(
            project=self.project,
            name="uptime-detector-no-config",
            type="uptime_domain_failure",
            config={"mode": 1, "environment": "production"},
        )

        # Detector 2: Basic config without thresholds (should get both thresholds)
        self.detector_empty_config = self.create_detector(
            project=self.project,
            name="uptime-detector-empty-config",
            type="uptime_domain_failure",
            config={"mode": 1, "environment": None},
        )

        # Detector 3: Has some config but no thresholds (should get both thresholds)
        self.detector_partial_config = self.create_detector(
            project=self.project,
            name="uptime-detector-partial-config",
            type="uptime_domain_failure",
            config={"mode": 1, "environment": "production"},
        )

        # Detector 4: Has only recovery_threshold (should get downtime_threshold)
        self.detector_has_recovery = self.create_detector(
            project=self.project,
            name="uptime-detector-has-recovery",
            type="uptime_domain_failure",
            config={"mode": 1, "environment": None, "recovery_threshold": 2},
        )

        # Detector 5: Has only downtime_threshold (should get recovery_threshold)
        self.detector_has_downtime = self.create_detector(
            project=self.project,
            name="uptime-detector-has-downtime",
            type="uptime_domain_failure",
            config={"mode": 1, "environment": None, "downtime_threshold": 5},
        )

        # Detector 6: Has both thresholds already (should not change)
        self.detector_has_both = self.create_detector(
            project=self.project,
            name="uptime-detector-has-both",
            type="uptime_domain_failure",
            config={
                "mode": 1,
                "environment": None,
                "recovery_threshold": 3,
                "downtime_threshold": 7,
            },
        )

        # Detector 7: Non-uptime detector (should not change)
        self.detector_non_uptime = self.create_detector(
            project=self.project,
            name="regular-detector",
            type="monitor_check_in_failure",
            config={},
        )

    def test_migration(self) -> None:
        # Test detector with basic config gets both thresholds
        self.detector_no_config.refresh_from_db()
        assert self.detector_no_config.config is not None
        assert self.detector_no_config.config["recovery_threshold"] == 1
        assert self.detector_no_config.config["downtime_threshold"] == 3
        assert self.detector_no_config.config["mode"] == 1  # Preserved
        assert self.detector_no_config.config["environment"] == "production"  # Preserved

        # Test detector with basic config gets both thresholds
        self.detector_empty_config.refresh_from_db()
        assert self.detector_empty_config.config["recovery_threshold"] == 1
        assert self.detector_empty_config.config["downtime_threshold"] == 3
        assert self.detector_empty_config.config["mode"] == 1  # Preserved
        assert self.detector_empty_config.config["environment"] is None  # Preserved

        # Test detector with partial config gets both thresholds and preserves existing
        self.detector_partial_config.refresh_from_db()
        assert self.detector_partial_config.config["recovery_threshold"] == 1
        assert self.detector_partial_config.config["downtime_threshold"] == 3
        assert self.detector_partial_config.config["mode"] == 1
        assert self.detector_partial_config.config["environment"] == "production"

        # Test detector with only recovery_threshold gets downtime_threshold
        self.detector_has_recovery.refresh_from_db()
        assert self.detector_has_recovery.config["recovery_threshold"] == 2  # Preserved
        assert self.detector_has_recovery.config["downtime_threshold"] == 3  # Added
        assert self.detector_has_recovery.config["mode"] == 1  # Preserved

        # Test detector with only downtime_threshold gets recovery_threshold
        self.detector_has_downtime.refresh_from_db()
        assert self.detector_has_downtime.config["recovery_threshold"] == 1  # Added
        assert self.detector_has_downtime.config["downtime_threshold"] == 5  # Preserved
        assert self.detector_has_downtime.config["mode"] == 1  # Preserved

        # Test detector with both thresholds is unchanged
        self.detector_has_both.refresh_from_db()
        assert self.detector_has_both.config["recovery_threshold"] == 3  # Unchanged
        assert self.detector_has_both.config["downtime_threshold"] == 7  # Unchanged
        assert self.detector_has_both.config["mode"] == 1  # Unchanged

        # Test non-uptime detector is not affected
        self.detector_non_uptime.refresh_from_db()
        assert "recovery_threshold" not in self.detector_non_uptime.config
        assert "downtime_threshold" not in self.detector_non_uptime.config
        # Config should remain empty for cron detector
        assert self.detector_non_uptime.config == {}

"""
Tests for the slow DB query detector migration.
"""

from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.testutils.cases import TestMigrations


class TestSlowDBQueryDetectorMigration(TestMigrations):
    migrate_from = "0096_delete_non_single_written_fire_history"
    migrate_to = "0097_migrate_slow_db_query_detectors"

    def setup_before_migration(self, apps):
        """Set up projects with slow DB query settings before migration."""
        Project = apps.get_model("sentry", "Project")
        ProjectOption = apps.get_model("sentry", "ProjectOption")
        Organization = apps.get_model("sentry", "Organization")

        # Create organization
        self.organization = Organization.objects.create(
            name="Test Org",
            slug="test-org",
        )

        # Create project with custom slow DB settings
        self.project_with_custom = Project.objects.create(
            organization=self.organization,
            name="Test Project Custom",
            slug="test-custom",
        )

        # Set custom performance issue settings
        ProjectOption.objects.create(
            project=self.project_with_custom,
            key="sentry:performance_issue_settings",
            value={
                "slow_db_queries_detection_enabled": False,
                "slow_db_query_duration_threshold": 2500,
            },
        )

        # Create project with default settings (no option set)
        self.project_with_defaults = Project.objects.create(
            organization=self.organization,
            name="Test Project Default",
            slug="test-default",
        )

        # Store IDs for verification
        self.project_custom_id = self.project_with_custom.id
        self.project_default_id = self.project_with_defaults.id

    def test_migration_creates_detector_for_project(self):
        """Test that migration creates Detector model for projects."""
        Detector = self.apps.get_model("workflow_engine", "Detector")

        # Verify detectors were created
        custom_detector = Detector.objects.filter(
            project_id=self.project_custom_id,
            type=PerformanceSlowDBQueryGroupType.slug,
        ).first()

        default_detector = Detector.objects.filter(
            project_id=self.project_default_id,
            type=PerformanceSlowDBQueryGroupType.slug,
        ).first()

        assert custom_detector is not None
        assert default_detector is not None

        # Verify custom settings were migrated
        assert custom_detector.enabled is False
        assert custom_detector.config["duration_threshold"] == 2500
        assert custom_detector.config["allowed_span_ops"] == ["db"]

        # Verify default settings were used
        assert default_detector.enabled is True
        assert default_detector.config["duration_threshold"] == 1000
        assert default_detector.config["allowed_span_ops"] == ["db"]

        # Verify both have condition groups
        assert custom_detector.workflow_condition_group is not None
        assert default_detector.workflow_condition_group is not None

    def test_migration_skips_existing_detectors(self):
        """Test that migration doesn't create duplicate detectors."""
        Detector = self.apps.get_model("workflow_engine", "Detector")

        # Count detectors for the project
        detector_count = Detector.objects.filter(
            project_id=self.project_custom_id,
            type=PerformanceSlowDBQueryGroupType.slug,
        ).count()

        # Should only have one detector per project
        assert detector_count == 1

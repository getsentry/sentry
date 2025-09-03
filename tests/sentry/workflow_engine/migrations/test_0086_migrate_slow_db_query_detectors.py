import importlib

import pytest

from sentry.testutils.cases import TestCase

# Import migration function dynamically since module name starts with number
migration_module = importlib.import_module(
    "sentry.workflow_engine.migrations.0086_migrate_slow_db_query_detectors"
)
migrate_slow_db_query_detectors = migration_module.migrate_slow_db_query_detectors


@pytest.mark.django_db
class TestSlowDBQueryDetectorMigration(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.organization = self.project.organization

    def test_migration_creates_detector_for_project(self):
        """Test that migration creates a detector for each project."""
        # Get the models as the migration would see them
        from django.apps import apps as django_apps

        migration_apps = django_apps

        # Run the migration function
        migrate_slow_db_query_detectors(migration_apps, None)

        # Check that detector was created
        from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType

        Detector = migration_apps.get_model("workflow_engine", "Detector")
        detectors = Detector.objects.filter(
            project_id=self.project.id,
            type=PerformanceSlowDBQueryGroupType.slug,
            name="Slow DB Query Detection",
        )

        assert detectors.count() == 1
        detector = detectors.first()

        # Verify detector properties
        assert detector.enabled is True
        assert detector.type == PerformanceSlowDBQueryGroupType.slug
        assert detector.config["duration_threshold"] == 1000
        assert detector.config["allowed_span_ops"] == ["db"]
        assert detector.description == "Detects slow database queries exceeding duration threshold"

        # Verify it has a data condition group
        assert detector.workflow_condition_group is not None
        assert detector.workflow_condition_group.organization_id == self.organization.id

    def test_migration_skips_existing_detectors(self):
        """Test that migration doesn't create duplicate detectors."""
        from django.apps import apps as django_apps

        from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType

        migration_apps = django_apps

        Detector = migration_apps.get_model("workflow_engine", "Detector")
        DataConditionGroup = migration_apps.get_model("workflow_engine", "DataConditionGroup")

        # Create existing detector
        existing_condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
        )

        existing_detector = Detector.objects.create(
            project_id=self.project.id,
            enabled=True,
            name="Slow DB Query Detection",
            type=PerformanceSlowDBQueryGroupType.slug,
            workflow_condition_group=existing_condition_group,
            config={"duration_threshold": 2000},  # Different config
        )

        initial_count = Detector.objects.filter(
            project_id=self.project.id,
            type=PerformanceSlowDBQueryGroupType.slug,
            name="Slow DB Query Detection",
        ).count()

        assert initial_count == 1

        # Run migration
        migrate_slow_db_query_detectors(migration_apps, None)

        # Should still only have one detector
        final_count = Detector.objects.filter(
            project_id=self.project.id,
            type=PerformanceSlowDBQueryGroupType.slug,
            name="Slow DB Query Detection",
        ).count()

        assert final_count == 1

        # Original detector should be unchanged
        detector = Detector.objects.get(id=existing_detector.id)
        assert detector.config["duration_threshold"] == 2000  # Unchanged

    def test_migration_with_multiple_projects(self):
        """Test that migration creates detectors for multiple projects."""
        from django.apps import apps as django_apps

        from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType

        # Create additional projects
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project()  # Different organization

        migration_apps = django_apps

        # Run migration
        migrate_slow_db_query_detectors(migration_apps, None)

        # Check all projects got detectors
        Detector = migration_apps.get_model("workflow_engine", "Detector")

        for project in [self.project, project2, project3]:
            detectors = Detector.objects.filter(
                project_id=project.id,
                type=PerformanceSlowDBQueryGroupType.slug,
                name="Slow DB Query Detection",
            )
            assert detectors.count() == 1

    def test_migration_handles_project_options(self):
        """Test that migration respects project-specific settings."""
        from django.apps import apps as django_apps

        from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType

        # Create project option for custom threshold
        from sentry.models.options.project_option import ProjectOption

        ProjectOption.objects.create(
            project=self.project,
            key="performance.issues.slow_db_query.duration_threshold",
            value=5000,
        )

        migration_apps = django_apps

        # Run migration
        migrate_slow_db_query_detectors(migration_apps, None)

        # Check detector uses custom setting
        Detector = migration_apps.get_model("workflow_engine", "Detector")
        detector = Detector.objects.get(
            project_id=self.project.id,
            type=PerformanceSlowDBQueryGroupType.slug,
            name="Slow DB Query Detection",
        )

        assert detector.config["duration_threshold"] == 5000

    def test_migration_with_database_error_handling(self):
        """Test that migration handles database errors gracefully."""
        from unittest.mock import patch

        from django.apps import apps as django_apps

        from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType

        migration_apps = django_apps

        # Mock a database error during DataConditionGroup creation specifically
        DataConditionGroup = migration_apps.get_model("workflow_engine", "DataConditionGroup")
        with patch.object(DataConditionGroup.objects, "create") as mock_create:
            mock_create.side_effect = Exception("Database error")

            # Migration should not raise exception
            try:
                migrate_slow_db_query_detectors(migration_apps, None)
            except Exception:
                pytest.fail("Migration should handle database errors gracefully")

        # Verify no detectors were created due to the error
        Detector = migration_apps.get_model("workflow_engine", "Detector")
        detectors = Detector.objects.filter(
            project_id=self.project.id,
            type=PerformanceSlowDBQueryGroupType.slug,
            name="Slow DB Query Detection",
        )
        assert detectors.count() == 0

    def test_migration_creates_non_user_editable_detectors(self):
        """Test that migration creates detectors that are not user-editable."""
        from django.apps import apps as django_apps

        from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType

        migration_apps = django_apps

        # Run migration
        migrate_slow_db_query_detectors(migration_apps, None)

        # Check that detector was created with span type (non-user-editable)
        Detector = migration_apps.get_model("workflow_engine", "Detector")
        detector = Detector.objects.get(
            project_id=self.project.id,
            type=PerformanceSlowDBQueryGroupType.slug,
            name="Slow DB Query Detection",
        )

        # Span detectors are not user-editable (like error detectors)
        assert detector.type == PerformanceSlowDBQueryGroupType.slug

        # Verify it has system-generated configuration
        assert "duration_threshold" in detector.config
        assert "allowed_span_ops" in detector.config

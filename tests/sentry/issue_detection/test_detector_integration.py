"""
Tests to verify that Detector model settings are properly integrated with performance detection.
"""

from sentry.issue_detection.performance_detection import get_merged_settings
from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup, Detector


class DetectorIntegrationTest(TestCase):
    def test_slow_db_query_detector_settings_from_model(self) -> None:
        """Test that slow DB query settings are fetched from Detector model when it exists."""
        project = self.create_project()

        # Create condition group for the detector
        condition_group = DataConditionGroup.objects.create(
            organization_id=project.organization_id,
        )

        # Create a slow DB query detector with custom settings
        Detector.objects.create(
            project_id=project.id,
            enabled=False,  # Disabled
            name="Slow DB Query Detection",
            type=PerformanceSlowDBQueryGroupType.slug,
            workflow_condition_group=condition_group,
            config={
                "duration_threshold": 2500,  # Custom threshold
                "allowed_span_ops": ["db"],
            },
            description="Test slow DB query detector",
        )

        # Get merged settings - should use detector model values
        settings = get_merged_settings(project.id)

        # Verify detector settings take precedence
        assert settings["slow_db_query_duration_threshold"] == 2500
        assert settings["slow_db_queries_detection_enabled"] is False

    def test_slow_db_query_detector_fallback_to_project_options(self) -> None:
        """Test that settings fall back to project options when Detector doesn't exist."""
        project = self.create_project()

        # Don't create a Detector model, so it falls back to project options
        settings = get_merged_settings(project.id)

        # Should have default values from options/project settings
        assert "slow_db_query_duration_threshold" in settings
        assert "slow_db_queries_detection_enabled" in settings

    def test_slow_db_query_detector_update_via_api(self) -> None:
        """Test that updating settings via API updates the Detector model."""
        from sentry.issues.endpoints.project_performance_issue_settings import (
            _update_detector_settings,
        )

        project = self.create_project()

        # Create condition group for the detector
        condition_group = DataConditionGroup.objects.create(
            organization_id=project.organization_id,
        )

        # Create a slow DB query detector
        detector = Detector.objects.create(
            project_id=project.id,
            enabled=True,
            name="Slow DB Query Detection",
            type=PerformanceSlowDBQueryGroupType.slug,
            workflow_condition_group=condition_group,
            config={
                "duration_threshold": 1000,
                "allowed_span_ops": ["db"],
            },
        )

        # Simulate API update
        _update_detector_settings(
            project.id,
            {
                "slow_db_queries_detection_enabled": False,
                "slow_db_query_duration_threshold": 3000,
            },
        )

        # Verify detector was updated
        detector.refresh_from_db()
        assert detector.enabled is False
        assert detector.config["duration_threshold"] == 3000

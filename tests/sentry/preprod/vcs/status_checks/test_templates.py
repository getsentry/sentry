from __future__ import annotations

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.vcs.status_checks.templates import format_status_check_messages
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class FormatStatusMessagesTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )

    def test_processing_state_formatting(self):
        """Test formatting for processing (uploading/uploaded) states."""
        for state in [
            PreprodArtifact.ArtifactState.UPLOADING,
            PreprodArtifact.ArtifactState.UPLOADED,
        ]:
            with self.subTest(state=state):
                artifact = PreprodArtifact.objects.create(
                    project=self.project,
                    state=state,
                    app_id="com.example.app",
                    build_version="1.0.0",
                    build_number=1,
                )

                title, subtitle, summary = format_status_check_messages(artifact)

                # Check title and subtitle
                assert title == "Size Analysis"
                assert subtitle == "Processing..."

                # Check summary contains processing indicators
                assert "Processing..." in summary
                assert "com.example.app" in summary
                assert "1.0.0 (1)" in summary
                assert "Analysis will be updated when processing completes" in summary

    def test_failed_state_formatting(self):
        """Test formatting for failed state."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.FAILED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            error_message="Build timeout",
        )

        title, subtitle, summary = format_status_check_messages(artifact)

        # Check title and subtitle
        assert title == "Size Analysis"
        assert subtitle == "Error processing"

        # Check summary contains error information
        assert "Build timeout" in summary
        assert "com.example.app" in summary
        assert "1.0.0 (1)" in summary
        assert "Error" in summary  # Column header

    def test_processed_state_without_metrics(self):
        """Test formatting for processed state without size metrics."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        title, subtitle, summary = format_status_check_messages(artifact)

        # Check title and subtitle (fallback)
        assert title == "Size Analysis"
        assert subtitle == "Complete"  # Falls back to basic success message

        # Should be a simple success message
        assert "processed successfully" in summary

    def test_processed_state_with_metrics_no_previous(self):
        """Test formatting for processed state with metrics but no previous build."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        # Create size metrics
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,  # 1 MB
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,  # 2 MB
            max_install_size=2 * 1024 * 1024,
        )

        title, subtitle, summary = format_status_check_messages(artifact)

        # Check title and subtitle
        assert title == "Size Analysis"
        assert subtitle == "1 build analyzed"  # Simplified subtitle

        # Check summary contains size table
        assert "1.0 MB" in summary  # Download size
        assert "2.0 MB" in summary  # Install size
        assert "N/A" in summary  # No diffing yet
        assert "com.example.app" in summary

    # TODO: Add back diffing tests when size comparison is implemented
    # For now, all processed states with metrics will show "1 build analyzed"

    def test_version_string_formatting(self):
        """Test version string formatting with different combinations."""
        test_cases = [
            ("1.0.0", None, "1.0.0"),
            (None, 42, "(42)"),
            ("1.0.0", 42, "1.0.0 (42)"),
            (None, None, "Unknown"),
        ]

        for version, build_number, expected in test_cases:
            with self.subTest(version=version, build_number=build_number):
                artifact = PreprodArtifact.objects.create(
                    project=self.project,
                    state=PreprodArtifact.ArtifactState.UPLOADING,
                    app_id="com.example.app",
                    build_version=version,
                    build_number=build_number,
                )

                title, subtitle, summary = format_status_check_messages(artifact)

                assert expected in summary

    def test_error_message_handling(self):
        """Test error message handling including None case."""
        test_cases = [
            ("Custom error message", "Custom error message"),
            (None, "Unknown error"),
            ("", "Unknown error"),
        ]

        for input_error, expected_error in test_cases:
            with self.subTest(input_error=input_error):
                artifact = PreprodArtifact.objects.create(
                    project=self.project,
                    state=PreprodArtifact.ArtifactState.FAILED,
                    app_id="com.example.app",
                    error_message=input_error,
                )

                title, subtitle, summary = format_status_check_messages(artifact)

                assert expected_error in summary

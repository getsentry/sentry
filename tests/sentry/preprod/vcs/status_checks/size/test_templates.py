from __future__ import annotations

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.vcs.status_checks.size.templates import format_status_check_messages
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


class StatusCheckTestBase(TestCase):
    """Base test class with common setup for status check formatting tests."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )


@region_silo_test
class ProcessingStateFormattingTest(StatusCheckTestBase):
    """Tests for formatting artifacts in processing/loading states."""

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

                title, subtitle, summary = format_status_check_messages(
                    [artifact], {}, StatusCheckStatus.IN_PROGRESS
                )

                assert title == "Size Analysis"
                assert subtitle == "1 build processing"
                assert "Processing..." in summary
                assert "com.example.app" in summary
                assert "1.0.0 (1)" in summary

    def test_processed_state_without_metrics(self):
        """Test formatting for processed state without size metrics."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        title, subtitle, summary = format_status_check_messages(
            [artifact], {}, StatusCheckStatus.FAILURE
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build processing"  # Processed but no metrics = still processing
        assert "Processing..." in summary

    def test_processed_state_with_metrics_no_previous(self):
        """Test formatting for processed state with metrics but no previous build."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,  # 1 MB
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,  # 2 MB
            max_install_size=2 * 1024 * 1024,
        )

        size_metrics_map = {artifact.id: [size_metrics]}

        title, subtitle, summary = format_status_check_messages(
            [artifact], size_metrics_map, StatusCheckStatus.SUCCESS
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build analyzed"
        assert "1.0 MB" in summary
        assert "2.0 MB" in summary
        assert "N/A" in summary
        assert "com.example.app" in summary

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

                title, subtitle, summary = format_status_check_messages(
                    [artifact], {}, StatusCheckStatus.IN_PROGRESS
                )

                assert expected in summary

    def test_multiple_artifacts_all_processing(self):
        """Test formatting for multiple artifacts all in processing states."""
        artifacts = []
        for i, state in enumerate(
            [
                PreprodArtifact.ArtifactState.UPLOADING,
                PreprodArtifact.ArtifactState.UPLOADED,
            ]
        ):
            artifacts.append(
                PreprodArtifact.objects.create(
                    project=self.project,
                    state=state,
                    app_id=f"com.example.app{i}",
                    build_version="1.0.0",
                    build_number=i + 1,
                )
            )

        title, subtitle, summary = format_status_check_messages(
            artifacts, {}, StatusCheckStatus.IN_PROGRESS
        )

        assert title == "Size Analysis"
        assert subtitle == "2 builds processing"
        assert "Processing..." in summary
        assert "com.example.app0" in summary
        assert "com.example.app1" in summary

    def test_mixed_processing_and_completed_metric_states_per_artifact(self):
        """Test formatting when one metric is completed and another is processing."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        # Main artifact metric completed
        main_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )

        # Watch artifact metric still processing
        watch_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
            min_download_size=None,
            max_download_size=None,
            min_install_size=None,
            max_install_size=None,
        )

        size_metrics_map = {artifact.id: [main_metrics, watch_metrics]}

        title, subtitle, summary = format_status_check_messages(
            [artifact], size_metrics_map, StatusCheckStatus.IN_PROGRESS
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build processing"  # Still processing because watch is not complete
        # Should have two rows - main app shows sizes, watch shows processing
        assert "`com.example.app`" in summary
        assert "`com.example.app (Watch)`" in summary
        assert "1.0 MB" in summary  # Main app completed
        assert "Processing..." in summary  # Watch app processing

    def test_size_metrics_still_processing(self):
        """Test formatting when size metrics are in processing states (PENDING/RUNNING)."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.processing",
            build_version="2.1.0",
            build_number=15,
        )

        pending_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
            min_download_size=None,
            max_download_size=None,
            min_install_size=None,
            max_install_size=None,
        )

        size_metrics_map = {artifact.id: [pending_metrics]}

        title, subtitle, summary = format_status_check_messages(
            [artifact], size_metrics_map, StatusCheckStatus.IN_PROGRESS
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build processing"

        # Verify processing state is shown in table
        assert "`com.example.processing`" in summary
        assert "2.1.0 (15)" in summary
        assert "Processing..." in summary

        # Should show processing for both size columns
        lines = summary.split("\n")
        data_line = next(line for line in lines if "com.example.processing" in line)
        processing_count = data_line.count("Processing...")
        assert processing_count == 2  # Download and install columns both show "Processing..."


@region_silo_test
class ErrorStateFormattingTest(StatusCheckTestBase):
    """Tests for formatting artifacts in error/failure states."""

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

        title, subtitle, summary = format_status_check_messages(
            [artifact], {}, StatusCheckStatus.FAILURE
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build errored"
        assert "Build timeout" in summary
        assert "com.example.app" in summary
        assert "1.0.0 (1)" in summary
        assert "Error" in summary  # Column header

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

                title, subtitle, summary = format_status_check_messages(
                    [artifact], {}, StatusCheckStatus.FAILURE
                )

                assert expected_error in summary

    def test_multiple_artifacts_mixed_states(self):
        """Test formatting for mixed states (some analyzed, some processing, some failed)."""
        artifacts = []
        size_metrics_map = {}

        processed_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.processed",
            build_version="1.0.0",
            build_number=1,
        )
        artifacts.append(processed_artifact)

        size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=processed_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,
            max_install_size=2 * 1024 * 1024,
        )
        size_metrics_map[processed_artifact.id] = [size_metrics]

        uploading_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADING,
            app_id="com.example.uploading",
            build_version="1.0.0",
            build_number=2,
        )
        artifacts.append(uploading_artifact)

        failed_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.FAILED,
            app_id="com.example.failed",
            build_version="1.0.0",
            build_number=3,
            error_message="Upload timeout",
        )
        artifacts.append(failed_artifact)

        title, subtitle, summary = format_status_check_messages(
            artifacts, size_metrics_map, StatusCheckStatus.FAILURE
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build analyzed, 1 build processing, 1 build errored"
        assert "Processing..." in summary  # Non-failed artifacts show as processing
        assert "Upload timeout" in summary  # Failed artifact error
        assert "com.example.processed" in summary
        assert "com.example.uploading" in summary
        assert "com.example.failed" in summary


@region_silo_test
class SuccessStateFormattingTest(StatusCheckTestBase):
    """Tests for formatting artifacts in successful/analyzed states."""

    def test_multiple_artifacts_all_analyzed(self):
        """Test formatting for multiple artifacts all analyzed."""
        artifacts = []
        size_metrics_map = {}

        for i in range(2):
            artifact = PreprodArtifact.objects.create(
                project=self.project,
                state=PreprodArtifact.ArtifactState.PROCESSED,
                app_id=f"com.example.app{i}",
                build_version="1.0.0",
                build_number=i + 1,
            )
            artifacts.append(artifact)

            size_metrics = PreprodArtifactSizeMetrics.objects.create(
                preprod_artifact=artifact,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                min_download_size=(i + 1) * 1024 * 1024,  # Different sizes
                max_download_size=(i + 1) * 1024 * 1024,
                min_install_size=(i + 2) * 1024 * 1024,
                max_install_size=(i + 2) * 1024 * 1024,
            )
            size_metrics_map[artifact.id] = [size_metrics]

        title, subtitle, summary = format_status_check_messages(
            artifacts, size_metrics_map, StatusCheckStatus.SUCCESS
        )

        assert title == "Size Analysis"
        assert subtitle == "2 builds analyzed"
        assert "1.0 MB" in summary  # First artifact download size
        assert "2.0 MB" in summary  # Second artifact download size
        assert "com.example.app0" in summary
        assert "com.example.app1" in summary

    def test_multiple_metric_types_per_artifact(self):
        """Test formatting with multiple metric types per artifact (main app + watch)."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        main_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,  # 1 MB
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,  # 2 MB
            max_install_size=2 * 1024 * 1024,
        )

        watch_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=512 * 1024,  # 0.5 MB
            max_download_size=512 * 1024,
            min_install_size=1024 * 1024,  # 1 MB
            max_install_size=1024 * 1024,
        )

        size_metrics_map = {artifact.id: [main_metrics, watch_metrics]}

        title, subtitle, summary = format_status_check_messages(
            [artifact], size_metrics_map, StatusCheckStatus.SUCCESS
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build analyzed"
        # Should have two rows - main app and watch app
        assert "`com.example.app`" in summary  # Main app
        assert "`com.example.app (Watch)`" in summary  # Watch app
        assert "1.0 MB" in summary  # Main app download
        assert "512.0 KB" in summary  # Watch app download
        assert "2.0 MB" in summary  # Main app install
        # Check that both rows appear together
        lines = summary.split("\n")
        main_row_idx = None
        watch_row_idx = None
        for i, line in enumerate(lines):
            if "`com.example.app`" in line and "(Watch)" not in line:
                main_row_idx = i
            elif "`com.example.app (Watch)`" in line:
                watch_row_idx = i
        assert main_row_idx is not None
        assert watch_row_idx is not None
        assert abs(main_row_idx - watch_row_idx) == 1  # Should be adjacent rows

    def test_android_dynamic_feature_metrics(self):
        """Test formatting with Android dynamic features."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.android",
            build_version="1.0.0",
            build_number=1,
        )

        main_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=4 * 1024 * 1024,  # 4 MB
            max_download_size=4 * 1024 * 1024,
            min_install_size=8 * 1024 * 1024,  # 8 MB
            max_install_size=8 * 1024 * 1024,
        )

        feature_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,  # 1 MB
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,  # 2 MB
            max_install_size=2 * 1024 * 1024,
            identifier="premium_features",
        )

        size_metrics_map = {artifact.id: [main_metrics, feature_metrics]}

        title, subtitle, summary = format_status_check_messages(
            [artifact], size_metrics_map, StatusCheckStatus.SUCCESS
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build analyzed"
        # Should have two rows - main app and dynamic feature
        assert "`com.example.android`" in summary  # Main app
        assert "`com.example.android (Dynamic Feature)`" in summary  # Dynamic feature
        assert "4.0 MB" in summary  # Main app download
        assert "1.0 MB" in summary  # Dynamic feature download
        assert "8.0 MB" in summary  # Main app install
        assert "2.0 MB" in summary  # Dynamic feature install

    def test_size_changes_with_base_artifacts(self):
        """Test size change calculations when base artifacts exist for comparison."""
        head_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="head_sha_123",
            base_sha="base_sha_456",
            provider="github",
            organization_id=self.organization.id,
        )
        base_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="base_sha_456",
            provider="github",
            organization_id=self.organization.id,
        )

        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.android",
            build_version="1.0.2",
            build_number=41,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=int(3.8 * 1024 * 1024),  # 3.8 MB
            max_download_size=int(3.8 * 1024 * 1024),
            min_install_size=int(7.9 * 1024 * 1024),  # 7.9 MB
            max_install_size=int(7.9 * 1024 * 1024),
        )

        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.android",
            build_version="1.0.3",
            build_number=42,
        )

        head_size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=4 * 1024 * 1024,  # 4.0 MB
            max_download_size=4 * 1024 * 1024,
            min_install_size=int(8.2 * 1024 * 1024),  # 8.2 MB
            max_install_size=int(8.2 * 1024 * 1024),
        )

        size_metrics_map = {head_artifact.id: [head_size_metrics]}

        title, subtitle, summary = format_status_check_messages(
            [head_artifact], size_metrics_map, StatusCheckStatus.SUCCESS
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build analyzed"

        # Verify that size changes are calculated and displayed
        assert "4.0 MB" in summary  # Current download size
        assert "8.2 MB" in summary  # Current install size

        # Verify that changes are shown (4.0MB - 3.8MB = 204.8KB, 8.2MB - 7.9MB = 307.2KB)
        assert "+204.8 KB" in summary  # Download change
        assert "+307.2 KB" in summary  # Install change

        # Verify the table structure includes the Change columns
        assert "Change" in summary
        assert "com.example.android" in summary
        assert "1.0.3 (42)" in summary

    def test_size_changes_no_base_artifacts(self):
        """Test that N/A is shown when no base artifacts exist for comparison."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
        )

        size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,  # 1 MB
            max_download_size=1024 * 1024,
            min_install_size=2 * 1024 * 1024,  # 2 MB
            max_install_size=2 * 1024 * 1024,
        )

        size_metrics_map = {artifact.id: [size_metrics]}

        title, subtitle, summary = format_status_check_messages(
            [artifact], size_metrics_map, StatusCheckStatus.SUCCESS
        )

        assert title == "Size Analysis"
        assert subtitle == "1 build analyzed"
        assert "1.0 MB" in summary
        assert "2.0 MB" in summary
        # Should show N/A for changes when no base exists
        lines = summary.split("\n")
        data_line = next(line for line in lines if "com.example.app" in line)
        assert "N/A" in data_line  # Change columns show N/A

    def test_size_changes_with_different_artifact_types(self):
        """Test that size changes only compare the same artifact types."""

        head_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="head_sha_789",
            base_sha="base_sha_012",
            provider="github",
            organization_id=self.organization.id,
        )

        base_commit_comparison = CommitComparison.objects.create(
            head_repo_name="test/repo",
            head_sha="base_sha_012",
            provider="github",
            organization_id=self.organization.id,
        )

        # Create base artifact with only MAIN_ARTIFACT metrics
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.ios",
            build_version="1.0.1",
            build_number=10,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=int(2.8 * 1024 * 1024),  # 2.8 MB
            max_download_size=int(2.8 * 1024 * 1024),
            min_install_size=int(6.5 * 1024 * 1024),  # 6.5 MB
            max_install_size=int(6.5 * 1024 * 1024),
        )

        # Create head artifact with MAIN_ARTIFACT and WATCH_ARTIFACT
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit_comparison,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.ios",
            build_version="1.0.2",
            build_number=11,
        )

        head_main_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=3 * 1024 * 1024,  # 3.0 MB
            max_download_size=3 * 1024 * 1024,
            min_install_size=int(6.8 * 1024 * 1024),  # 6.8 MB
            max_install_size=int(6.8 * 1024 * 1024),
        )

        head_watch_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=512 * 1024,  # 512 KB
            max_download_size=512 * 1024,
            min_install_size=1024 * 1024,  # 1 MB
            max_install_size=1024 * 1024,
        )

        size_metrics_map = {head_artifact.id: [head_main_metrics, head_watch_metrics]}

        _, _, summary = format_status_check_messages(
            [head_artifact], size_metrics_map, StatusCheckStatus.SUCCESS
        )

        # Main artifact should show changes (has matching base)
        assert "+204.8 KB" in summary  # 3.0MB - 2.8MB = 204.8KB
        assert "+307.2 KB" in summary  # 6.8MB - 6.5MB = 307.2KB

        # Watch artifact should show N/A (no matching base watch metrics)
        lines = summary.split("\n")
        watch_line = next(line for line in lines if "com.example.ios (Watch)" in line)
        # Count N/A occurrences in the watch line - should be 3 (change columns + approval)
        na_count = watch_line.count("N/A")
        assert na_count >= 2  # At least 2 N/A for the change columns

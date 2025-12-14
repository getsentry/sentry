from io import BytesIO
from unittest.mock import patch

from sentry.models.commitcomparison import CommitComparison
from sentry.models.files.file import File
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
    PreprodBuildConfiguration,
)
from sentry.preprod.size_analysis.tasks import (
    _run_size_analysis_comparison,
    compare_preprod_artifact_size_analysis,
    manual_size_analysis_comparison,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json


class ComparePreprodArtifactSizeAnalysisTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _create_size_metrics_with_analysis_file(self, artifact, analysis_data):
        """Helper to create PreprodArtifactSizeMetrics with analysis file."""
        # Create analysis file
        analysis_file = File.objects.create(
            name=f"size-analysis-{artifact.id}",
            type="preprod.file",
            headers={"Content-Type": "application/json"},
        )
        analysis_file.putfile(BytesIO(json.dumps(analysis_data).encode()))

        # Create size metrics
        return PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=analysis_file.id,
            max_install_size=analysis_data.get("install_size", 1000),
            max_download_size=analysis_data.get("download_size", 500),
        )

    def test_compare_preprod_artifact_size_analysis_nonexistent_artifact(self):
        """Test compare_preprod_artifact_size_analysis with nonexistent artifact."""
        with patch("sentry.preprod.size_analysis.tasks.logger") as mock_logger:
            compare_preprod_artifact_size_analysis(
                project_id=self.project.id,
                org_id=self.organization.id,
                artifact_id=99999,
            )

            mock_logger.exception.assert_called_once()
            call_args = mock_logger.exception.call_args
            assert "preprod.size_analysis.compare.artifact_not_found" in call_args[0]
            assert call_args[1]["extra"]["artifact_id"] == 99999

    def test_compare_preprod_artifact_size_analysis_no_commit_comparison(self):
        """Test compare_preprod_artifact_size_analysis with artifact having no commit comparison."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            app_id="com.example.app",
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        with (
            patch("sentry.preprod.size_analysis.tasks.logger") as mock_logger,
            patch(
                "sentry.preprod.size_analysis.tasks.create_preprod_status_check_task"
            ) as mock_status_check_task,
        ):
            compare_preprod_artifact_size_analysis(
                project_id=self.project.id,
                org_id=self.organization.id,
                artifact_id=artifact.id,
            )

            mock_logger.info.assert_called()
            call_args = mock_logger.info.call_args
            assert "preprod.size_analysis.compare.artifact_no_commit_comparison" in call_args[0]
            assert call_args[1]["extra"]["artifact_id"] == artifact.id

            # Should not call create_preprod_status_check_task when there's no commit comparison
            mock_status_check_task.apply_async.assert_not_called()

    def test_compare_preprod_artifact_size_analysis_success_as_head(self):
        """Test compare_preprod_artifact_size_analysis with artifact as head."""
        # Create commit comparisons
        head_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )
        base_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        # Create artifacts
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create size analysis data
        head_analysis_data = {
            "analysis_duration": 0.5,
            "download_size": 1000,
            "install_size": 2000,
            "treemap": {
                "root": {
                    "name": "app",
                    "size": 0,
                    "path": None,
                    "is_dir": True,
                    "children": [
                        {
                            "name": "main.js",
                            "size": 1000,
                            "path": None,
                            "is_dir": False,
                            "children": [],
                        }
                    ],
                },
                "file_count": 1,
                "category_breakdown": {},
                "platform": "test",
            },
        }
        base_analysis_data = {
            "analysis_duration": 0.4,
            "download_size": 800,
            "install_size": 1500,
            "treemap": {
                "root": {
                    "name": "app",
                    "size": 0,
                    "path": None,
                    "is_dir": True,
                    "children": [
                        {
                            "name": "main.js",
                            "size": 800,
                            "path": None,
                            "is_dir": False,
                            "children": [],
                        }
                    ],
                },
                "file_count": 1,
                "category_breakdown": {},
                "platform": "test",
            },
        }

        # Create size metrics
        head_size_metrics = self._create_size_metrics_with_analysis_file(
            head_artifact, head_analysis_data
        )
        base_size_metrics = self._create_size_metrics_with_analysis_file(
            base_artifact, base_analysis_data
        )

        # Verify no comparison exists before the test
        initial_comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
        )
        assert len(initial_comparisons) == 0

        with patch(
            "sentry.preprod.size_analysis.tasks.create_preprod_status_check_task"
        ) as mock_status_check_task:
            compare_preprod_artifact_size_analysis(
                project_id=self.project.id,
                org_id=self.organization.id,
                artifact_id=head_artifact.id,
            )

            # Verify comparison was created
            comparisons = PreprodArtifactSizeComparison.objects.filter(
                head_size_analysis=head_size_metrics,
                base_size_analysis=base_size_metrics,
            )
            assert len(comparisons) == 1
            comparison = comparisons[0]
            assert comparison.state == PreprodArtifactSizeComparison.State.SUCCESS
            assert comparison.organization_id == self.organization.id
            assert comparison.file_id is not None

            # Should call create_preprod_status_check_task for the head artifact
            mock_status_check_task.apply_async.assert_called_once_with(
                kwargs={"preprod_artifact_id": head_artifact.id}
            )

    def test_compare_preprod_artifact_size_analysis_success_as_base(self):
        """Test compare_preprod_artifact_size_analysis with artifact as base."""
        # Create commit comparisons
        base_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )
        head_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="c" * 40,
            base_sha="a" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        # Create artifacts
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create size analysis data
        analysis_data = {
            "analysis_duration": 0.5,
            "download_size": 1000,
            "install_size": 2000,
            "treemap": {
                "root": {
                    "name": "app",
                    "size": 0,
                    "path": None,
                    "is_dir": True,
                    "children": [
                        {
                            "name": "main.js",
                            "size": 1000,
                            "path": None,
                            "is_dir": False,
                            "children": [],
                        }
                    ],
                },
                "file_count": 1,
                "category_breakdown": {},
                "platform": "test",
            },
        }

        # Create size metrics
        base_size_metrics = self._create_size_metrics_with_analysis_file(
            base_artifact, analysis_data
        )
        head_size_metrics = self._create_size_metrics_with_analysis_file(
            head_artifact, analysis_data
        )

        with patch(
            "sentry.preprod.size_analysis.tasks.create_preprod_status_check_task"
        ) as mock_status_check_task:
            compare_preprod_artifact_size_analysis(
                project_id=self.project.id,
                org_id=self.organization.id,
                artifact_id=base_artifact.id,
            )

            # Verify comparison was created
            comparisons = PreprodArtifactSizeComparison.objects.filter(
                head_size_analysis=head_size_metrics,
                base_size_analysis=base_size_metrics,
            )
            assert len(comparisons) == 1
            comparison = comparisons[0]
            assert comparison.state == PreprodArtifactSizeComparison.State.SUCCESS
            assert comparison.organization_id == self.organization.id
            assert comparison.file_id is not None

            # Should call create_preprod_status_check_task twice:
            # 1. For the base artifact (current artifact)
            # 2. For the head artifact (since should_update_status_check is True)
            assert mock_status_check_task.apply_async.call_count == 2
            calls = mock_status_check_task.apply_async.call_args_list
            # First call should be for the base artifact
            assert calls[0][1]["kwargs"]["preprod_artifact_id"] == base_artifact.id
            # Second call should be for the head artifact
            assert calls[1][1]["kwargs"]["preprod_artifact_id"] == head_artifact.id

    def test_compare_preprod_artifact_size_analysis_no_matching_artifacts(self):
        """Test compare_preprod_artifact_size_analysis with no matching artifacts."""
        # Create commit comparison
        commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        # Create artifact
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        with (
            patch(
                "sentry.preprod.size_analysis.tasks._run_size_analysis_comparison"
            ) as mock_run_comparison,
            patch(
                "sentry.preprod.size_analysis.tasks.create_preprod_status_check_task"
            ) as mock_status_check_task,
        ):
            compare_preprod_artifact_size_analysis(
                project_id=self.project.id,
                org_id=self.organization.id,
                artifact_id=artifact.id,
            )

            # Should not call _run_size_analysis_comparison
            mock_run_comparison.assert_not_called()

            # Should still call create_preprod_status_check_task once for the artifact
            mock_status_check_task.apply_async.assert_called_once_with(
                kwargs={"preprod_artifact_id": artifact.id}
            )

    def test_compare_preprod_artifact_size_analysis_cannot_compare_metrics(self):
        """Test compare_preprod_artifact_size_analysis when metrics cannot be compared."""
        # Create commit comparisons
        head_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )
        base_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        # Create artifacts
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create size metrics with different artifact types (should not be comparable)
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        with (
            patch(
                "sentry.preprod.size_analysis.tasks._run_size_analysis_comparison"
            ) as mock_run_comparison,
            patch(
                "sentry.preprod.size_analysis.tasks.create_preprod_status_check_task"
            ) as mock_status_check_task,
        ):
            compare_preprod_artifact_size_analysis(
                project_id=self.project.id,
                org_id=self.organization.id,
                artifact_id=head_artifact.id,
            )

            # Should not call _run_size_analysis_comparison due to incompatible metrics
            mock_run_comparison.assert_not_called()

            # Should still call create_preprod_status_check_task once for the head artifact
            mock_status_check_task.apply_async.assert_called_once_with(
                kwargs={"preprod_artifact_id": head_artifact.id}
            )

    def test_compare_preprod_artifact_size_analysis_different_build_configurations_as_head(self):
        """Test compare_preprod_artifact_size_analysis with different build configurations when artifact is head."""
        head_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )
        base_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        debug_config = PreprodBuildConfiguration.objects.create(project=self.project, name="debug")
        release_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="release"
        )

        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            build_configuration=debug_config,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            build_configuration=release_config,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        with (
            patch(
                "sentry.preprod.size_analysis.tasks._run_size_analysis_comparison"
            ) as mock_run_comparison,
            patch(
                "sentry.preprod.size_analysis.tasks.create_preprod_status_check_task"
            ) as mock_status_check_task,
        ):
            compare_preprod_artifact_size_analysis(
                project_id=self.project.id,
                org_id=self.organization.id,
                artifact_id=head_artifact.id,
            )

            mock_run_comparison.assert_not_called()

            # Should still call create_preprod_status_check_task once for the head artifact
            mock_status_check_task.apply_async.assert_called_once_with(
                kwargs={"preprod_artifact_id": head_artifact.id}
            )

    def test_compare_preprod_artifact_size_analysis_different_build_configurations_as_base(self):
        """Test compare_preprod_artifact_size_analysis with different build configurations when artifact is base."""
        # Create commit comparison
        base_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )
        head_commit = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="c" * 40,
            base_sha="a" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        # Create build configurations
        debug_config = PreprodBuildConfiguration.objects.create(project=self.project, name="debug")
        release_config = PreprodBuildConfiguration.objects.create(
            project=self.project, name="release"
        )

        # Create artifacts with different build configurations
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=base_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            build_configuration=debug_config,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            commit_comparison=head_commit,
            app_id="com.example.app",
            build_version="1.0.0",
            build_number=1,
            build_configuration=release_config,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        with (
            patch(
                "sentry.preprod.size_analysis.tasks._run_size_analysis_comparison"
            ) as mock_run_comparison,
            patch("sentry.preprod.size_analysis.tasks.logger") as mock_logger,
            patch(
                "sentry.preprod.size_analysis.tasks.create_preprod_status_check_task"
            ) as mock_status_check_task,
        ):
            compare_preprod_artifact_size_analysis(
                project_id=self.project.id,
                org_id=self.organization.id,
                artifact_id=base_artifact.id,
            )

            # Should log different build configurations and not run comparison
            mock_logger.info.assert_called_with(
                "preprod.size_analysis.compare.head_artifact_different_build_configurations",
                extra={"head_artifact_id": head_artifact.id, "base_artifact_id": base_artifact.id},
            )
            mock_run_comparison.assert_not_called()

            # Should still call create_preprod_status_check_task once for the base artifact
            # but not for the head artifact (since should_update_status_check remains False)
            mock_status_check_task.apply_async.assert_called_once_with(
                kwargs={"preprod_artifact_id": base_artifact.id}
            )


class ManualSizeAnalysisComparisonTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _create_size_metrics(self, **kwargs):
        """Helper to create PreprodArtifactSizeMetrics."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            app_id="com.example.app",
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        return PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            **kwargs,
        )

    def test_manual_size_analysis_comparison_success(self):
        """Test manual_size_analysis_comparison with valid metrics."""
        head_size_metrics = self._create_size_metrics()
        base_size_metrics = self._create_size_metrics()

        with patch(
            "sentry.preprod.size_analysis.tasks._run_size_analysis_comparison"
        ) as mock_run_comparison:
            manual_size_analysis_comparison(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_size_metrics.preprod_artifact.id,
                base_artifact_id=base_size_metrics.preprod_artifact.id,
            )

            mock_run_comparison.assert_called_once_with(
                self.organization.id,
                head_size_metrics,
                base_size_metrics,
            )

    def test_manual_size_analysis_comparison_nonexistent_head_metric(self):
        """Test manual_size_analysis_comparison with nonexistent head metric."""
        base_size_metrics = self._create_size_metrics()

        with patch("sentry.preprod.size_analysis.tasks.logger") as mock_logger:
            manual_size_analysis_comparison(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=99999,
                base_artifact_id=base_size_metrics.preprod_artifact.id,
            )

            mock_logger.exception.assert_called_once()
            call_args = mock_logger.exception.call_args
            assert "preprod.size_analysis.compare.manual.head_artifact_not_found" in call_args[0]
            assert call_args[1]["extra"]["head_artifact_id"] == 99999

    def test_manual_size_analysis_comparison_nonexistent_base_metric(self):
        """Test manual_size_analysis_comparison with nonexistent base metric."""
        head_size_metrics = self._create_size_metrics()

        with patch("sentry.preprod.size_analysis.tasks.logger") as mock_logger:
            manual_size_analysis_comparison(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_size_metrics.preprod_artifact.id,
                base_artifact_id=99999,
            )

            mock_logger.exception.assert_called_once()
            call_args = mock_logger.exception.call_args
            assert "preprod.size_analysis.compare.manual.base_artifact_not_found" in call_args[0]
            assert call_args[1]["extra"]["base_artifact_id"] == 99999


class RunSizeAnalysisComparisonTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _create_size_metrics_with_analysis_file(self, analysis_data):
        """Helper to create PreprodArtifactSizeMetrics with analysis file."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            app_id="com.example.app",
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create analysis file
        analysis_file = File.objects.create(
            name=f"size-analysis-{artifact.id}",
            type="preprod.file",
            headers={"Content-Type": "application/json"},
        )
        analysis_file.putfile(BytesIO(json.dumps(analysis_data).encode()))

        # Create size metrics
        return PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=analysis_file.id,
            max_install_size=analysis_data.get("install_size", 1000),
            max_download_size=analysis_data.get("download_size", 500),
        )

    def test_run_size_analysis_comparison_success(self):
        """Test _run_size_analysis_comparison with successful comparison."""
        # Create analysis data
        head_analysis_data = {
            "analysis_duration": 0.5,
            "download_size": 1000,
            "install_size": 2000,
            "treemap": {
                "root": {
                    "name": "app",
                    "size": 0,
                    "path": None,
                    "is_dir": True,
                    "children": [
                        {
                            "name": "main.js",
                            "size": 1000,
                            "path": None,
                            "is_dir": False,
                            "children": [],
                        }
                    ],
                },
                "file_count": 1,
                "category_breakdown": {},
                "platform": "test",
            },
        }
        base_analysis_data = {
            "analysis_duration": 0.4,
            "download_size": 800,
            "install_size": 1500,
            "treemap": {
                "root": {
                    "name": "app",
                    "size": 0,
                    "path": None,
                    "is_dir": True,
                    "children": [
                        {
                            "name": "main.js",
                            "size": 800,
                            "path": None,
                            "is_dir": False,
                            "children": [],
                        }
                    ],
                },
                "file_count": 1,
                "category_breakdown": {},
                "platform": "test",
            },
        }

        # Create size metrics
        head_size_metrics = self._create_size_metrics_with_analysis_file(head_analysis_data)
        base_size_metrics = self._create_size_metrics_with_analysis_file(base_analysis_data)

        # Create existing comparison in PENDING state
        PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.PENDING,
        )

        # Run comparison
        _run_size_analysis_comparison(
            self.organization.id,
            head_size_metrics,
            base_size_metrics,
        )

        # Verify comparison was created
        comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
        )
        assert len(comparisons) == 1
        comparison = comparisons[0]
        assert comparison.state == PreprodArtifactSizeComparison.State.SUCCESS
        assert comparison.organization_id == self.organization.id
        assert comparison.file_id is not None

        # Verify comparison file was created
        comparison_file = File.objects.get(id=comparison.file_id)
        assert comparison_file.type == "size_analysis_comparison.json"
        assert comparison_file.name == str(comparison.id)

        # Verify file content
        file_content = json.loads(comparison_file.getfile().read().decode())
        assert "diff_items" in file_content
        assert "size_metric_diff_item" in file_content

    def test_run_size_analysis_comparison_existing_comparison_processing(self):
        """Test _run_size_analysis_comparison with existing processing comparison."""
        # Create size metrics
        head_size_metrics = self._create_size_metrics_with_analysis_file(
            {"analysis_duration": 0.5, "download_size": 1000, "install_size": 2000}
        )
        base_size_metrics = self._create_size_metrics_with_analysis_file(
            {"analysis_duration": 0.4, "download_size": 800, "install_size": 1500}
        )

        # Create existing comparison in processing state
        existing_comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.PROCESSING,
        )

        with patch("sentry.preprod.size_analysis.tasks.logger") as mock_logger:
            _run_size_analysis_comparison(
                self.organization.id,
                head_size_metrics,
                base_size_metrics,
            )

            # Should log that existing comparison exists
            mock_logger.info.assert_called()
            call_args = mock_logger.info.call_args
            assert "preprod.size_analysis.compare.existing_comparison" in call_args[0]

        # Verify no new comparison was created
        comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
        )
        assert len(comparisons) == 1
        assert comparisons[0].id == existing_comparison.id

    def test_run_size_analysis_comparison_existing_comparison_success(self):
        """Test _run_size_analysis_comparison with existing successful comparison."""
        # Create size metrics
        head_size_metrics = self._create_size_metrics_with_analysis_file(
            {"analysis_duration": 0.5, "download_size": 1000, "install_size": 2000}
        )
        base_size_metrics = self._create_size_metrics_with_analysis_file(
            {"analysis_duration": 0.4, "download_size": 800, "install_size": 1500}
        )

        # Create existing comparison in success state
        existing_comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
            organization_id=self.organization.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        with patch("sentry.preprod.size_analysis.tasks.logger") as mock_logger:
            _run_size_analysis_comparison(
                self.organization.id,
                head_size_metrics,
                base_size_metrics,
            )

            # Should log that existing comparison exists
            mock_logger.info.assert_called()
            call_args = mock_logger.info.call_args
            assert "preprod.size_analysis.compare.existing_comparison" in call_args[0]

        # Verify no new comparison was created
        comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
        )
        assert len(comparisons) == 1
        assert comparisons[0].id == existing_comparison.id

    def test_run_size_analysis_comparison_missing_head_analysis_file(self):
        """Test _run_size_analysis_comparison with missing head analysis file."""
        # Create size metrics without analysis file
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            app_id="com.example.app",
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        head_size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=99999,  # Nonexistent file
        )

        base_size_metrics = self._create_size_metrics_with_analysis_file(
            {"analysis_duration": 0.4, "download_size": 800, "install_size": 1500}
        )

        _run_size_analysis_comparison(
            self.organization.id,
            head_size_metrics,
            base_size_metrics,
        )

        # Verify failed comparison was created
        comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
        )
        assert len(comparisons) == 1
        assert comparisons[0].state == PreprodArtifactSizeComparison.State.FAILED

    def test_run_size_analysis_comparison_missing_base_analysis_file(self):
        """Test _run_size_analysis_comparison with missing base analysis file."""
        head_size_metrics = self._create_size_metrics_with_analysis_file(
            {"analysis_duration": 0.5, "download_size": 1000, "install_size": 2000}
        )

        # Create size metrics without analysis file
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            app_id="com.example.app",
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        base_size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=99999,  # Nonexistent file
        )

        _run_size_analysis_comparison(
            self.organization.id,
            head_size_metrics,
            base_size_metrics,
        )

        # Verify failed comparison was created
        comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
        )
        assert len(comparisons) == 1
        assert comparisons[0].state == PreprodArtifactSizeComparison.State.FAILED

    def test_run_size_analysis_comparison_invalid_json(self):
        """Test _run_size_analysis_comparison with invalid JSON in analysis files."""
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            app_id="com.example.app",
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            app_id="com.example.app",
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        # Create analysis files with invalid JSON
        head_analysis_file = File.objects.create(
            name=f"size-analysis-{head_artifact.id}",
            type="preprod.file",
            headers={"Content-Type": "application/json"},
        )
        head_analysis_file.putfile(BytesIO(b"invalid json"))

        base_analysis_file = File.objects.create(
            name=f"size-analysis-{base_artifact.id}",
            type="preprod.file",
            headers={"Content-Type": "application/json"},
        )
        base_analysis_file.putfile(BytesIO(b"invalid json"))

        # Create size metrics
        head_size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=head_analysis_file.id,
        )
        base_size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=base_analysis_file.id,
        )

        _run_size_analysis_comparison(
            self.organization.id,
            head_size_metrics,
            base_size_metrics,
        )

        # Verify failed comparison was created
        comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis=head_size_metrics,
            base_size_analysis=base_size_metrics,
        )
        assert len(comparisons) == 1
        assert comparisons[0].state == PreprodArtifactSizeComparison.State.FAILED

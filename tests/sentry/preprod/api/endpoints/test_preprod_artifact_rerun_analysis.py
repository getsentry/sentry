from unittest.mock import patch

from sentry.models.files.file import File
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.testutils.cases import APITestCase


class BaseRerunAnalysisTest(APITestCase):
    """Base class with shared test logic for rerun analysis endpoints"""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

    def create_artifact_with_metrics(self):
        """Creates an artifact with size metrics and comparisons"""
        main_file = File.objects.create(name="test_artifact.zip", type="application/zip")
        artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=main_file.id,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        analysis_file_1 = File.objects.create(name="analysis1.json", type="application/json")
        size_metric_1 = self.create_preprod_artifact_size_metrics(
            artifact,
            analysis_file_id=analysis_file_1.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )

        analysis_file_2 = File.objects.create(name="analysis2.json", type="application/json")
        size_metric_2 = self.create_preprod_artifact_size_metrics(
            artifact,
            analysis_file_id=analysis_file_2.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch_app",
        )

        comparison_file = File.objects.create(name="comparison.json", type="application/json")
        comparison = self.create_preprod_artifact_size_comparison(
            head_size_analysis=size_metric_1,
            base_size_analysis=size_metric_2,
            organization=self.organization,
            file_id=comparison_file.id,
        )

        return artifact, main_file, [analysis_file_1, analysis_file_2, comparison_file], comparison

    def assert_metrics_cleaned_up(self, artifact, analysis_files, comparison):
        """Asserts that old metrics/comparisons are deleted and new PENDING metric created"""
        assert PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact).count() == 1
        new_metric = PreprodArtifactSizeMetrics.objects.get(preprod_artifact=artifact)
        assert new_metric.state == PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING
        assert (
            new_metric.metrics_artifact_type
            == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
        )
        assert new_metric.analysis_file_id is None

        assert not PreprodArtifactSizeComparison.objects.filter(id=comparison.id).exists()
        for analysis_file in analysis_files:
            assert not File.objects.filter(id=analysis_file.id).exists()

    def assert_artifact_reset(self, artifact):
        """Asserts that artifact state is reset"""
        artifact.refresh_from_db()
        assert artifact.state == PreprodArtifact.ArtifactState.UPLOADED
        assert artifact.error_code is None
        assert artifact.error_message is None


class PreprodArtifactRerunAnalysisTest(BaseRerunAnalysisTest):
    endpoint = "sentry-api-0-preprod-artifact-rerun-analysis"
    method = "post"

    def test_rerun_analysis_cleans_up_metrics_and_comparisons(self):
        artifact, main_file, analysis_files, comparison = self.create_artifact_with_metrics()

        response = self.get_success_response(
            self.organization.slug, self.project.slug, artifact.id, status_code=200
        )

        assert response.data["success"] is True
        assert response.data["artifact_id"] == str(artifact.id)
        assert "cleanup_stats" not in response.data

        self.assert_metrics_cleaned_up(artifact, analysis_files, comparison)
        self.assert_artifact_reset(artifact)
        assert File.objects.filter(id=main_file.id).exists()

    def test_rerun_analysis_with_no_metrics(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.FAILED,
            error_code=PreprodArtifact.ErrorCode.ARTIFACT_PROCESSING_ERROR,
            error_message="Test error",
        )

        response = self.get_success_response(
            self.organization.slug, self.project.slug, artifact.id, status_code=200
        )

        assert response.data["success"] is True
        assert PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact).count() == 1
        self.assert_artifact_reset(artifact)

    def test_rerun_analysis_cleans_up_base_comparisons(self):
        artifact1 = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
        )
        artifact2 = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.1",
            build_number=2,
        )

        size_metric_1 = self.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        size_metric_2 = self.create_preprod_artifact_size_metrics(
            artifact2,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        comparison = self.create_preprod_artifact_size_comparison(
            head_size_analysis=size_metric_2,
            base_size_analysis=size_metric_1,
            organization=self.organization,
        )

        self.get_success_response(
            self.organization.slug, self.project.slug, artifact1.id, status_code=200
        )

        assert not PreprodArtifactSizeComparison.objects.filter(id=comparison.id).exists()
        assert PreprodArtifactSizeMetrics.objects.filter(id=size_metric_2.id).exists()


class PreprodArtifactAdminRerunAnalysisTest(BaseRerunAnalysisTest):
    endpoint = "sentry-admin-preprod-artifact-rerun-analysis"
    method = "post"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_staff=True)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

    def get_response(self, *args, **params):
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            return super().get_response(*args, **params)

    def test_rerun_analysis_cleans_up_metrics_and_comparisons(self):
        artifact, main_file, analysis_files, comparison = self.create_artifact_with_metrics()

        response = self.get_success_response(preprod_artifact_id=artifact.id, status_code=200)

        assert response.data["success"] is True
        assert response.data["artifact_id"] == str(artifact.id)
        assert response.data["cleanup_stats"]["size_metrics_total_deleted"] == 2
        assert response.data["cleanup_stats"]["size_comparisons_total_deleted"] == 1
        assert response.data["cleanup_stats"]["files_total_deleted"] == 3

        self.assert_metrics_cleaned_up(artifact, analysis_files, comparison)
        self.assert_artifact_reset(artifact)
        assert File.objects.filter(id=main_file.id).exists()

    def test_rerun_analysis_with_no_metrics(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.FAILED,
            error_code=PreprodArtifact.ErrorCode.ARTIFACT_PROCESSING_ERROR,
            error_message="Test error",
        )

        response = self.get_success_response(preprod_artifact_id=artifact.id, status_code=200)

        assert response.data["success"] is True
        assert response.data["cleanup_stats"]["size_metrics_total_deleted"] == 0
        assert response.data["cleanup_stats"]["size_comparisons_total_deleted"] == 0
        assert response.data["cleanup_stats"]["files_total_deleted"] == 0
        assert PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact).count() == 1
        self.assert_artifact_reset(artifact)

    def test_rerun_analysis_cleans_up_base_comparisons(self):
        artifact1 = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
        )
        artifact2 = self.create_preprod_artifact(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.1",
            build_number=2,
        )

        size_metric_1 = self.create_preprod_artifact_size_metrics(
            artifact1,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        size_metric_2 = self.create_preprod_artifact_size_metrics(
            artifact2,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        comparison = self.create_preprod_artifact_size_comparison(
            head_size_analysis=size_metric_2,
            base_size_analysis=size_metric_1,
            organization=self.organization,
        )

        response = self.get_success_response(preprod_artifact_id=artifact1.id, status_code=200)

        assert response.data["cleanup_stats"]["size_comparisons_total_deleted"] == 1
        assert not PreprodArtifactSizeComparison.objects.filter(id=comparison.id).exists()
        assert PreprodArtifactSizeMetrics.objects.filter(id=size_metric_2.id).exists()

    def test_rerun_analysis_not_found(self):
        response = self.get_error_response(preprod_artifact_id=999999, status_code=404)
        assert "not found" in response.data["error"]

    def test_rerun_analysis_invalid_id(self):
        response = self.get_error_response(preprod_artifact_id="invalid", status_code=400)
        assert (
            "preprod_artifact_id is required and must be a valid integer" in response.data["error"]
        )

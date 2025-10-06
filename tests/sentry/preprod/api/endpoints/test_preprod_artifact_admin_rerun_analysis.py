from unittest.mock import patch

from sentry.models.files.file import File
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.testutils.cases import APITestCase


class PreprodArtifactAdminRerunAnalysisTest(APITestCase):
    endpoint = "sentry-admin-preprod-artifact-rerun-analysis"
    method = "post"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_staff=True)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

    def get_response(self, *args, **params):
        """Mock staff authentication for testing admin endpoints"""
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            return super().get_response(*args, **params)

    def test_rerun_analysis_cleans_up_metrics_and_comparisons(self):
        """Test that rerun analysis deletes size metrics, comparisons, and their files"""
        main_file = File.objects.create(name="test_artifact.zip", type="application/zip")
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=main_file.id,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        analysis_file_1 = File.objects.create(name="analysis1.json", type="application/json")
        size_metric_1 = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            analysis_file_id=analysis_file_1.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )

        analysis_file_2 = File.objects.create(name="analysis2.json", type="application/json")
        size_metric_2 = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            analysis_file_id=analysis_file_2.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch_app",
        )

        comparison_file = File.objects.create(name="comparison.json", type="application/json")

        comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=size_metric_1,
            base_size_analysis=size_metric_2,
            organization_id=self.organization.id,
            file_id=comparison_file.id,
        )

        # Verify everything exists before rerun
        assert PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact).count() == 2
        assert PreprodArtifactSizeComparison.objects.filter(id=comparison.id).exists()
        assert File.objects.filter(id=analysis_file_1.id).exists()
        assert File.objects.filter(id=analysis_file_2.id).exists()
        assert File.objects.filter(id=comparison_file.id).exists()

        response = self.get_success_response(
            preprod_artifact_id=artifact.id,
            status_code=200,
        )

        assert response.data["success"] is True
        assert response.data["artifact_id"] == artifact.id
        assert response.data["new_state"] == PreprodArtifact.ArtifactState.UPLOADED

        cleanup_stats = response.data["cleanup_stats"]
        assert cleanup_stats["size_metrics_total_deleted"] == 2
        assert cleanup_stats["size_comparisons_total_deleted"] == 1
        assert cleanup_stats["files_total_deleted"] == 3  # 2 analysis files + 1 comparison file

        assert PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact).count() == 0
        assert not PreprodArtifactSizeComparison.objects.filter(id=comparison.id).exists()
        assert not File.objects.filter(id=analysis_file_1.id).exists()
        assert not File.objects.filter(id=analysis_file_2.id).exists()
        assert not File.objects.filter(id=comparison_file.id).exists()

        artifact.refresh_from_db()
        assert artifact.state == PreprodArtifact.ArtifactState.UPLOADED
        assert artifact.error_code is None
        assert artifact.error_message is None

        # Verify main artifact file was NOT deleted
        assert File.objects.filter(id=main_file.id).exists()

    def test_rerun_analysis_with_no_metrics(self):
        """Test that rerun analysis works when there are no existing metrics"""
        artifact = PreprodArtifact.objects.create(
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
            preprod_artifact_id=artifact.id,
            status_code=200,
        )

        assert response.data["success"] is True
        assert response.data["cleanup_stats"]["size_metrics_total_deleted"] == 0
        assert response.data["cleanup_stats"]["size_comparisons_total_deleted"] == 0
        assert response.data["cleanup_stats"]["files_total_deleted"] == 0

        artifact.refresh_from_db()
        assert artifact.state == PreprodArtifact.ArtifactState.UPLOADED
        assert artifact.error_code is None
        assert artifact.error_message is None

    def test_rerun_analysis_cleans_up_base_comparisons(self):
        """Test that comparisons where the artifact's metrics are used as base are also deleted"""
        artifact1 = PreprodArtifact.objects.create(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.0",
            build_number=1,
        )
        artifact2 = PreprodArtifact.objects.create(
            project=self.project,
            app_name="test_artifact",
            app_id="com.test.app",
            build_version="1.0.1",
            build_number=2,
        )

        size_metric_1 = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        size_metric_2 = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )

        comparison = PreprodArtifactSizeComparison.objects.create(
            head_size_analysis=size_metric_2,
            base_size_analysis=size_metric_1,  # artifact1 is the base
            organization_id=self.organization.id,
        )

        assert PreprodArtifactSizeComparison.objects.filter(id=comparison.id).exists()

        response = self.get_success_response(
            preprod_artifact_id=artifact1.id,
            status_code=200,
        )

        # Verify the comparison was deleted (since artifact1's metrics were used as base)
        assert response.data["cleanup_stats"]["size_comparisons_total_deleted"] == 1
        assert not PreprodArtifactSizeComparison.objects.filter(id=comparison.id).exists()

        # Verify artifact2's metrics still exist
        assert PreprodArtifactSizeMetrics.objects.filter(id=size_metric_2.id).exists()

    def test_rerun_analysis_not_found(self):
        """Test that rerun analysis returns 404 for non-existent artifact"""
        response = self.get_error_response(
            preprod_artifact_id=999999,
            status_code=404,
        )

        assert "not found" in response.data["error"]

    def test_rerun_analysis_invalid_id(self):
        """Test that rerun analysis returns 400 for invalid artifact ID"""
        response = self.get_error_response(
            preprod_artifact_id="invalid",
            status_code=400,
        )

        assert "Invalid preprod artifact ID" in response.data["error"]

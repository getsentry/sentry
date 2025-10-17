from io import BytesIO

from django.test import override_settings

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import APITestCase


@override_settings(
    SENTRY_FEATURES={
        "organizations:preprod-frontend-routes": True,
        "organizations:preprod-artifact-assemble": True,
    }
)
class ProjectPreprodArtifactSizeAnalysisDownloadEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-artifact-size-analysis-download"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.artifact_file = self.create_file(
            name="test_artifact.apk", type="application/octet-stream"
        )
        self.artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.artifact_file.id,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )

    def test_no_size_metrics_returns_404(self):
        """When no size metrics exist, should return 404"""
        response = self.get_response(self.organization.slug, self.project.slug, self.artifact.id)
        assert response.status_code == 404
        assert response.data["error"] == "Size analysis results not available for this artifact"

    def test_pending_state_returns_200(self):
        """When size metrics exist but are in PENDING state, should return 200 with state info"""
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        response = self.get_response(self.organization.slug, self.project.slug, self.artifact.id)
        assert response.status_code == 200
        assert response.data["state"] == "pending"
        assert response.data["message"] == "Size analysis is still processing"

    def test_processing_state_returns_200(self):
        """When size metrics exist but are in PROCESSING state, should return 200 with state info"""
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        )

        response = self.get_response(self.organization.slug, self.project.slug, self.artifact.id)
        assert response.status_code == 200
        assert response.data["state"] == "processing"
        assert response.data["message"] == "Size analysis is still processing"

    def test_failed_state_returns_422(self):
        """When size metrics failed, should return 422 with error details"""
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR,
            error_message="Test error message",
            analysis_file_id=None,
        )

        response = self.get_response(self.organization.slug, self.project.slug, self.artifact.id)
        assert response.status_code == 422
        assert response.data["state"] == "failed"
        assert response.data["error_code"] == PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR
        assert response.data["error_message"] == "Test error message"

    def test_completed_without_file_returns_500(self):
        """When size metrics is COMPLETED but analysis_file_id is None, should return 500"""
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=None,
        )

        response = self.get_response(self.organization.slug, self.project.slug, self.artifact.id)
        assert response.status_code == 500
        assert response.data["error"] == "Size analysis completed but results are unavailable"

    def test_completed_with_file_returns_200(self):
        """When size metrics is COMPLETED with a file, should return 200 with file content"""
        analysis_file = self.create_file(name="size_analysis.json", type="application/json")
        with BytesIO(b'{"treemap": {"root": {"name": "root", "size": 1000}}}') as file_content:
            analysis_file.putfile(file_content)

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=analysis_file.id,
        )

        response = self.get_response(self.organization.slug, self.project.slug, self.artifact.id)
        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"
        # Read the response content to ensure file is consumed and closed
        _ = (
            b"".join(response.streaming_content)
            if hasattr(response, "streaming_content")
            else response.content
        )

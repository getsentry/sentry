from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.utils import timezone

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import APITestCase


class ProjectPreprodArtifactSizeAnalysisDownloadEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-preprod-artifact-size-analysis-download"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.artifact_file = self.create_file(
            name="test_artifact.apk", type="application/octet-stream"
        )
        self.artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.artifact_file.id,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )

    def test_no_size_metrics_returns_404(self) -> None:
        """When no size metrics exist, should return 404"""
        response = self.get_response(self.organization.slug, self.artifact.id)
        assert response.status_code == 404
        assert response.data["detail"] == "Size analysis results not available for this artifact"

    def test_pending_state_returns_200(self) -> None:
        """When size metrics exist but are in PENDING state, should return 200 with state info"""
        self.create_preprod_artifact_size_metrics(
            self.artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        response = self.get_response(self.organization.slug, self.artifact.id)
        assert response.status_code == 200
        assert response.data["state"] == "pending"
        assert response.data["message"] == "Size analysis is still processing"

    def test_processing_state_returns_200(self) -> None:
        """When size metrics exist but are in PROCESSING state, should return 200 with state info"""
        self.create_preprod_artifact_size_metrics(
            self.artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        )

        response = self.get_response(self.organization.slug, self.artifact.id)
        assert response.status_code == 200
        assert response.data["state"] == "processing"
        assert response.data["message"] == "Size analysis is still processing"

    def test_failed_state_returns_422(self) -> None:
        """When size metrics failed, should return 422 with error details"""
        self.create_preprod_artifact_size_metrics(
            self.artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR,
            error_message="Test error message",
            analysis_file_id=None,
        )

        response = self.get_response(self.organization.slug, self.artifact.id)
        assert response.status_code == 422
        assert response.data["state"] == "failed"
        assert response.data["error_code"] == PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR
        assert response.data["error_message"] == "Test error message"

    def test_completed_without_file_returns_500(self) -> None:
        """When size metrics is COMPLETED but analysis_file_id is None, should return 500"""
        self.create_preprod_artifact_size_metrics(
            self.artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=None,
        )

        response = self.get_response(self.organization.slug, self.artifact.id)
        assert response.status_code == 500
        assert response.data["detail"] == "Size analysis completed but results are unavailable"

    def test_completed_with_missing_file_returns_404(self) -> None:
        """When size metrics is COMPLETED but the File object was deleted, should return 404"""
        deleted_file_id = 999999

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=deleted_file_id,
        )

        response = self.get_response(self.organization.slug, self.artifact.id)
        assert response.status_code == 404
        assert response.data["detail"] == "Analysis file not found"

    def test_same_org_artifact_without_project_access_returns_404(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        limited_user = self.create_user()
        accessible_team = self.create_team(organization=self.organization)
        self.project.add_team(accessible_team)
        self.create_member(
            user=limited_user,
            organization=self.organization,
            teams=[accessible_team],
            has_global_access=False,
        )
        restricted_project = self.create_project(organization=self.organization)
        restricted_artifact_file = self.create_file(
            name="restricted_artifact.apk", type="application/octet-stream"
        )
        restricted_artifact = self.create_preprod_artifact(
            project=restricted_project,
            file_id=restricted_artifact_file.id,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )
        analysis_file = self.create_file(
            name="restricted_size_analysis.json", type="application/json"
        )
        with BytesIO(b'{"treemap": {"root": {"name": "root", "size": 1000}}}') as file_content:
            analysis_file.putfile(file_content)
        self.create_preprod_artifact_size_metrics(
            restricted_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=analysis_file.id,
        )

        self.login_as(limited_user)
        response = self.get_response(self.organization.slug, restricted_artifact.id)

        assert response.status_code == 404

    def test_completed_with_file_returns_200(self) -> None:
        """When size metrics is COMPLETED with a file, should return 200 with file content"""
        analysis_file = self.create_file(name="size_analysis.json", type="application/json")
        with BytesIO(b'{"treemap": {"root": {"name": "root", "size": 1000}}}') as file_content:
            analysis_file.putfile(file_content)

        self.create_preprod_artifact_size_metrics(
            self.artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            analysis_file_id=analysis_file.id,
        )

        response = self.get_response(self.organization.slug, self.artifact.id)
        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"
        # Read the response content to ensure file is consumed and closed
        _ = (
            b"".join(response.streaming_content)
            if hasattr(response, "streaming_content")
            else response.content
        )

    @patch(
        "sentry.preprod.api.endpoints.size_analysis.project_preprod_size_analysis_download.get_size_retention_cutoff"
    )
    def test_returns_404_for_expired_artifact(self, mock_cutoff):
        mock_cutoff.return_value = timezone.now() - timedelta(days=30)
        self.artifact.date_added = timezone.now() - timedelta(days=60)
        self.artifact.save()

        response = self.get_response(self.organization.slug, self.artifact.id)
        assert response.status_code == 404
        assert response.data["detail"] == "This build's size data has expired."

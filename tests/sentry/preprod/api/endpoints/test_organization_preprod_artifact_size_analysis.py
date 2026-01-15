from io import BytesIO

from django.test import override_settings
from django.urls import reverse

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import APITestCase


@override_settings(
    SENTRY_FEATURES={
        "organizations:preprod-frontend-routes": True,
    }
)
class OrganizationPreprodArtifactSizeAnalysisEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.user = self.create_user(email="test@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.api_token = self.create_user_auth_token(
            user=self.user, scope_list=["org:admin", "project:admin"]
        )

        self.artifact_file = self.create_file(
            name="test_artifact.apk", type="application/octet-stream"
        )
        self.artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.artifact_file.id,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.artifact.id
        return reverse(
            "sentry-api-0-organization-preprod-artifact-size-analysis",
            args=[self.org.slug, artifact_id],
        )

    def test_no_size_metrics_returns_404(self):
        """When no size metrics exist, should return 404"""
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 404
        assert response.data["detail"] == "Size analysis results not available for this artifact"

    def test_pending_state_returns_200(self):
        """When size metrics exist but are in PENDING state, should return 200 with state info"""
        self.create_preprod_artifact_size_metrics(
            self.artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 200
        assert response.data["state"] == "pending"
        assert response.data["message"] == "Size analysis is still processing"

    def test_processing_state_returns_200(self):
        """When size metrics exist but are in PROCESSING state, should return 200 with state info"""
        self.create_preprod_artifact_size_metrics(
            self.artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 200
        assert response.data["state"] == "processing"
        assert response.data["message"] == "Size analysis is still processing"

    def test_failed_state_returns_422(self):
        """When size metrics failed, should return 422 with error details"""
        self.create_preprod_artifact_size_metrics(
            self.artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR,
            error_message="Test error message",
            analysis_file_id=None,
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 422
        assert response.data["state"] == "failed"
        assert response.data["error_code"] == PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR
        assert response.data["error_message"] == "Test error message"

    def test_completed_with_file_returns_200(self):
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

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"
        # Read the response content to ensure file is consumed and closed
        _ = (
            b"".join(response.streaming_content)
            if hasattr(response, "streaming_content")
            else response.content
        )

    def test_artifact_not_found(self):
        """When artifact doesn't exist, should return 404"""
        url = self._get_url(artifact_id=999999)
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 404
        assert "not found in organization" in response.data["detail"]

    def test_artifact_in_different_organization(self):
        """When artifact belongs to different organization, should return 404"""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_artifact = self.create_preprod_artifact(
            project=other_project,
            file_id=self.artifact_file.id,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )

        url = self._get_url(artifact_id=other_artifact.id)
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 404
        assert "not found in organization" in response.data["detail"]

    def test_feature_flag_disabled(self):
        """When feature flag is disabled, should return 403"""
        with self.feature({"organizations:preprod-frontend-routes": False}):
            url = self._get_url()
            response = self.client.get(
                url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
            )
            assert response.status_code == 403
            assert response.data["detail"] == "Feature not enabled"

    def test_invalid_artifact_id(self):
        """When artifact ID is not a number, should return 400"""
        url = reverse(
            "sentry-api-0-organization-preprod-artifact-size-analysis",
            args=[self.org.slug, "not-a-number"],
        )
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 400
        assert "Invalid artifact ID" in response.data["detail"]

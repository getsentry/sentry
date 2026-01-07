from django.urls import reverse

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import TestCase


class OrganizationPullRequestSizeAnalysisDownloadEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

        # Create test files
        self.analysis_file = self.create_file(
            name="size_analysis.json",
            type="application/json",
        )

        # Create a preprod artifact
        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        # Create size analysis metrics
        self.size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.preprod_artifact,
            analysis_file_id=self.analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

    def _get_url(self, organization_id_or_slug=None, artifact_id=None):
        org = organization_id_or_slug or self.organization.slug
        artifact = artifact_id or self.preprod_artifact.id
        return reverse(
            "sentry-api-0-organization-pullrequest-size-analysis-download",
            args=[org, artifact],
        )

    def test_size_analysis_download_success(self) -> None:
        with self.feature("organizations:pr-page"):
            url = self._get_url()
            response = self.client.get(url)

            assert response.status_code == 200
            assert response["Content-Type"] == "application/json"
            assert response["Content-Length"] == str(self.analysis_file.size)

    def test_size_analysis_download_feature_not_enabled(self) -> None:
        # Test without the feature flag
        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 403
        assert response.json()["detail"] == "Feature not enabled"

    def test_size_analysis_download_artifact_not_found(self) -> None:
        with self.feature("organizations:pr-page"):
            url = self._get_url(artifact_id=999999)
            response = self.client.get(url)

            assert response.status_code == 404
            assert "The requested preprod artifact does not exist" in response.json()["detail"]

    def test_size_analysis_download_invalid_artifact_id(self) -> None:
        with self.feature("organizations:pr-page"):
            url = self._get_url(artifact_id="invalid-id")
            response = self.client.get(url)

            assert response.status_code == 404
            assert "The requested preprod artifact does not exist" in response.json()["detail"]

    def test_size_analysis_download_artifact_from_different_organization(self) -> None:
        # Create another organization and artifact
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)
        other_artifact = PreprodArtifact.objects.create(
            project=other_project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        with self.feature("organizations:pr-page"):
            # Try to access artifact from different org
            url = self._get_url(artifact_id=other_artifact.id)
            response = self.client.get(url)

            assert response.status_code == 404
            assert "The requested preprod artifact does not exist" in response.json()["detail"]

    def test_size_analysis_download_no_size_metrics(self) -> None:
        # Create artifact without size metrics
        artifact_without_metrics = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        with self.feature("organizations:pr-page"):
            url = self._get_url(artifact_id=artifact_without_metrics.id)
            response = self.client.get(url)

            assert response.status_code == 404
            assert (
                response.json()["detail"] == "Size analysis results not available for this artifact"
            )

    def test_size_analysis_download_multiple_size_metrics_same_file(self) -> None:
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.preprod_artifact,
            analysis_file_id=self.analysis_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        with self.feature("organizations:pr-page"):
            url = self._get_url()
            response = self.client.get(url)

            assert response.status_code == 200
            assert response["Content-Type"] == "application/json"

    def test_size_analysis_download_multiple_different_files(self) -> None:
        other_file = self.create_file(
            name="other_analysis.json",
            type="application/json",
        )
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.preprod_artifact,
            analysis_file_id=other_file.id,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        with self.feature("organizations:pr-page"):
            url = self._get_url()
            response = self.client.get(url)

            assert response.status_code == 409
            assert (
                response.json()["detail"]
                == "Multiple size analysis results found for this artifact"
            )

    def test_size_analysis_download_no_analysis_file(self) -> None:
        artifact_no_file = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact_no_file,
            analysis_file_id=None,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

        with self.feature("organizations:pr-page"):
            url = self._get_url(artifact_id=artifact_no_file.id)
            response = self.client.get(url)

            assert response.status_code == 500
            assert (
                response.json()["detail"] == "Size analysis completed but results are unavailable"
            )

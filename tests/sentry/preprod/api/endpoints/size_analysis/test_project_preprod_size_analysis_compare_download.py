from django.test import override_settings
from django.urls import reverse

from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.testutils.cases import TestCase


@override_settings(SENTRY_FEATURES={"organizations:preprod-frontend-routes": True})
class ProjectPreprodArtifactSizeAnalysisCompareDownloadEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

        self.head_file = self.create_file(
            name="head_size_analysis.json",
            type="application/json",
        )
        self.base_file = self.create_file(
            name="base_size_analysis.json",
            type="application/json",
        )
        self.comparison_file = self.create_file(
            name="size_comparison.json",
            type="application/json",
        )

        self.head_artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        self.base_artifact = self.create_preprod_artifact(
            project=self.project,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        self.head_size_metrics = self.create_preprod_artifact_size_metrics(
            self.head_artifact,
            analysis_file_id=self.head_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )
        self.base_size_metrics = self.create_preprod_artifact_size_metrics(
            self.base_artifact,
            analysis_file_id=self.base_file.id,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        )

    def _get_url(
        self,
        organization_id_or_slug=None,
        project_id_or_slug=None,
        head_size_metric_id=None,
        base_size_metric_id=None,
    ):
        org = organization_id_or_slug or self.organization.slug
        proj = project_id_or_slug or self.project.slug
        head_id = head_size_metric_id or self.head_size_metrics.id
        base_id = base_size_metric_id or self.base_size_metrics.id
        return reverse(
            "sentry-api-0-project-preprod-artifact-size-analysis-compare-download",
            args=[org, proj, head_id, base_id],
        )

    def test_download_size_analysis_comparison_success(self) -> None:
        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=self.head_size_metrics,
            base_size_analysis=self.base_size_metrics,
            file_id=self.comparison_file.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"
        assert response["Content-Length"] == str(self.comparison_file.size)

    def test_download_size_analysis_comparison_not_found(self) -> None:
        # Use non-existent size metric IDs
        url = self._get_url(head_size_metric_id=999999, base_size_metric_id=888888)
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.json()["detail"] == "Comparison not found."

    def test_download_size_analysis_comparison_no_file_id(self) -> None:
        # Create a comparison without a file_id
        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=self.head_size_metrics,
            base_size_analysis=self.base_size_metrics,
            file_id=None,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.json()["detail"] == "Comparison not found."

    def test_download_size_analysis_comparison_file_not_found(self) -> None:
        # Create a comparison with a non-existent file_id
        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=self.head_size_metrics,
            base_size_analysis=self.base_size_metrics,
            file_id=999999,  # Non-existent file ID
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.json()["detail"] == "Comparison not found."

    def test_download_size_analysis_comparison_file_retrieval_failure(self) -> None:
        failing_file = self.create_file(
            name="failing_comparison.json",
            type="application/json",
        )
        failing_file.delete()

        self.create_preprod_artifact_size_comparison(
            organization=self.organization,
            head_size_analysis=self.head_size_metrics,
            base_size_analysis=self.base_size_metrics,
            file_id=failing_file.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.json()["detail"] == "Comparison not found."

    def test_download_size_analysis_comparison_different_organization(self) -> None:
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_org)
        self.login_as(user=other_user)

        url = self._get_url(
            organization_id_or_slug=other_org.slug, project_id_or_slug=other_project.slug
        )
        response = self.client.get(url)

        # Should still return 404 because the comparison doesn't exist for this organization
        assert response.status_code == 404
        assert response.json()["detail"] == "Comparison not found."

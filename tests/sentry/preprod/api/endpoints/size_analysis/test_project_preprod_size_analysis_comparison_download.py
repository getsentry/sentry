from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics
from sentry.testutils.cases import TestCase


class ProjectPreprodArtifactSizeAnalysisCompareDownloadEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()

        # Create test files
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

        # Create size analysis metrics
        self.head_size_metrics = PreprodArtifactSizeMetrics.objects.create(
            organization_id=self.organization.id,
            file_id=self.head_file.id,
        )
        self.base_size_metrics = PreprodArtifactSizeMetrics.objects.create(
            organization_id=self.organization.id,
            file_id=self.base_file.id,
        )

        # Create a size comparison with a file
        self.size_comparison = PreprodArtifactSizeComparison.objects.create(
            organization_id=self.organization.id,
            head_size_analysis=self.head_size_metrics,
            base_size_analysis=self.base_size_metrics,
            file_id=self.comparison_file.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
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
        return f"/api/0/{org}/{proj}/preprodartifacts/size-analysis/compare/{head_id}/{base_id}/download/"

    def test_download_size_analysis_comparison_success(self) -> None:
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
        PreprodArtifactSizeComparison.objects.create(
            organization_id=self.organization.id,
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
        PreprodArtifactSizeComparison.objects.create(
            organization_id=self.organization.id,
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
        # Create a file that will fail on getfile()
        failing_file = self.create_file(
            name="failing_comparison.json",
            type="application/json",
        )

        # Mock the file to fail on getfile() by deleting it from storage
        # but keeping the File record
        failing_file.delete_file()

        PreprodArtifactSizeComparison.objects.create(
            organization_id=self.organization.id,
            head_size_analysis=self.head_size_metrics,
            base_size_analysis=self.base_size_metrics,
            file_id=failing_file.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        url = self._get_url()
        response = self.client.get(url)

        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to retrieve size analysis comparison."

    def test_download_size_analysis_comparison_different_organization(self) -> None:
        # Create a comparison for a different organization
        other_org = self.create_organization()
        PreprodArtifactSizeComparison.objects.create(
            organization_id=other_org.id,
            head_size_analysis=self.head_size_metrics,
            base_size_analysis=self.base_size_metrics,
            file_id=self.comparison_file.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        url = self._get_url()
        response = self.client.get(url)

        # Should still return 404 because the comparison doesn't exist for this organization
        assert response.status_code == 404
        assert response.json()["detail"] == "Comparison not found."

    def test_download_size_analysis_comparison_requires_authentication(self) -> None:
        # Test that the endpoint requires authentication
        url = self._get_url()

        # Make request without authentication
        self.client.logout()
        response = self.client.get(url)

        assert response.status_code == 401

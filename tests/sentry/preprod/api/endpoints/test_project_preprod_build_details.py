from django.urls import reverse

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import APITestCase


class ProjectPreprodBuildDetailsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user(email="test@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.api_token = self.create_user_auth_token(
            user=self.user, scope_list=["org:admin", "project:admin"]
        )

        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.org.id,
            head_sha="1234567890098765432112345678900987654321",
            base_sha="9876543210012345678998765432100123456789",
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/xyz",
            base_ref="main",
            pr_number=123,
        )

        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            app_name="TestApp",
            build_version="1.0.0",
            build_number=42,
            build_configuration=None,
            installable_app_file_id=1234,
            commit_comparison=commit_comparison,
        )

        # Enable the feature flag for all tests by default
        self.feature_context = self.feature({"organizations:preprod-frontend-routes": True})
        self.feature_context.__enter__()

    def tearDown(self) -> None:
        # Exit the feature flag context manager
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return reverse(
            "sentry-api-0-project-preprod-artifact-build-details",
            args=[self.org.slug, self.project.slug, artifact_id],
        )

    def test_get_build_details_success(self) -> None:
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["state"] == self.preprod_artifact.state
        assert resp_data["app_info"]["app_id"] == self.preprod_artifact.app_id
        assert resp_data["app_info"]["name"] == self.preprod_artifact.app_name
        assert resp_data["app_info"]["version"] == self.preprod_artifact.build_version
        assert resp_data["app_info"]["build_number"] == self.preprod_artifact.build_number
        assert resp_data["app_info"]["artifact_type"] == self.preprod_artifact.artifact_type

    def test_get_build_details_not_found(self) -> None:
        url = self._get_url(artifact_id=999999)
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 404
        assert "The requested head preprod artifact does not exist" in response.json()["detail"]

    def test_get_build_details_feature_flag_disabled(self) -> None:
        with self.feature({"organizations:preprod-frontend-routes": False}):
            url = self._get_url()
            response = self.client.get(
                url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
            )
            assert response.status_code == 403
            assert response.json()["error"] == "Feature not enabled"

    def test_get_build_details_dates_and_types(self) -> None:
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 200
        resp_data = response.json()
        # Check that date fields are present and are ISO strings
        assert "date_added" in resp_data["app_info"]
        assert "date_built" in resp_data["app_info"]
        # Should be ISO format or None
        if resp_data["app_info"]["date_added"]:
            assert "T" in resp_data["app_info"]["date_added"]
        if resp_data["app_info"]["date_built"]:
            assert "T" in resp_data["app_info"]["date_built"]
        # artifact_type is int
        assert isinstance(resp_data["app_info"]["artifact_type"], int)

    def test_get_build_details_vcs_info(self) -> None:
        self.preprod_artifact.save()

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["vcs_info"]["head_sha"] == "1234567890098765432112345678900987654321"
        assert resp_data["vcs_info"]["base_sha"] == "9876543210012345678998765432100123456789"
        assert resp_data["vcs_info"]["provider"] == "github"
        assert resp_data["vcs_info"]["head_repo_name"] == "owner/repo"
        assert resp_data["vcs_info"]["base_repo_name"] == "owner/repo"
        assert resp_data["vcs_info"]["head_ref"] == "feature/xyz"
        assert resp_data["vcs_info"]["base_ref"] == "main"
        assert resp_data["vcs_info"]["pr_number"] == 123

    def test_size_info_pending(self) -> None:
        """Test that pending size analysis returns SizeInfoPending."""
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["size_info"] is not None
        assert resp_data["size_info"]["state"] == 0
        assert "install_size_bytes" not in resp_data["size_info"]
        assert "download_size_bytes" not in resp_data["size_info"]

    def test_size_info_processing(self) -> None:
        """Test that processing size analysis returns SizeInfoProcessing."""
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["size_info"] is not None
        assert (
            resp_data["size_info"]["state"]
            == PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
        )
        assert "install_size_bytes" not in resp_data["size_info"]
        assert "download_size_bytes" not in resp_data["size_info"]

    def test_size_info_completed(self) -> None:
        """Test that completed size analysis returns SizeInfoComplete with data."""
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=1024000,
            max_download_size=512000,
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["size_info"] is not None
        assert resp_data["size_info"]["state"] == 2
        assert resp_data["size_info"]["install_size_bytes"] == 1024000
        assert resp_data["size_info"]["download_size_bytes"] == 512000

    def test_size_info_failed(self) -> None:
        """Test that failed size analysis returns SizeInfoFailed."""
        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=self.preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
            error_code=1,
            error_message="Analysis failed due to invalid artifact",
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["size_info"] is not None
        assert resp_data["size_info"]["state"] == 3
        assert resp_data["size_info"]["error_code"] == 1
        assert resp_data["size_info"]["error_message"] == "Analysis failed due to invalid artifact"

    def test_size_info_none_when_no_metrics(self) -> None:
        """Test that size_info is None when no size metrics exist."""

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["size_info"] is None

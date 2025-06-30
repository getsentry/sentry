from django.test import override_settings

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase


class ProjectPreprodArtifactDownloadEndpointTest(TestCase):
    def setUp(self):
        super().setUp()

        # Create a test file
        self.file = self.create_file(
            name="test_artifact.apk",
            type="application/octet-stream",
        )

        # Create a preprod artifact
        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

    def _get_authenticated_request_headers(self, path, data=b""):
        """Generate the RPC signature authentication headers for the request."""
        signature = generate_service_request_signature(path, data, ["test-secret-key"], "Launchpad")
        return {"HTTP_AUTHORIZATION": f"rpcsignature {signature}"}

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_success(self):
        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.preprod_artifact.id}/"

        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, **headers)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"
        assert "attachment" in response["Content-Disposition"]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_not_found(self):
        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/999999/"

        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, **headers)

        assert response.status_code == 404
        assert "not found" in response.json()["error"]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_not_processed(self):
        # Create an artifact that's not processed yet
        unprocessed_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.UPLOADING,
        )

        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{unprocessed_artifact.id}/"

        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, **headers)

        assert response.status_code == 400
        assert "not ready for download" in response.json()["error"]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_no_file(self):
        # Create an artifact without a file
        no_file_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=None,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{no_file_artifact.id}/"

        headers = self._get_authenticated_request_headers(url)

        with self.feature("organizations:preprod-artifact-assemble"):
            response = self.client.get(url, **headers)

        assert response.status_code == 404
        assert "file not available" in response.json()["error"]

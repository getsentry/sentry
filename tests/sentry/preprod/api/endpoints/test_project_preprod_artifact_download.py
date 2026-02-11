from io import BytesIO

from django.test import override_settings

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.response import close_streaming_response


class ProjectPreprodArtifactDownloadEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()

        # Create a test file
        self.file = self.create_file(
            name="test_artifact.apk",
            type="application/octet-stream",
        )
        self.file.putfile(BytesIO(b"test content for original file"))

        # Create a preprod artifact
        self.preprod_artifact = self.create_preprod_artifact(
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
    def test_download_preprod_artifact_success(self) -> None:
        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.preprod_artifact.id}/"

        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, **headers)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"
        assert "attachment" in response["Content-Disposition"]

        close_streaming_response(response)

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_not_found(self) -> None:
        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/999999/"

        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, **headers)

        assert response.status_code == 404
        assert "The requested head preprod artifact does not exist" in response.json()["detail"]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_no_file(self) -> None:
        # Create an artifact without a file
        no_file_artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=None,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{no_file_artifact.id}/"

        headers = self._get_authenticated_request_headers(url)

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.get(url, **headers)

        assert response.status_code == 404
        assert response.json()["detail"] == "The requested resource does not exist"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_head_preprod_artifact_success(self) -> None:
        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.preprod_artifact.id}/"

        headers = self._get_authenticated_request_headers(url)

        response = self.client.head(url, **headers)

        assert response.status_code == 200
        assert response["Content-Type"] == "application/octet-stream"
        assert response["Content-Length"] == str(self.file.size)
        assert response["Accept-Ranges"] == "bytes"
        assert "attachment" in response["Content-Disposition"]
        assert not response.content

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_with_range_suffix(self) -> None:
        test_content = b"0123456789" * 100
        file_obj = self.create_file(
            name="test_range.bin",
            type="application/octet-stream",
        )
        file_obj.putfile(BytesIO(test_content))

        artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=file_obj.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{artifact.id}/"
        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, HTTP_RANGE="bytes=-10", **headers)

        assert response.status_code == 206
        assert response.content == test_content[-10:]
        assert response["Content-Length"] == "10"
        assert (
            response["Content-Range"]
            == f"bytes {len(test_content)-10}-{len(test_content)-1}/{len(test_content)}"
        )

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_with_range_bounded(self) -> None:
        test_content = b"0123456789" * 100
        file_obj = self.create_file(
            name="test_range.bin",
            type="application/octet-stream",
        )
        file_obj.putfile(BytesIO(test_content))

        artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=file_obj.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{artifact.id}/"
        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, HTTP_RANGE="bytes=5-14", **headers)

        assert response.status_code == 206
        assert response.content == test_content[5:15]
        assert response["Content-Length"] == "10"
        assert response["Content-Range"] == f"bytes 5-14/{len(test_content)}"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_with_range_unbounded(self) -> None:
        test_content = b"0123456789" * 100
        file_obj = self.create_file(
            name="test_range.bin",
            type="application/octet-stream",
        )
        file_obj.putfile(BytesIO(test_content))

        artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=file_obj.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )

        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{artifact.id}/"
        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, HTTP_RANGE="bytes=990-", **headers)

        assert response.status_code == 206
        assert response.content == test_content[990:]
        assert response["Content-Length"] == "10"
        assert response["Content-Range"] == f"bytes 990-{len(test_content)-1}/{len(test_content)}"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_with_invalid_range(self) -> None:
        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.preprod_artifact.id}/"
        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, HTTP_RANGE="bytes=1000-2000", **headers)

        assert response.status_code == 416

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_download_preprod_artifact_with_malformed_range(self) -> None:
        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.preprod_artifact.id}/"
        headers = self._get_authenticated_request_headers(url)

        response = self.client.get(url, HTTP_RANGE="invalid-range-header", **headers)

        assert response.status_code == 416

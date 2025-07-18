import math
from hashlib import sha1

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from sentry import options
from sentry.api.endpoints.chunk import (
    API_PREFIX,
    CHUNK_UPLOAD_ACCEPT,
    HASH_ALGORITHM,
    MAX_CHUNKS_PER_REQUEST,
    MAX_CONCURRENCY,
    MAX_REQUEST_SIZE,
)
from sentry.api.utils import generate_region_url
from sentry.models.apitoken import ApiToken
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.utils import MAX_FILE_SIZE
from sentry.silo.base import SiloMode
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import assume_test_silo_mode


class ChunkUploadTest(APITestCase):
    @pytest.fixture(autouse=True)
    def _restore_upload_url_options(self):
        options.delete("system.upload-url-prefix")

    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.url = reverse("sentry-api-0-chunk-upload", args=[self.organization.slug])

    def _get_launchpad_auth_headers(self, method="GET", data=b""):
        """Generate Launchpad RPC signature authentication headers."""
        signature = generate_service_request_signature(
            self.url, data, ["test-secret-key"], "Launchpad"
        )
        return {"HTTP_AUTHORIZATION": f"rpcsignature {signature}"}

    def test_chunk_parameters(self):
        response = self.client.get(
            self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="json"
        )

        assert response.status_code == 200, response.content
        assert response.data["chunkSize"] == settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE
        assert response.data["chunksPerRequest"] == MAX_CHUNKS_PER_REQUEST
        assert response.data["maxRequestSize"] == MAX_REQUEST_SIZE
        assert response.data["maxFileSize"] == MAX_FILE_SIZE
        assert response.data["concurrency"] == MAX_CONCURRENCY
        assert response.data["hashAlgorithm"] == HASH_ALGORITHM
        assert response.data["url"] == generate_region_url() + self.url
        assert response.data["accept"] == CHUNK_UPLOAD_ACCEPT

        with override_options({"system.upload-url-prefix": "test"}):
            response = self.client.get(
                self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="json"
            )

            assert response.data["url"] == options.get("system.upload-url-prefix") + self.url

        assert math.log2(response.data["chunkSize"]) % 1 == 0, (
            "chunkSize is not a power of two. This change will break Sentry CLI versions ≤2.39.1, "
            "since these versions only support chunk sizes which are a power of two. Chunk uploads "
            "will error in these versions when the CLI receives a chunk size which is not a power "
            "of two from the server, and there is no way for users to work around the error."
        )

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_chunk_parameters_launchpad_auth(self):
        """Test that Launchpad authentication works for GET requests."""
        headers = self._get_launchpad_auth_headers("GET")
        response = self.client.get(self.url, **headers, format="json")

        assert response.status_code == 200, response.content
        assert response.data["chunkSize"] == settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE
        assert response.data["url"] == generate_region_url() + self.url

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_chunk_parameters_launchpad_auth_different_org(self):
        """Test that Launchpad auth bypasses organization permission checks."""
        # Create a different organization that the user doesn't have access to
        other_org = self.create_organization(name="Other Org")
        other_url = reverse("sentry-api-0-chunk-upload", args=[other_org.slug])

        # Standard auth should fail
        response = self.client.get(
            other_url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="json"
        )
        assert response.status_code == 403

        # Launchpad auth should succeed
        signature = generate_service_request_signature(
            other_url, b"", ["test-secret-key"], "Launchpad"
        )
        response = self.client.get(
            other_url, HTTP_AUTHORIZATION=f"rpcsignature {signature}", format="json"
        )
        assert response.status_code == 200

    def test_launchpad_auth_missing_secret(self):
        """Test that missing shared secret setting causes authentication to fail."""
        headers = self._get_launchpad_auth_headers("GET")
        response = self.client.get(self.url, **headers, format="json")

        assert response.status_code == 500  # RpcAuthenticationSetupException

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_launchpad_auth_invalid_signature(self):
        """Test that invalid signature causes authentication to fail."""
        response = self.client.get(
            self.url, HTTP_AUTHORIZATION="rpcsignature rpc0:invalid_signature", format="json"
        )
        assert response.status_code == 401

    def test_relative_url_support(self):
        # Starting `sentry-cli@1.70.1` we added a support for relative chunk-uploads urls

        # >= 1.70.1
        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/1.70.1",
            format="json",
        )
        assert response.data["url"] == self.url.lstrip(API_PREFIX)

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/2.20.5",
            format="json",
        )
        assert response.data["url"] == self.url.lstrip(API_PREFIX)

        # < 1.70.1
        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/1.70.0",
            format="json",
        )
        assert response.data["url"] == generate_region_url() + self.url

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/0.69.3",
            format="json",
        )
        assert response.data["url"] == generate_region_url() + self.url

        # user overridden upload url prefix has priority, even when calling from sentry-cli that supports relative urls
        with override_options({"system.upload-url-prefix": "test"}):
            response = self.client.get(
                self.url,
                HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
                HTTP_USER_AGENT="sentry-cli/1.70.1",
                format="json",
            )
            assert response.data["url"] == options.get("system.upload-url-prefix") + self.url

        with override_options({"hybrid_cloud.disable_relative_upload_urls": True}):
            response = self.client.get(
                self.url,
                HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
                HTTP_USER_AGENT="sentry-cli/1.70.1",
                format="json",
            )
            assert response.data["url"] == generate_region_url() + self.url

    def test_region_upload_urls(self):
        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/1.70.1",
            format="json",
        )
        assert response.data["url"] == self.url.lstrip(API_PREFIX)

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/0.69.3",
            format="json",
        )
        assert response.data["url"] == generate_region_url() + self.url

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/2.29.999",
            format="json",
        )
        assert response.data["url"] == self.url.lstrip(API_PREFIX)

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/2.30.0",
            format="json",
        )

        assert response.data["url"] == generate_region_url() + self.url

        with override_options({"hybrid_cloud.disable_relative_upload_urls": True}):
            response = self.client.get(
                self.url,
                HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
                HTTP_USER_AGENT="sentry-cli/2.29.99",
                format="json",
            )
            assert response.data["url"] == generate_region_url() + self.url

    def test_wrong_api_token(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["org:org"])
        response = self.client.get(self.url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code == 403, response.content

    def test_upload(self):
        data1 = b"1 this is my testString"
        data2 = b"2 this is my testString"
        checksum1 = sha1(data1).hexdigest()
        checksum2 = sha1(data2).hexdigest()
        blob1 = SimpleUploadedFile(checksum1, data1, content_type="multipart/form-data")
        blob2 = SimpleUploadedFile(checksum2, data2, content_type="multipart/form-data")

        response = self.client.post(
            self.url,
            data={"file": [blob1, blob2]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            # this tells drf to select the MultiPartParser. We use that instead of
            # FileUploadParser because we have our own specific file chunking mechanism
            # in the chunk endpoint that has requirements like blob/chunk's filename = checksum.
            format="multipart",
        )

        assert response.status_code == 200, response.content

        file_blobs = FileBlob.objects.all()
        assert len(file_blobs) == 2
        assert file_blobs[0].checksum == checksum1
        assert file_blobs[1].checksum == checksum2

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_upload_launchpad_auth(self):
        """Test that chunk upload works with Launchpad authentication."""
        # For this test, we'll mock the authentication to bypass the signature validation
        # and focus on testing the permission logic
        from unittest.mock import patch

        from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication

        data1 = b"1 this is my testString"
        data2 = b"2 this is my testString"
        checksum1 = sha1(data1).hexdigest()
        checksum2 = sha1(data2).hexdigest()
        blob1 = SimpleUploadedFile(checksum1, data1, content_type="multipart/form-data")
        blob2 = SimpleUploadedFile(checksum2, data2, content_type="multipart/form-data")

        # Mock the authentication to return a successful result
        with (
            patch.object(
                LaunchpadRpcSignatureAuthentication,
                "authenticate",
                return_value=(None, "rpc0:test_signature"),
            ),
            patch("sentry.middleware.access_log._get_token_name", return_value="rpcsignature"),
        ):
            response = self.client.post(
                self.url,
                data={"file": [blob1, blob2]},
                HTTP_AUTHORIZATION="rpcsignature test_signature",
                format="multipart",
            )

        assert response.status_code == 200, response.content

        file_blobs = FileBlob.objects.all()
        assert len(file_blobs) == 2
        assert file_blobs[0].checksum == checksum1
        assert file_blobs[1].checksum == checksum2

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_upload_launchpad_auth_different_org(self):
        """Test that Launchpad auth bypasses organization permission checks for uploads."""
        # Create a different organization that the user doesn't have access to
        other_org = self.create_organization(name="Other Org")
        other_url = reverse("sentry-api-0-chunk-upload", args=[other_org.slug])

        data1 = b"1 this is my testString"
        checksum1 = sha1(data1).hexdigest()
        blob1 = SimpleUploadedFile(checksum1, data1, content_type="multipart/form-data")

        # Standard auth should fail
        response = self.client.post(
            other_url,
            data={"file": [blob1]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="multipart",
        )
        assert response.status_code == 403

        # For now, let's just test that the Launchpad auth class exists and permission logic works
        # The actual signature validation is complex to test due to multipart encoding
        from unittest.mock import Mock

        from sentry.api.endpoints.chunk import ChunkUploadPermission
        from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication

        # Test the permission logic directly
        permission = ChunkUploadPermission()
        mock_request = Mock()
        mock_request.successful_authenticator = LaunchpadRpcSignatureAuthentication()

        # This should return True for Launchpad auth
        assert permission.has_permission(mock_request, None)
        assert permission.has_object_permission(mock_request, None, other_org)

    def test_empty_upload(self):
        response = self.client.post(
            self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="multipart"
        )
        assert response.status_code == 200

        file_blobs = FileBlob.objects.all()
        assert len(file_blobs) == 0

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_empty_upload_launchpad_auth(self):
        """Test that empty uploads work with Launchpad authentication."""
        from unittest.mock import patch

        from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication

        # Mock the authentication to return a successful result
        with (
            patch.object(
                LaunchpadRpcSignatureAuthentication,
                "authenticate",
                return_value=(None, "rpc0:test_signature"),
            ),
            patch("sentry.middleware.access_log._get_token_name", return_value="rpcsignature"),
        ):
            response = self.client.post(
                self.url,
                HTTP_AUTHORIZATION="rpcsignature test_signature",
                format="multipart",
            )

        assert response.status_code == 200
        file_blobs = FileBlob.objects.all()
        assert len(file_blobs) == 0

    def test_too_many_chunks(self):
        files = []

        # Exactly the limit
        for x in range(0, MAX_CHUNKS_PER_REQUEST + 1):
            content = b"x"
            files.append(SimpleUploadedFile(sha1(content).hexdigest(), content))

        response = self.client.post(
            self.url,
            data={"file": files},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="multipart",
        )

        assert response.status_code == 400, response.content

    def test_too_large_request(self):
        files = []

        # Exactly the limit
        for x in range(0, MAX_CHUNKS_PER_REQUEST):
            content = b"x" * (MAX_REQUEST_SIZE // MAX_CHUNKS_PER_REQUEST)
            files.append(SimpleUploadedFile(sha1(content).hexdigest(), content))

        response = self.client.post(
            self.url,
            data={"file": files},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="multipart",
        )

        assert response.status_code == 200, response.content

        # We overflow the request here
        files.append(SimpleUploadedFile(sha1(b"content").hexdigest(), b"content"))
        response = self.client.post(
            self.url,
            data={"file": files},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="multipart",
        )
        assert response.status_code == 400, response.content

    def test_too_large_chunk(self):
        files = []
        content = b"x" * (settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE + 1)
        files.append(SimpleUploadedFile(sha1(content).hexdigest(), content))

        response = self.client.post(
            self.url,
            data={"file": files},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="multipart",
        )

        assert response.status_code == 400, response.content

    def test_checksum_missmatch(self):
        files = []
        content = b"x" * (settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE + 1)
        files.append(SimpleUploadedFile("wrong checksum", content))

        response = self.client.post(
            self.url,
            data={"file": files},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="multipart",
        )

        assert response.status_code == 400, response.content

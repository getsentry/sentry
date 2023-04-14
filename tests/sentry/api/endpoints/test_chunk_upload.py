from hashlib import sha1

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry import options
from sentry.api.endpoints.chunk import (
    API_PREFIX,
    HASH_ALGORITHM,
    MAX_CHUNKS_PER_REQUEST,
    MAX_CONCURRENCY,
    MAX_REQUEST_SIZE,
)
from sentry.models import MAX_FILE_SIZE, ApiToken, FileBlob
from sentry.testutils import APITestCase


class ChunkUploadTest(APITestCase):
    @pytest.fixture(autouse=True)
    def _restore_upload_url_options(self):
        options.delete("system.upload-url-prefix")

    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.url = reverse("sentry-api-0-chunk-upload", args=[self.organization.slug])

    def test_chunk_parameters(self):
        response = self.client.get(
            self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="json"
        )

        assert response.status_code == 200, response.content
        assert response.data["chunkSize"] == settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE
        assert response.data["chunksPerRequest"] == MAX_CHUNKS_PER_REQUEST
        assert response.data["maxRequestSize"] == MAX_REQUEST_SIZE
        assert response.data["maxFileSize"] == options.get("system.maximum-file-size")
        assert response.data["concurrency"] == MAX_CONCURRENCY
        assert response.data["hashAlgorithm"] == HASH_ALGORITHM
        assert response.data["url"] == options.get("system.url-prefix") + self.url

        options.set("system.upload-url-prefix", "test")
        response = self.client.get(
            self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="json"
        )

        assert response.data["url"] == options.get("system.upload-url-prefix") + self.url

    def test_accept_with_feature_flag_enabled_and_disabled(self):
        with self.feature({"organizations:artifact-bundles": False}):
            response = self.client.get(
                self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="json"
            )
            assert "artifact_bundles" not in response.data["accept"]

        with self.feature({"organizations:artifact-bundles": True}):
            response = self.client.get(
                self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="json"
            )
            assert "artifact_bundles" in response.data["accept"]

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
            HTTP_USER_AGENT="sentry-cli/2.77.4",
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
        assert response.data["url"] == options.get("system.url-prefix") + self.url

        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/0.69.3",
            format="json",
        )
        assert response.data["url"] == options.get("system.url-prefix") + self.url

        # user overridden upload url prefix has priority, even when calling from sentry-cli that supports relative urls
        options.set("system.upload-url-prefix", "test")
        response = self.client.get(
            self.url,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            HTTP_USER_AGENT="sentry-cli/1.70.1",
            format="json",
        )
        assert response.data["url"] == options.get("system.upload-url-prefix") + self.url

    def test_large_uploads(self):
        with self.feature("organizations:large-debug-files"):
            response = self.client.get(
                self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="json"
            )

        assert response.data["maxFileSize"] == MAX_FILE_SIZE

    def test_wrong_api_token(self):
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

    def test_empty_upload(self):
        response = self.client.post(
            self.url, HTTP_AUTHORIZATION=f"Bearer {self.token.token}", format="multipart"
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
        files.append(SimpleUploadedFile(b"wrong checksum", content))

        response = self.client.post(
            self.url,
            data={"file": files},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="multipart",
        )

        assert response.status_code == 400, response.content

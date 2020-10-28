from __future__ import absolute_import, division

from hashlib import sha1

from django.conf import settings
from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry import options
from sentry.models import ApiToken, FileBlob, MAX_FILE_SIZE
from sentry.testutils import APITestCase
from sentry.api.endpoints.chunk import (
    MAX_CHUNKS_PER_REQUEST,
    MAX_CONCURRENCY,
    HASH_ALGORITHM,
    MAX_REQUEST_SIZE,
)


class ChunkUploadTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.url = reverse("sentry-api-0-chunk-upload", args=[self.organization.slug])

    def test_chunk_parameters(self):
        response = self.client.get(
            self.url, HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token), format="json"
        )

        endpoint = options.get("system.upload-url-prefix")
        # We fallback to default system url if config is not set
        if len(endpoint) == 0:
            endpoint = options.get("system.url-prefix")

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
            self.url, HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token), format="json"
        )

        assert response.data["url"] == options.get("system.upload-url-prefix") + self.url

    def test_large_uploads(self):
        with self.feature("organizations:large-debug-files"):
            response = self.client.get(
                self.url, HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token), format="json"
            )

        assert response.data["maxFileSize"] == MAX_FILE_SIZE

    def test_wrong_api_token(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["org:org"])
        response = self.client.get(self.url, HTTP_AUTHORIZATION=u"Bearer {}".format(token.token))
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
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
            # this tells drf to select the MultiPartParser. We use that instead of
            # FileUploadParser because we have our own specific file chunking mechanism
            # in the chunk endpoint that has requirements like blob/chunk's filename = checksum.
            format="multipart",
        )

        assert response.status_code == 200, response.content

        file_blobs = FileBlob.objects.all()
        assert len(file_blobs) == 2
        checksums = sorted([checksum1, checksum2])
        assert sorted(x.checksum for x in file_blobs) == checksums

    def test_empty_upload(self):
        response = self.client.post(
            self.url, HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token), format="multipart"
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
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
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
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
            format="multipart",
        )

        assert response.status_code == 200, response.content

        # We overflow the request here
        files.append(SimpleUploadedFile(sha1(b"content").hexdigest(), b"content"))
        response = self.client.post(
            self.url,
            data={"file": files},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
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
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
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
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
            format="multipart",
        )

        assert response.status_code == 400, response.content

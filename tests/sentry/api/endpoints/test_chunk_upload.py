from __future__ import absolute_import

from hashlib import sha1

from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry import options
from sentry.models import ApiToken, FileBlob
from sentry.models.file import DEFAULT_BLOB_SIZE
from sentry.testutils import APITestCase
from sentry.api.endpoints.chunk_upload import (MAX_CHUNKS_PER_REQUEST, MAX_CONCURRENCY,
                                               HASH_ALGORITHM)


class ChunkUploadTest(APITestCase):
    def test_chunk_parameters(self):
        token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:releases'],
        )

        url = reverse('sentry-api-0-chunk-upload')
        response = self.client.get(
            url,
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
            format='json'
        )

        endpoint = options.get('system.upload-url-prefix')
        # We fallback to default system url if config is not set
        if len(endpoint) == 0:
            endpoint = options.get('system.url-prefix')

        assert response.status_code == 200, response.content
        assert response.data['chunkSize'] == DEFAULT_BLOB_SIZE
        assert response.data['chunksPerRequest'] == MAX_CHUNKS_PER_REQUEST
        assert response.data['concurrency'] == MAX_CONCURRENCY
        assert response.data['hashAlgorithm'] == HASH_ALGORITHM
        assert response.data['url'] == options.get('system.url-prefix')

        options.set('system.upload-url-prefix', 'test')
        response = self.client.get(
            url,
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
            format='json'
        )

        assert response.data['url'] == options.get('system.upload-url-prefix')

    def test_wrong_api_token(self):
        token = ApiToken.objects.create(
            user=self.user,
        )
        url = reverse('sentry-api-0-chunk-upload')
        response = self.client.get(
            url,
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
        )
        assert response.status_code == 403, response.content

    def test_upload(self):
        token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:releases'],
        )

        string1 = '1 this is my testString'
        string2 = '2 this is my testString'

        checksum1 = sha1(string1).hexdigest()
        checksum2 = sha1(string2).hexdigest()

        url = reverse('sentry-api-0-chunk-upload')
        response = self.client.post(
            url,
            data={
                'file':
                [
                    SimpleUploadedFile(checksum1, string1),
                    SimpleUploadedFile(checksum2, string2)
                ]
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
            format='multipart'
        )

        assert response.status_code == 200, response.content

        file_blobs = FileBlob.objects.all()
        assert len(file_blobs) == 2
        assert file_blobs[0].checksum == checksum1
        assert file_blobs[1].checksum == checksum2

    def test_too_many_chunks(self):
        token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:releases'],
        )

        files = []
        for x in range(0, MAX_CHUNKS_PER_REQUEST + 1):
            content = '%s' % x
            files.append(SimpleUploadedFile(sha1(content).hexdigest(), content))

        url = reverse('sentry-api-0-chunk-upload')
        response = self.client.post(
            url,
            data={
                'file': files
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
            format='multipart'
        )

        assert response.status_code == 400, response.content

    def test_too_large_chunk(self):
        token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:releases'],
        )

        files = []
        content = "x" * (DEFAULT_BLOB_SIZE + 1)
        files.append(SimpleUploadedFile(sha1(content).hexdigest(), content))

        url = reverse('sentry-api-0-chunk-upload')
        response = self.client.post(
            url,
            data={
                'file': files
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
            format='multipart'
        )

        assert response.status_code == 400, response.content

    def test_checksum_missmatch(self):
        token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:releases'],
        )

        files = []
        content = "x" * (DEFAULT_BLOB_SIZE + 1)
        files.append(SimpleUploadedFile('wrong checksum', content))

        url = reverse('sentry-api-0-chunk-upload')
        response = self.client.post(
            url,
            data={
                'file': files
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
            format='multipart'
        )

        assert response.status_code == 400, response.content

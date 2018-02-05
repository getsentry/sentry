from __future__ import absolute_import

from mock import patch
from hashlib import sha1

from django.core.urlresolvers import reverse
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry import options
from sentry.models import ApiToken, FileBlob, File, FileBlobIndex
from sentry.models.file import DEFAULT_BLOB_SIZE, ChunkFileState
from sentry.testutils import APITestCase
from sentry.api.endpoints.chunk import (MAX_CHUNKS_PER_REQUEST, MAX_CONCURRENCY,
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
        assert response.data['url'] == options.get('system.url-prefix') + url

        options.set('system.upload-url-prefix', 'test')
        response = self.client.get(
            url,
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token),
            format='json'
        )

        assert response.data['url'] == options.get('system.upload-url-prefix') + url

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


class ChunkAssembleEndpoint(APITestCase):
    def test_assemble_json_scheme(self):
        token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:releases'],
        )

        url = reverse('sentry-api-0-chunk-assemble')
        response = self.client.post(
            url,
            data={
                'lol': 'test'
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )
        assert response.status_code == 400, response.content

        checksum = sha1('1').hexdigest()
        response = self.client.post(
            url,
            data={
                checksum: 'test'
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            url,
            data={
                checksum: True
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )
        assert response.status_code == 200, response.content

        response = self.client.post(
            url,
            data={
                checksum: {
                    'type': 'dif'
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            url,
            data={
                checksum: {
                    'type': 'dif',
                    'name': 'dif',
                    'chunks': [],
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )
        assert response.status_code == 200, response.content
        assert response.data[checksum]['state'] == ChunkFileState.NOT_FOUND

    def test_assemble_check(self):
        content = 'foo bar'.encode('utf-8')
        fileobj = ContentFile(content)
        file1 = File.objects.create(
            name='baz.js',
            type='default',
            size=7,
        )
        file1.putfile(fileobj, 3)

        checksum = sha1(content).hexdigest()

        token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:releases'],
        )

        url = reverse('sentry-api-0-chunk-assemble')
        response = self.client.post(
            url,
            data={
                checksum: True
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]['state'] == ChunkFileState.OK
        assert response.data[checksum]['missingChunks'] == []

        not_found_checksum = sha1('1').hexdigest()
        response = self.client.post(
            url,
            data={
                not_found_checksum: True
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )

        assert response.status_code == 200, response.content
        assert response.data[not_found_checksum]['state'] == ChunkFileState.NOT_FOUND
        assert response.data[not_found_checksum]['missingChunks'] == []

    @patch('sentry.tasks.assemble.assemble_chunks')
    def test_assemble(self, mock_assemble_chunks):
        content1 = 'foo'.encode('utf-8')
        fileobj1 = ContentFile(content1)
        checksum1 = sha1(content1).hexdigest()

        content2 = 'bar'.encode('utf-8')
        fileobj2 = ContentFile(content2)
        checksum2 = sha1(content2).hexdigest()

        content3 = 'baz'.encode('utf-8')
        fileobj3 = ContentFile(content3)
        checksum3 = sha1(content3).hexdigest()

        total_checksum = sha1(content2 + content1 + content3).hexdigest()

        # Fake checksum to check response
        checksum4 = sha1('1').hexdigest()

        # The order here is on purpose because we check for the order of checksums
        FileBlob.from_file(fileobj1)
        FileBlob.from_file(fileobj3)
        FileBlob.from_file(fileobj2)

        token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:releases'],
        )

        url = reverse('sentry-api-0-chunk-assemble')
        response = self.client.post(
            url,
            data={
                total_checksum: {
                    'type': 'dif',
                    'name': 'test',
                    'chunks': [
                        checksum4, checksum1, checksum3
                    ]
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )
        assert response.status_code == 200, response.content
        assert response.data[total_checksum]['state'] == ChunkFileState.NOT_FOUND
        assert response.data[total_checksum]['missingChunks'] == [checksum4]

        response = self.client.post(
            url,
            data={
                total_checksum: {
                    'type': 'dif',
                    'name': 'test',
                    'chunks': [
                        checksum2, checksum1, checksum3
                    ],
                    'params': {
                        'test': 1
                    }
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(token.token)
        )
        assert response.status_code == 200, response.content
        assert response.data[total_checksum]['state'] == ChunkFileState.CREATED
        assert response.data[total_checksum]['missingChunks'] == []

        file_blob_id_order = [3, 1, 2]

        mock_assemble_chunks.apply_async.assert_called_once_with(
            checksum='1151b375328103094a99201c2ce4788ea3ea11c9',
            file_blob_ids=file_blob_id_order,
            params={
                'test': 1
            },
            file_id=1,
            type='dif'
        )

        file = File.objects.filter(
            id=1,
        ).get()
        file.assemble_from_file_blob_ids(file_blob_id_order, total_checksum)
        assert file.checksum == total_checksum

        file_blob_index = FileBlobIndex.objects.all()
        assert len(file_blob_index) == 3

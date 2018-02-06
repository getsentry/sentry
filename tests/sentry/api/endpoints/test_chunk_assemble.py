from __future__ import absolute_import

from mock import patch
from hashlib import sha1

from django.core.urlresolvers import reverse
from django.core.files.base import ContentFile

from sentry.models import ApiToken, FileBlob, File, FileBlobIndex, FileBlobOwner
from sentry.models.file import ChunkFileState
from sentry.testutils import APITestCase


class ChunkAssembleEndpoint(APITestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.token = ApiToken.objects.create(
            user=self.user,
            scope_list=['project:write'],
        )
        self.url = reverse('sentry-api-0-chunk-assemble', args=[self.organization.slug])

    def test_assemble_json_scheme(self):
        response = self.client.post(
            self.url,
            data={
                'lol': 'test'
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
        )
        assert response.status_code == 400, response.content

        checksum = sha1('1').hexdigest()
        response = self.client.post(
            self.url,
            data={
                checksum: 'test'
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={
                checksum: {
                    'type': 'dif'
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={
                checksum: {
                    'type': 'dif',
                    'name': 'dif',
                    'chunks': [],
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
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

        blobs = FileBlob.objects.all()
        checksums = []
        for blob in blobs:
            checksums.append(blob.checksum)

        # Request to see of file is there
        # file exists but we have no overship for the chunks
        response = self.client.post(
            self.url,
            data={
                checksum: {
                    'type': 'dif',
                    'name': 'dif',
                    'chunks': checksums,
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]['state'] == ChunkFileState.NOT_FOUND
        assert response.data[checksum]['missingChunks'] == checksums

        # Now we add ownership to the blob
        blobs = FileBlob.objects.all()
        for blob in blobs:
            FileBlobOwner.objects.create(
                blob=blob,
                organization=self.organization
            )

        # Request now tells us that everything is alright
        response = self.client.post(
            self.url,
            data={
                checksum: {
                    'type': 'dif',
                    'name': 'dif',
                    'chunks': checksums,
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
        )

        assert response.status_code == 200, response.content
        assert response.data[checksum]['state'] == ChunkFileState.OK
        assert response.data[checksum]['missingChunks'] == []

        not_found_checksum = sha1('1').hexdigest()

        response = self.client.post(
            self.url,
            data={
                not_found_checksum: {
                    'type': 'dif',
                    'name': 'dif',
                    'chunks': [not_found_checksum],
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
        )

        assert response.status_code == 200, response.content
        assert response.data[not_found_checksum]['state'] == ChunkFileState.NOT_FOUND
        assert response.data[not_found_checksum]['missingChunks'] == [not_found_checksum]

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

        # The order here is on purpose because we check for the order of checksums
        bolb1 = FileBlob.from_file(fileobj1)
        FileBlobOwner.objects.get_or_create(
            organization=self.organization,
            blob=bolb1
        )
        bolb3 = FileBlob.from_file(fileobj3)
        FileBlobOwner.objects.get_or_create(
            organization=self.organization,
            blob=bolb3
        )
        bolb2 = FileBlob.from_file(fileobj2)

        # we make a request now but we are missing ownership for chunk 2
        response = self.client.post(
            self.url,
            data={
                total_checksum: {
                    'type': 'dif',
                    'name': 'test',
                    'chunks': [
                        checksum2, checksum1, checksum3
                    ]
                }
            },
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
        )
        assert response.status_code == 200, response.content
        assert response.data[total_checksum]['state'] == ChunkFileState.NOT_FOUND
        assert response.data[total_checksum]['missingChunks'] == [checksum2]

        # we add ownership to chunk 2
        FileBlobOwner.objects.get_or_create(
            organization=self.organization,
            blob=bolb2
        )

        # new request, ownership for all chunks is there but file does not exist yet
        response = self.client.post(
            self.url,
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
            HTTP_AUTHORIZATION='Bearer {}'.format(self.token.token)
        )
        assert response.status_code == 200, response.content
        assert response.data[total_checksum]['state'] == ChunkFileState.CREATED
        assert response.data[total_checksum]['missingChunks'] == []

        file_blob_id_order = [bolb2.id, bolb1.id, bolb3.id]

        mock_assemble_chunks.apply_async.assert_called_once_with(
            kwargs={
                'type': 'dif',
                'params': {
                    'test': 1,
                    'org': self.organization.slug
                },
                'file_id': 1,
                'file_blob_ids': file_blob_id_order,
                'checksum': total_checksum,
            }
        )

        file = File.objects.filter(
            id=1,
        ).get()
        file.assemble_from_file_blob_ids(file_blob_id_order, total_checksum)
        assert file.checksum == total_checksum

        file_blob_index = FileBlobIndex.objects.all()
        assert len(file_blob_index) == 3

from __future__ import absolute_import

from hashlib import sha1

from django.core.files.base import ContentFile

from sentry.testutils import TestCase
from sentry.tasks.assemble import assemble_chunks
from sentry.models import FileBlob, File
from sentry.models.file import ChunkFileState


class AssembleTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[
                self.team],
            organization=self.organization,
            name='foo')

    def test_generic(self):
        content1 = 'foo'.encode('utf-8')
        fileobj1 = ContentFile(content1)

        content2 = 'bar'.encode('utf-8')
        fileobj2 = ContentFile(content2)

        content3 = 'baz'.encode('utf-8')
        fileobj3 = ContentFile(content3)

        total_checksum = sha1(content2 + content1 + content3).hexdigest()

        # The order here is on purpose because we check for the order of checksums
        bolb1 = FileBlob.from_file(fileobj1)
        bolb3 = FileBlob.from_file(fileobj3)
        bolb2 = FileBlob.from_file(fileobj2)

        file = File.objects.create(
            name='test',
            checksum=total_checksum,
            type='chunked',
            headers={'state': ChunkFileState.CREATED}
        )

        file_blob_id_order = [bolb2.id, bolb1.id, bolb3.id]

        assemble_chunks(
            type='generic',
            params={
                'project': self.project.slug,
                'org': self.organization.slug,
            },
            file_id=file.id,
            file_blob_ids=file_blob_id_order,
            checksum=total_checksum,
        )

        file = File.objects.filter(
            id=file.id,
        ).get()

        assert file.headers.get('state') == ChunkFileState.OK

    def test_missing_param(self):
        content1 = 'foo'.encode('utf-8')
        fileobj1 = ContentFile(content1)

        content2 = 'bar'.encode('utf-8')
        fileobj2 = ContentFile(content2)

        content3 = 'baz'.encode('utf-8')
        fileobj3 = ContentFile(content3)

        total_checksum = sha1(content2 + content1 + content3).hexdigest()

        # The order here is on purpose because we check for the order of checksums
        bolb1 = FileBlob.from_file(fileobj1)
        bolb3 = FileBlob.from_file(fileobj3)
        bolb2 = FileBlob.from_file(fileobj2)

        file = File.objects.create(
            name='test',
            checksum=total_checksum,
            type='chunked',
            headers={'state': ChunkFileState.CREATED}
        )

        file_blob_id_order = [bolb2.id, bolb1.id, bolb3.id]

        file = File.objects.create(
            name='test',
            checksum=total_checksum,
            type='chunked',
            headers={'state': ChunkFileState.CREATED}
        )

        assemble_chunks(
            type='dif',
            params={
                'project': self.project.slug,
            },
            file_id=file.id,
            file_blob_ids=file_blob_id_order,
            checksum=total_checksum,
        )

        file = File.objects.filter(
            id=file.id,
        ).get()

        assert file.headers.get('state') == ChunkFileState.ERROR

    def test_wrong_dif(self):
        content1 = 'foo'.encode('utf-8')
        fileobj1 = ContentFile(content1)

        content2 = 'bar'.encode('utf-8')
        fileobj2 = ContentFile(content2)

        content3 = 'baz'.encode('utf-8')
        fileobj3 = ContentFile(content3)

        total_checksum = sha1(content2 + content1 + content3).hexdigest()

        # The order here is on purpose because we check for the order of checksums
        bolb1 = FileBlob.from_file(fileobj1)
        bolb3 = FileBlob.from_file(fileobj3)
        bolb2 = FileBlob.from_file(fileobj2)

        file = File.objects.create(
            name='test',
            checksum=total_checksum,
            type='chunked',
            headers={'state': ChunkFileState.CREATED}
        )

        file_blob_id_order = [bolb2.id, bolb1.id, bolb3.id]

        file = File.objects.create(
            name='test',
            checksum=total_checksum,
            type='chunked',
            headers={'state': ChunkFileState.CREATED}
        )

        assemble_chunks(
            type='dif',
            params={
                'project': self.project.slug,
                'org': self.organization.slug,
            },
            file_id=file.id,
            file_blob_ids=file_blob_id_order,
            checksum=total_checksum,
        )

        file = File.objects.filter(
            id=file.id,
        ).get()

        assert file.headers.get('state') == ChunkFileState.ERROR

    def test_dif(self):
        sym_file = self.load_fixture('crash.sym')
        bolb1 = FileBlob.from_file(ContentFile(sym_file))

        total_checksum = sha1(sym_file).hexdigest()

        file = File.objects.create(
            name='test.sym',
            checksum=total_checksum,
            type='chunked',
            headers={'state': ChunkFileState.CREATED}
        )

        file_blob_id_order = [bolb1.id]

        assemble_chunks(
            type='dif',
            params={
                'project': self.project.slug,
                'org': self.organization.slug,
            },
            file_id=file.id,
            file_blob_ids=file_blob_id_order,
            checksum=total_checksum,
        )

        file = File.objects.filter(
            checksum=total_checksum,
        ).get()

        assert file.headers == {'Content-Type': 'text/x-breakpad'}

from __future__ import absolute_import

from hashlib import sha1

from django.core.files.base import ContentFile

from sentry.testutils import TestCase
from sentry.tasks.assemble import assemble_dif
from sentry.models import FileBlob
from sentry.models.file import ChunkFileState
from sentry.models.dsymfile import get_assemble_status, ProjectDSymFile


class AssembleTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[
                self.team],
            organization=self.organization,
            name='foo')

    def test_wrong_dif(self):
        content1 = 'foo'.encode('utf-8')
        fileobj1 = ContentFile(content1)

        content2 = 'bar'.encode('utf-8')
        fileobj2 = ContentFile(content2)

        content3 = 'baz'.encode('utf-8')
        fileobj3 = ContentFile(content3)

        total_checksum = sha1(content2 + content1 + content3).hexdigest()

        # The order here is on purpose because we check for the order of checksums
        blob1 = FileBlob.from_file(fileobj1)
        blob3 = FileBlob.from_file(fileobj3)
        blob2 = FileBlob.from_file(fileobj2)

        chunks = [blob2.checksum, blob1.checksum, blob3.checksum]

        assemble_dif(
            project_id=self.project.id,
            name='foo.sym',
            checksum=total_checksum,
            chunks=chunks,
        )

        assert get_assemble_status(self.project, total_checksum)[0] == ChunkFileState.ERROR

    def test_dif(self):
        sym_file = self.load_fixture('crash.sym')
        blob1 = FileBlob.from_file(ContentFile(sym_file))
        total_checksum = sha1(sym_file).hexdigest()

        assemble_dif(
            project_id=self.project.id,
            name='crash.sym',
            checksum=total_checksum,
            chunks=[blob1.checksum],
        )

        dif = ProjectDSymFile.objects.filter(
            project=self.project,
            file__checksum=total_checksum,
        ).get()

        assert dif.file.headers == {'Content-Type': 'text/x-breakpad'}

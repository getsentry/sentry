from __future__ import absolute_import

from django.core.files.base import ContentFile

from sentry.models import File, FileBlob
from sentry.testutils import TestCase


class FileBlobTest(TestCase):
    def test_from_file(self):
        fileobj = ContentFile("foo bar")

        my_file1 = FileBlob.from_file(fileobj)

        assert my_file1.path

        my_file2 = FileBlob.from_file(fileobj)
        # deep check
        assert my_file1.id == my_file2.id
        assert my_file1.checksum == my_file2.checksum
        assert my_file1.path == my_file2.path


class FileTest(TestCase):
    def test_blob_conversion(self):
        file1 = File.objects.create(
            path='foo/bar',
            name='baz.js',
            type='default',
            size=100,
            checksum='a' * 40,
        )
        file1.ensure_blob()

        assert file1.blob
        assert file1.blob.path == 'foo/bar'
        assert file1.blob.size == 100
        assert file1.blob.checksum == 'a' * 40

        file2 = File.objects.create(
            path='foo/bar',
            name='baz.js',
            type='default',
            size=100,
            checksum='a' * 40,
        )
        file2.ensure_blob()

        assert file2.blob == file1.blob
        assert file2.blob.path == 'foo/bar'
        assert file2.blob.size == 100
        assert file2.blob.checksum == 'a' * 40

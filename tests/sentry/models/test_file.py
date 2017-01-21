from __future__ import absolute_import

from django.core.files.base import ContentFile

from sentry.models import File, FileBlob
from sentry.testutils import TestCase


class FileBlobTest(TestCase):
    def test_from_file(self):
        fileobj = ContentFile('foo bar'.encode('utf-8'))

        my_file1 = FileBlob.from_file(fileobj)

        assert my_file1.path

        my_file2 = FileBlob.from_file(fileobj)
        # deep check
        assert my_file1.id == my_file2.id
        assert my_file1.checksum == my_file2.checksum
        assert my_file1.path == my_file2.path


class FileTest(TestCase):
    def test_file_handling(self):
        fileobj = ContentFile('foo bar'.encode('utf-8'))
        file1 = File.objects.create(
            name='baz.js',
            type='default',
            size=7,
        )
        results = file1.putfile(fileobj, 3)
        assert len(results) == 3
        assert results[0].offset == 0
        assert results[1].offset == 3
        assert results[2].offset == 6

        fp = None
        with file1.getfile() as fp:
            assert fp.read().decode('utf-8') == 'foo bar'
            fp.seek(2)
            fp.tell() == 2
            assert fp.read().decode('utf-8') == 'o bar'
            fp.seek(0)
            fp.tell() == 0
            assert fp.read().decode('utf-8') == 'foo bar'
            fp.seek(4)
            fp.tell() == 4
            assert fp.read().decode('utf-8') == 'bar'
            fp.seek(1000)
            fp.tell() == 1000

            with self.assertRaises(IOError):
                fp.seek(-1)

        with self.assertRaises(ValueError):
            fp.seek(0)

        with self.assertRaises(ValueError):
            fp.tell()

        with self.assertRaises(ValueError):
            fp.read()

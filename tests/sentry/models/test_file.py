from __future__ import absolute_import

import os

from django.core.files.base import ContentFile

from sentry.models import File, FileBlob
from sentry.testutils import TestCase


class FileBlobTest(TestCase):
    def test_from_file(self):
        fileobj = ContentFile('foo bar'.encode('utf-8'))

        my_file1 = FileBlob.from_file(fileobj)

        assert my_file1.path

        fileobj.seek(0)
        my_file2 = FileBlob.from_file(fileobj)

        # deep check
        assert my_file1.id == my_file2.id
        assert my_file1.checksum == my_file2.checksum
        assert my_file1.path == my_file2.path

    def test_generate_unique_path(self):
        path = FileBlob.generate_unique_path()
        assert path

        parts = path.split('/')
        assert len(parts) == 3
        assert map(len, parts) == [2, 4, 26]

        # Check uniqueness
        path2 = FileBlob.generate_unique_path()
        assert path != path2


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
            assert fp.tell() == 2
            assert fp.read().decode('utf-8') == 'o bar'
            fp.seek(0)
            assert fp.tell() == 0
            assert fp.read().decode('utf-8') == 'foo bar'
            fp.seek(4)
            assert fp.tell() == 4
            assert fp.read().decode('utf-8') == 'bar'
            fp.seek(1000)
            assert fp.tell() == 1000

            with self.assertRaises(IOError):
                fp.seek(-1)

        with self.assertRaises(ValueError):
            fp.seek(0)

        with self.assertRaises(ValueError):
            fp.tell()

        with self.assertRaises(ValueError):
            fp.read()

    def test_multi_chunk_prefetch(self):
        random_data = os.urandom(1 << 25)

        fileobj = ContentFile(random_data)
        file = File.objects.create(
            name='test.bin',
            type='default',
            size=len(random_data),
        )
        file.putfile(fileobj)

        f = file.getfile(prefetch=True)
        assert f.read() == random_data

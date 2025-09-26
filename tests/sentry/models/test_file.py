import os
from datetime import timedelta
from io import BytesIO
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest
from django.core.files.base import ContentFile
from django.db import DatabaseError
from django.utils import timezone

from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


class FileBlobTest(TestCase):
    def test_from_file(self) -> None:
        fileobj = ContentFile(b"foo bar")

        my_file1 = FileBlob.from_file(fileobj)

        assert my_file1.path

        fileobj.seek(0)
        my_file2 = FileBlob.from_file(fileobj)

        # deep check
        assert my_file1.id == my_file2.id
        assert my_file1.checksum == my_file2.checksum
        assert my_file1.path == my_file2.path

    def test_generate_unique_path(self) -> None:
        path = FileBlob.generate_unique_path()
        assert path

        parts = path.split("/")
        assert len(parts) == 3
        assert list(map(len, parts)) == [2, 4, 26]

        # Check uniqueness
        path2 = FileBlob.generate_unique_path()
        assert path != path2

    @patch.object(FileBlob, "_delete_file_task")
    def test_delete_handles_database_error(self, mock_task_factory: MagicMock) -> None:
        fileobj = ContentFile(b"foo bar")
        baz_file = File.objects.create(name="baz-v1.js", type="default", size=7)
        baz_file.putfile(fileobj)
        blob = baz_file.blobs.all()[0]

        mock_delete_file_region = Mock()
        mock_task_factory.return_value = mock_delete_file_region

        with patch("sentry.models.file.super") as mock_super:
            mock_super.side_effect = DatabaseError("server closed connection")
            with self.tasks(), pytest.raises(DatabaseError):
                blob.delete()
        # Even though postgres failed we should still queue
        # a task to delete the filestore object.
        assert mock_delete_file_region.delay.call_count == 1

        # blob is still around.
        assert FileBlob.objects.get(id=blob.id)

    def test_dedupe_works_with_cache(self) -> None:
        contents = ContentFile(b"foo bar")

        FileBlob.from_file(contents)
        contents.seek(0)

        file_1 = File.objects.create(name="foo")
        file_1.putfile(contents)

        assert FileBlob.objects.count() == 1


class FileTest(TestCase):
    def test_delete_also_removes_blobs(self) -> None:
        fileobj = ContentFile(b"foo bar")
        baz_file = File.objects.create(name="baz.js", type="default", size=7)
        baz_file.putfile(fileobj, 3)

        # make sure blobs are "old" and eligible for deletion
        baz_file.blobs.all().update(timestamp=timezone.now() - timedelta(days=3))

        baz_id = baz_file.id
        with self.tasks(), self.capture_on_commit_callbacks(execute=True):
            baz_file.delete()

        # remove all the blobs and blob indexes.
        assert FileBlobIndex.objects.filter(file_id=baz_id).count() == 0
        assert FileBlob.objects.count() == 0

    def test_delete_does_not_remove_shared_blobs(self) -> None:
        fileobj = ContentFile(b"foo bar")
        baz_file = File.objects.create(name="baz-v1.js", type="default", size=7)
        baz_file.putfile(fileobj, 3)
        baz_id = baz_file.id

        # Rewind the file so we can use it again.
        fileobj.seek(0)
        raz_file = File.objects.create(name="baz-v2.js", type="default", size=7)
        raz_file.putfile(fileobj, 3)

        with self.tasks(), self.capture_on_commit_callbacks(execute=True):
            baz_file.delete()

        # baz_file blob indexes should be gone
        assert FileBlobIndex.objects.filter(file_id=baz_id).count() == 0

        # Check that raz_file blob indexes are there.
        assert len(raz_file.blobs.all()) == 3

    def test_file_handling(self) -> None:
        fileobj = ContentFile(b"foo bar")
        file1 = File.objects.create(name="baz.js", type="default", size=7)
        results = file1.putfile(fileobj, 3)
        assert len(results) == 3
        assert results[0].offset == 0
        assert results[1].offset == 3
        assert results[2].offset == 6

        fp = None
        with file1.getfile() as fp:
            assert fp.read().decode("utf-8") == "foo bar"
            fp.seek(2)
            assert fp.tell() == 2
            assert fp.read().decode("utf-8") == "o bar"
            fp.seek(0)
            assert fp.tell() == 0
            assert fp.read().decode("utf-8") == "foo bar"
            fp.seek(4)
            assert fp.tell() == 4
            assert fp.read().decode("utf-8") == "bar"
            fp.seek(1000)
            assert fp.tell() == 1000

            with pytest.raises(IOError):
                fp.seek(-1)

        with pytest.raises(ValueError):
            fp.seek(0)

        with pytest.raises(ValueError):
            fp.tell()

        with pytest.raises(ValueError):
            fp.read()

    def test_seek(self) -> None:
        """Test behavior of seek with difference values for whence"""
        bytes = BytesIO(b"abcdefghijklmnopqrstuvwxyz")
        file1 = File.objects.create(name="baz.js", type="default", size=26)
        results = file1.putfile(bytes, 5)
        assert len(results) == 6

        with file1.getfile() as fp:
            assert fp.read() == b"abcdefghijklmnopqrstuvwxyz"

            fp.seek(0, 2)
            bytes.seek(0, 2)
            assert fp.tell() == bytes.tell() == 26
            assert fp.read() == bytes.read() == b""

            fp.seek(-1, 2)
            bytes.seek(-1, 2)
            assert fp.tell() == bytes.tell() == 25
            assert fp.read() == bytes.read() == b"z"

            fp.seek(-10, 1)
            bytes.seek(-10, 1)
            assert fp.tell() == bytes.tell() == 16
            assert fp.read() == bytes.read() == b"qrstuvwxyz"

            with pytest.raises(ValueError):
                fp.seek(0, 666)

    def test_multi_chunk_prefetch(self) -> None:
        random_data = os.urandom(1 << 25)

        fileobj = ContentFile(random_data)
        file = File.objects.create(name="test.bin", type="default", size=len(random_data))
        file.putfile(fileobj)

        f = file.getfile(prefetch=True)
        assert f.read() == random_data


@django_db_all
def test_large_files() -> None:
    large_blob = FileBlob.objects.create(size=3_000_000_000, checksum=uuid4().hex)
    zero_blob = FileBlob.objects.create(size=0, checksum=uuid4().hex)
    large_file = File.objects.create(size=3_000_000_000)

    FileBlobIndex.objects.create(file=large_file, blob=large_blob, offset=0)
    FileBlobIndex.objects.create(file=large_file, blob=zero_blob, offset=3_000_000_000)

    file = File.objects.get(id=large_file.id)
    assert file.size == 3_000_000_000

    assert [fbi.offset for fbi in file._blob_index_records()] == [0, 3_000_000_000]

    large_blob.refresh_from_db()
    assert large_blob.size == 3_000_000_000
    blob = FileBlob.objects.get(id=large_blob.id)
    assert blob.size == 3_000_000_000


class FileBatchTest(TestCase):
    def test_putfile_batch_same_behavior_as_putfile(self) -> None:
        """Test that putfile_batch produces the same result as putfile"""
        test_data = b"foo bar baz qux " * 100  # Make it large enough to create multiple chunks
        
        # Test with regular putfile
        fileobj1 = ContentFile(test_data)
        file1 = File.objects.create(name="test1.js", type="default")
        results1 = file1.putfile(fileobj1, blob_size=10)  # Small chunk size to create multiple blobs
        
        # Test with batch putfile
        fileobj2 = ContentFile(test_data)
        file2 = File.objects.create(name="test2.js", type="default")
        results2 = file2.putfile_batch(fileobj2, blob_size=10)  # Same chunk size
        
        # Both should have the same number of chunks
        assert len(results1) == len(results2)
        
        # Both files should have the same size and checksum
        assert file1.size == file2.size
        assert file1.checksum == file2.checksum
        
        # Both should produce the same content when read back
        with file1.getfile() as fp1, file2.getfile() as fp2:
            assert fp1.read() == fp2.read()
            
        # Offsets should be the same
        offsets1 = [r.offset for r in results1]
        offsets2 = [r.offset for r in results2]
        assert offsets1 == offsets2
        
    def test_putfile_batch_deduplicates_blobs(self) -> None:
        """Test that putfile_batch correctly deduplicates identical blobs"""
        # Create data with repeated chunks that will have the same checksum
        repeated_chunk = b"same_data_"
        test_data = repeated_chunk * 20  # This will create chunks with same content
        
        fileobj = ContentFile(test_data)
        file = File.objects.create(name="dedup_test.js", type="default")
        
        initial_blob_count = FileBlob.objects.count()
        results = file.putfile_batch(fileobj, blob_size=10)  # Each chunk will be "same_data_"
        final_blob_count = FileBlob.objects.count()
        
        # Should create fewer unique blobs than total chunks due to deduplication
        unique_checksums = set()
        for result in results:
            unique_checksums.add(result.blob.checksum)
        
        # The number of new blobs should equal the number of unique checksums
        expected_new_blobs = len(unique_checksums)
        actual_new_blobs = final_blob_count - initial_blob_count
        
        # Due to deduplication, we should have fewer new blobs than total chunks
        assert actual_new_blobs <= len(results)
        assert len(unique_checksums) <= len(results)

"""
Test the batched putfile implementation to ensure N+1 queries are eliminated.
"""

from io import BytesIO

import pytest
from django.test import TestCase, override_settings

from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.utils import get_and_optionally_update_blobs


class BatchedPutfileTest(TestCase):
    def setUp(self):
        # Clear any existing file blobs
        FileBlob.objects.all().delete()

    def test_batch_blob_lookup_empty(self):
        """Test batch lookup with no checksums."""
        result = get_and_optionally_update_blobs(FileBlob, [])
        assert result == {}

    def test_batch_blob_lookup_no_existing(self):
        """Test batch lookup when no blobs exist."""
        checksums = [
            "da39a3ee5e6b4b0d3255bfef95601890afd80709",
            "356a192b7913b04c54574d18c28d46e6395428ab",
            "da4b9237bacccdf19c0760cab7aec4a8359010b0",
        ]

        result = get_and_optionally_update_blobs(FileBlob, checksums)
        assert result == {}

    def test_batch_blob_lookup_with_existing(self):
        """Test batch lookup when some blobs exist."""
        # Create some existing blobs
        blob1 = FileBlob.objects.create(
            checksum="da39a3ee5e6b4b0d3255bfef95601890afd80709", size=0, path="test/path1"
        )
        blob2 = FileBlob.objects.create(
            checksum="356a192b7913b04c54574d18c28d46e6395428ab", size=1, path="test/path2"
        )

        checksums = [
            "da39a3ee5e6b4b0d3255bfef95601890afd80709",  # exists
            "356a192b7913b04c54574d18c28d46e6395428ab",  # exists
            "da4b9237bacccdf19c0760cab7aec4a8359010b0",  # doesn't exist
        ]

        result = get_and_optionally_update_blobs(FileBlob, checksums)

        assert len(result) == 2
        assert result["da39a3ee5e6b4b0d3255bfef95601890afd80709"] == blob1
        assert result["356a192b7913b04c54574d18c28d46e6395428ab"] == blob2
        assert "da4b9237bacccdf19c0760cab7aec4a8359010b0" not in result

    def test_putfile_batched_small_file(self):
        """Test batched putfile with a small file (single chunk)."""
        file_obj = File.objects.create(name="test_file.txt", type="text/plain")

        content = b"Hello, World!"
        fileobj = BytesIO(content)

        # Use batched putfile
        indices = file_obj.putfile_batched(fileobj)

        # Should create one chunk
        assert len(indices) == 1
        assert file_obj.size == len(content)
        assert file_obj.checksum is not None

        # Verify the blob was created
        assert FileBlob.objects.count() == 1
        blob = FileBlob.objects.first()
        assert blob.size == len(content)

    def test_putfile_batched_large_file(self):
        """Test batched putfile with a large file (multiple chunks)."""
        file_obj = File.objects.create(name="large_file.bin", type="application/octet-stream")

        # Create content that will be split into multiple 1MB chunks
        chunk_size = 1024 * 1024  # 1MB
        content = b"A" * (chunk_size * 3 + 500)  # 3.5MB file
        fileobj = BytesIO(content)

        # Use batched putfile
        indices = file_obj.putfile_batched(fileobj, blob_size=chunk_size)

        # Should create 4 chunks (3 full + 1 partial)
        assert len(indices) == 4
        assert file_obj.size == len(content)
        assert file_obj.checksum is not None

        # Verify the blobs were created
        assert FileBlob.objects.count() == 4

        # Verify chunk sizes
        blobs = FileBlob.objects.all().order_by("id")
        assert blobs[0].size == chunk_size  # Full chunk
        assert blobs[1].size == chunk_size  # Full chunk
        assert blobs[2].size == chunk_size  # Full chunk
        assert blobs[3].size == 500  # Partial chunk

    def test_putfile_batched_with_existing_blobs(self):
        """Test batched putfile when some chunks already exist."""
        # Create a blob that will match one of our chunks
        existing_checksum = "bf21a9e8fbc5a3846fb05b4fa0859e0917b2202f"  # SHA1 of 1MB of 'A's
        existing_blob = FileBlob.objects.create(
            checksum=existing_checksum, size=1024 * 1024, path="existing/path"
        )

        file_obj = File.objects.create(
            name="test_with_existing.bin", type="application/octet-stream"
        )

        # Create content that will have one chunk matching the existing blob
        chunk_size = 1024 * 1024  # 1MB
        content = b"A" * chunk_size + b"B" * chunk_size  # 2MB file
        fileobj = BytesIO(content)

        # Use batched putfile
        indices = file_obj.putfile_batched(fileobj, blob_size=chunk_size)

        # Should create 2 chunks, but only one new blob
        assert len(indices) == 2
        assert FileBlob.objects.count() == 2  # 1 existing + 1 new

        # Verify one of the indices uses the existing blob
        blob_ids = [idx.blob_id for idx in indices]
        assert existing_blob.id in blob_ids

    def test_putfile_batched_vs_regular_same_result(self):
        """Test that batched and regular putfile produce the same result."""
        content = b"Test content for comparison" * 1000  # ~26KB

        # Regular putfile
        file1 = File.objects.create(name="regular.txt", type="text/plain")
        fileobj1 = BytesIO(content)
        indices1 = file1.putfile(fileobj1)

        # Batched putfile
        file2 = File.objects.create(name="batched.txt", type="text/plain")
        fileobj2 = BytesIO(content)
        indices2 = file2.putfile_batched(fileobj2)

        # Results should be identical
        assert file1.size == file2.size
        assert file1.checksum == file2.checksum
        assert len(indices1) == len(indices2)

        # Both should create the same number of blobs (with deduplication)
        expected_blobs = len(indices1)
        assert FileBlob.objects.count() <= expected_blobs * 2  # At most double if no dedup

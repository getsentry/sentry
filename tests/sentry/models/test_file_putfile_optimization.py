import os
from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.base import ContentFile
from django.test import override_settings
from django.test.utils import override_settings

from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.testutils.cases import TestCase


class FilePutfileOptimizationTest(TestCase):
    def test_putfile_batches_blob_queries(self):
        """Test that putfile uses batched queries instead of N+1 queries for blob existence checks."""
        # Create a large enough file that will be split into multiple chunks
        # Using 3KB with 1KB blob size should create 3 blobs
        large_content = b"x" * 3072  # 3KB of data
        fileobj = BytesIO(large_content)
        
        # Create file and use small blob size to force multiple chunks
        file = File.objects.create(name="test.bin", type="default")
        
        with self.assertNumQueries(
            # Expected queries:
            # 1. Initial file save (if commit=True)
            # 2. Batch query to check existing blobs (1 query for all checksums)
            # 3. Batch timestamp update query (if any old blobs exist)
            # 4. Individual blob creation queries (3 for new blobs)
            # 5. Individual blob index creation queries (3 for indexes)
            # Total: 1 + 1 + 0 + 3 + 3 = 8 queries (vs ~12+ in the old N+1 approach)
            8
        ):
            results = file.putfile(fileobj, blob_size=1024)
        
        # Verify the file was properly chunked
        assert len(results) == 3
        assert file.size == 3072
        
        # Verify all chunks were created
        assert len(file.blobs.all()) == 3

    def test_putfile_reuses_existing_blobs(self):
        """Test that putfile reuses existing blobs without additional queries."""
        # Create some content that will be reused
        content = b"reusable content" * 100  # ~1.6KB
        fileobj1 = BytesIO(content)
        fileobj2 = BytesIO(content)
        
        # Create first file - this will create the blobs
        file1 = File.objects.create(name="test1.bin", type="default")
        file1.putfile(fileobj1, blob_size=512)
        
        # Create second file with same content - should reuse blobs
        file2 = File.objects.create(name="test2.bin", type="default")
        
        with self.assertNumQueries(
            # Expected queries:
            # 1. File save
            # 2. Batch query to check existing blobs (finds existing ones)
            # 3. Batch timestamp update for old blobs (if any)
            # 4. Blob index creation queries (for reused blobs)
            # Total should be much less since no new blobs are created
            7  # Adjust based on actual implementation
        ):
            results = file2.putfile(fileobj2, blob_size=512)
        
        # Both files should reference the same blobs
        file1_blobs = set(blob.id for blob in file1.blobs.all())
        file2_blobs = set(blob.id for blob in file2.blobs.all())
        assert file1_blobs == file2_blobs
        
        # But total blob count should remain the same
        total_blobs_expected = len(file1.blobs.all())
        assert FileBlob.objects.count() == total_blobs_expected

    def test_putfile_handles_mixed_existing_and_new_blobs(self):
        """Test that putfile handles a mix of existing and new blobs efficiently."""
        # Create some initial content
        initial_content = b"initial" * 200  # ~1.4KB
        fileobj1 = BytesIO(initial_content)
        
        file1 = File.objects.create(name="initial.bin", type="default")
        file1.putfile(fileobj1, blob_size=512)
        
        # Create mixed content (some overlapping, some new)
        mixed_content = initial_content[:1000] + b"new_content" * 100  # Mix of old and new
        fileobj2 = BytesIO(mixed_content)
        
        file2 = File.objects.create(name="mixed.bin", type="default")
        
        initial_blob_count = FileBlob.objects.count()
        
        with self.assertNumQueries(
            # Should still use batched approach regardless of mix
            10  # Adjust based on actual implementation needs
        ):
            results = file2.putfile(fileobj2, blob_size=512)
        
        # Some blobs should be reused, some new ones created
        final_blob_count = FileBlob.objects.count()
        assert final_blob_count > initial_blob_count
        assert final_blob_count < initial_blob_count + len(results)  # Some reuse occurred

    def test_putfile_empty_file(self):
        """Test that putfile handles empty files correctly."""
        fileobj = BytesIO(b"")
        file = File.objects.create(name="empty.bin", type="default")
        
        with self.assertNumQueries(1):  # Only the file save
            results = file.putfile(fileobj)
        
        assert len(results) == 0
        assert file.size == 0
        assert len(file.blobs.all()) == 0

    def test_putfile_single_chunk(self):
        """Test that putfile works correctly with single chunk files."""
        content = b"small content"
        fileobj = BytesIO(content)
        file = File.objects.create(name="small.bin", type="default")
        
        with self.assertNumQueries(
            # 1. File save
            # 2. Batch blob existence check
            # 3. New blob creation
            # 4. Blob index creation
            4
        ):
            results = file.putfile(fileobj, blob_size=1024)
        
        assert len(results) == 1
        assert file.size == len(content)
        assert len(file.blobs.all()) == 1
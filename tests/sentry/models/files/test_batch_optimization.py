from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.base import ContentFile

from sentry.models.files.file import File
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.models.files.utils import get_and_optionally_update_blobs_batch
from sentry.testutils.cases import TestCase


class BatchOptimizationTest(TestCase):

    def test_get_and_optionally_update_blobs_batch_with_existing_blobs(self):
        """Test that batch blob lookup finds existing blobs correctly."""
        # Create some test blobs
        blob1 = FileBlob.from_file(ContentFile(b"test content 1"))
        blob2 = FileBlob.from_file(ContentFile(b"test content 2"))

        # Test batch lookup with mixed existing/non-existing checksums
        checksums = [blob1.checksum, blob2.checksum, "non_existent_checksum"]
        result = get_and_optionally_update_blobs_batch(FileBlob, checksums)

        # Should find the two existing blobs
        assert len(result) == 2
        assert blob1.checksum in result
        assert blob2.checksum in result
        assert "non_existent_checksum" not in result

        # Verify the correct blobs are returned
        assert result[blob1.checksum].id == blob1.id
        assert result[blob2.checksum].id == blob2.id

    def test_get_and_optionally_update_blobs_batch_empty_input(self):
        """Test batch blob lookup with empty input."""
        result = get_and_optionally_update_blobs_batch(FileBlob, [])
        assert result == {}

    def test_putfile_batch_optimized_creates_correct_structure(self):
        """Test that the optimized putfile creates the same structure as the original."""
        test_content = b"A" * 1500 + b"B" * 1500 + b"C" * 1500  # 3 chunks of 1.5KB each
        blob_size = 1024  # This will create 5 chunks (1024, 1024, 476, 1024, 476)

        # Test with original putfile
        original_file = File.objects.create(name="original.test", type="test")
        original_fileobj = BytesIO(test_content)
        original_results = original_file.putfile(original_fileobj, blob_size=blob_size)

        # Test with optimized putfile
        optimized_file = File.objects.create(name="optimized.test", type="test")
        optimized_fileobj = BytesIO(test_content)
        optimized_results = optimized_file.putfile_batch_optimized(
            optimized_fileobj, blob_size=blob_size
        )

        # Both should have the same structure
        assert len(original_results) == len(optimized_results)
        assert original_file.size == optimized_file.size
        assert original_file.checksum == optimized_file.checksum

        # Verify blob index structure is the same
        original_offsets = [r.offset for r in original_results]
        optimized_offsets = [r.offset for r in optimized_results]
        assert original_offsets == optimized_offsets

    def test_putfile_batch_optimized_reuses_existing_blobs(self):
        """Test that the optimized putfile reuses existing blobs when possible."""
        test_content = b"A" * 1024 + b"B" * 1024  # 2 chunks

        # First, create a file to establish some blobs
        first_file = File.objects.create(name="first.test", type="test")
        first_fileobj = BytesIO(test_content)
        first_file.putfile_batch_optimized(first_fileobj, blob_size=1024)

        initial_blob_count = FileBlob.objects.count()

        # Now create a second file with the same content
        second_file = File.objects.create(name="second.test", type="test")
        second_fileobj = BytesIO(test_content)
        second_file.putfile_batch_optimized(second_fileobj, blob_size=1024)

        # Should not have created new blobs (reused existing ones)
        final_blob_count = FileBlob.objects.count()
        assert initial_blob_count == final_blob_count

        # But should have created new FileBlobIndex entries
        first_indexes = FileBlobIndex.objects.filter(file=first_file).count()
        second_indexes = FileBlobIndex.objects.filter(file=second_file).count()
        assert first_indexes == second_indexes == 2

    def test_putfile_batch_optimized_handles_empty_file(self):
        """Test that the optimized putfile handles empty files correctly."""
        empty_file = File.objects.create(name="empty.test", type="test")
        empty_fileobj = BytesIO(b"")

        results = empty_file.putfile_batch_optimized(empty_fileobj)

        assert len(results) == 0
        assert empty_file.size == 0
        assert empty_file.checksum  # Should have a checksum even for empty files

    @patch("sentry.models.files.abstractfile.get_and_optionally_update_blobs_batch")
    def test_putfile_batch_optimized_reduces_queries(self, mock_batch_check):
        """Test that the optimized putfile reduces database queries."""
        # Mock the batch check to return no existing blobs
        mock_batch_check.return_value = {}

        test_content = b"A" * 1024 + b"B" * 1024 + b"C" * 1024  # 3 chunks

        file = File.objects.create(name="test.file", type="test")
        fileobj = BytesIO(test_content)

        # Call the optimized version
        file.putfile_batch_optimized(fileobj, blob_size=1024)

        # Should have called the batch check exactly once
        mock_batch_check.assert_called_once()

        # The call should have been with all 3 checksums
        call_args = mock_batch_check.call_args[0]
        assert len(call_args[1]) == 3  # 3 chunk checksums

    def test_putfile_batch_optimized_with_mixed_existing_new_blobs(self):
        """Test optimized putfile with a mix of existing and new blobs."""
        # Create content where some chunks will exist and others won't
        chunk1_content = b"A" * 1024
        chunk2_content = b"B" * 1024
        chunk3_content = b"C" * 1024

        # Pre-create blob for chunk1
        existing_blob = FileBlob.from_file(ContentFile(chunk1_content))
        initial_blob_count = FileBlob.objects.count()

        # Create file with all three chunks
        full_content = chunk1_content + chunk2_content + chunk3_content
        file = File.objects.create(name="mixed.test", type="test")
        fileobj = BytesIO(full_content)

        results = file.putfile_batch_optimized(fileobj, blob_size=1024)

        # Should have 3 FileBlobIndex entries
        assert len(results) == 3

        # Should have created 2 new blobs (for chunks 2 and 3)
        final_blob_count = FileBlob.objects.count()
        assert final_blob_count == initial_blob_count + 2

        # First chunk should reuse the existing blob
        first_index = results[0]
        assert first_index.blob.id == existing_blob.id

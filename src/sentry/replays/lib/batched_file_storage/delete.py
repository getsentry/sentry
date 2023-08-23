"""Batched file-part deletion module."""
from __future__ import annotations

import io

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.storage import download_blob, upload_blob


def archive_file_parts(file_parts: list[FilePartModel]) -> None:
    """Bulk archive file-parts."""
    for file_part in file_parts:
        file_part.is_archived = True

    FilePartModel.objects.bulk_update(file_parts, ["is_archived"])


def archive_file_part(file_part: FilePartModel) -> None:
    """Archive a file-part.

    User deletions do not actually need to delete the range. We can keep the range in place and let
    it fall off at the end of the retention-period.
    """
    file_part.is_archived = True
    file_part.save()


def delete_and_zero_file_part(file_part: FilePartModel) -> None:
    """Delete all references to a file-part.

    This function will work regardless of whether the file-part is encrypted or not. The range
    considers the length of the encrypted output.
    """
    message = "File-parts must be archived prior to deletion to prevent concurrent access."
    assert file_part.is_archived, message

    blob_data = download_blob(file_part.filename)
    blob = io.BytesIO(blob_data)

    zero_bytes_in_range(blob, start=file_part.start, length=(file_part.end - file_part.start) + 1)

    # This will reset the TTLs extending the life of the blob. Theoretically, the maximum lifespan
    # of a file is large enough to be considered unbounded. However, by pruning expired file-part
    # models we can cap this lifespan to the retention-period * 2.
    upload_blob(file_part.filename, blob)

    # With the blob data deleted we can safely delete the metadata row. Had we deleted it earlier
    # a failure in blob deletion would have left potentially sensitive data orphaned in blob
    # storage with no way for Sentry to retrieve it.
    #
    # Failure to delete the row does not mean failure to delete the data. The zeroed data has been
    # committed at this step.
    #
    # Concurrent access is possible between the zeroing of the range and the deletion of the row.
    # Zeroed data will likely lead to exceptional behavior in clients and servers. This can be
    # avoided by archiving the file-part in a pre-processing step.
    file_part.delete()


def zero_bytes_in_range(blob: io.BytesIO, start: int, length: int) -> None:
    """Replace every byte within a contiguous range with null bytes."""
    # Move the cursor position to the starting byte. If we called read() this would give us every
    # byte starting from the beginning of our file-part's range.
    blob.seek(start)

    # The "write" method overwrites everything in its path. By specifying a null byte of length
    # `n` we are guaranteeing that the next `n` bytes will be null bytes. The length should be
    # carefully calculated to ensure we do not write into another file-part's range.
    blob.write(b"\x00" * length)

    # Reset the cursor position to the start of the file. This operation is likely performed
    # multiple times by every client library we use until the file is uploaded. However, its good
    # practice to reset these when you're finished. We don't want to make assumptions about what
    # callers will do with this instance.
    blob.seek(0)

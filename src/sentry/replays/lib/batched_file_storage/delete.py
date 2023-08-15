from __future__ import annotations

import io

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.storage import read, save


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


def permanently_delete_file_parts(file_parts: list[FilePartModel]) -> None:
    """Permanently delete a file-part.

    You probably do not want to use this function. If you are trying to handle user-facing deletes
    within your product then you should expose the "archive_file_part" function.

    This function is intended to service GDPR deletes and other use-cases which require data to be
    eagerly deleted. For most cases its okay to let the data expire with the retention-period.
    """
    # The file-parts are archived first to prevent concurrent access.
    archive_file_parts(file_parts)
    _delete_and_zero_file_parts(file_parts)


def _delete_and_zero_file_parts(file_parts: list[FilePartModel]) -> None:
    """Delete and zero many file-parts."""
    for file_part in file_parts:
        _delete_and_zero_file_part(file_part)


def _delete_and_zero_file_part(file_part: FilePartModel) -> None:
    """Delete all references to a file-part.

    This function will work regardless of whether the file-part is encrypted or not. The range
    considers the length of the encrypted output.
    """
    # Store the values necessary to delete the byte-range from the file-part.
    filename = file_part.filename
    start = file_part.start
    end = file_part.end

    # Objects in the blob storage service are immutable. The blob is downloaded in full before
    # being replaced.
    old_file_data = read(filename)

    # The ending byte is the 0-indexed position of the last byte in the sequence. To make the
    # range inclusive we add one. Otherwise we would miss the last byte.
    new_file_data = _overwrite_range(old_file_data, start=start, length=(end - start) + 1)

    # This will reset the TTLs extending the life of the blob. Theoretically, the maximum lifespan
    # of a file is large enough to be considered unbounded. However, by pruning expired file-part
    # models we can cap this lifespan to the retention-period * 2.
    save(filename, new_file_data)

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


def _overwrite_range(blob_data: bytes, start: int, length: int) -> io.BytesIO:
    """Replace every byte within a contiguous range with null bytes."""
    # Wrap the bytes in a familiar file-like interface.
    blob_data = io.BytesIO(blob_data)

    # Move the cursor position to the starting byte. If we called read() this would give us every
    # byte starting from the beginning of our file-part's range.
    blob_data.seek(start)

    # The "write" method overwrites everything in its path. By specifying a null byte of length
    # `n` we are guaranteeing that the next `n` bytes will be null bytes. The length should be
    # carefully calculated to ensure we do not write into another file-part's range.
    blob_data.write(b"\x00" * length)

    # Reset the cursor position to the start of the file. This operation is likely performed
    # multiple times by every client library we use until the file is uploaded. However, its good
    # practice to reset these when you're finished. We don't want to make assumptions about what
    # callers will do with this instance.
    blob_data.seek(0)

    return blob_data

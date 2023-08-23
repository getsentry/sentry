"""Batched file-part creation module."""
from __future__ import annotations

import io
import uuid
from typing import TypedDict

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.storage import upload_blob


class FilePart(TypedDict):
    message: bytes
    key: str


class FilePartRow(TypedDict):
    end: int
    filename: str
    key: str
    start: int


class StagedCommit(TypedDict):
    filename: str
    payload: bytes
    rows: list[FilePartRow]


def create_new_batch(processed_parts: list[FilePart]) -> None:
    """Create a new file batch."""
    # Reduce the accumulated set of processed parts to a single file.  Being sure to store the
    # correct offset values for later retrieval.
    commit = _prepare_file_batch(processed_parts)

    # The file is saved first.  In the event this process can not complete the file may be
    # orphaned in the remote storage provider.  This is considered an acceptable outcome as
    # the file has a hard-coded TTL configured within the bucket.
    #
    # TODO: Could we make the filename deterministic by naming it after the hash of the bytes?
    # I'm wondering what the risk of collision is.  How low does the probability of collision
    # need to be before this is no longer a concern?
    upload_blob(commit["filename"], io.BytesIO(commit["payload"]))

    # Offsets are inserted for tracking in the database.  If these rows are written the data
    # is considered fully committed and the process can complete.
    #
    # Failing after this step means the rows are inserted but the offsets have not been
    # committed.  We should expect duplicate rows to be possible.
    _save_file_part_rows(commit["rows"])


def _prepare_file_batch(parts: list[FilePart]) -> StagedCommit:
    filename = f"90/{uuid.uuid4().hex}"

    payload = b""
    rows: list[FilePartRow] = []
    for part in parts:
        # The current length of the payload is the new starting index value.
        #
        # Consider a length one message is added to an empty payload. The start index is the len
        # of the payload (0) and the ending index is the length of the payload after the message
        # has been appended minus 1 (0). Now assume a second length one message is added. The
        # start index is 1 (which is currently unoccupied). This is the length of the payload
        # prior to the new messages being appended.
        start = len(payload)

        # Simple byte concatenation. No special layouts required to separate different messages.
        payload += part["message"]

        # The ending index is always the length of the payload after the message has been appended
        # minus 1. Minus 1 makes the range exclusive and ensures multiple byte-ranges do not
        # overlap.
        end = len(payload) - 1

        rows.append(
            {
                "end": end,
                "filename": filename,
                "key": part["key"],
                "start": start,
            }
        )

    return {
        "filename": filename,
        "payload": payload,
        "rows": rows,
    }


def _save_file_part_rows(rows: list[FilePartRow]) -> None:
    FilePartModel.objects.bulk_create(
        [
            FilePartModel(
                end=row["end"],
                filename=row["filename"],
                key=row["key"],
                start=row["start"],
                is_archived=False,
            )
            for row in rows
        ]
    )

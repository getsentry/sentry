"""Batched file creation module."""
from __future__ import annotations

import base64
import io
import uuid
from typing import TypedDict

from django.conf import settings

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.storage import save
from sentry.utils.crypt_envelope import envelope_encrypt


class RawFilePart(TypedDict):
    message: bytes
    key: str


class FilePart(TypedDict):
    dek: bytes | None
    message: bytes
    kek: bytes | None
    key: str


class FilePartRow(TypedDict):
    end: int
    dek: str | None
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
    save(commit["filename"], io.BytesIO(commit["payload"]))

    # Offsets are inserted for tracking in the database.  If these rows are written the data
    # is considered fully committed and the process can complete.
    _save_file_part_rows(commit["rows"])


def process_pending_file_part(part: RawFilePart) -> FilePart:
    if settings.REPLAYS_ENCRYPT_FILE_PART:
        # Envelope encrypt the recording segment.
        #
        # Encryption is performed to provide guarantees around deletion semantics. Encrypting the
        # message allows us to quickly delete the encryption key (rendering the object functionally
        # deleted) without requiring us to delete the blob in the remote storage provider.
        #
        # Specific to the replays use case, a 90-day TTL is applied to _all_ blobs regardless of
        # retention period.
        kek = settings.REPLAYS_KEK
        dek, message = envelope_encrypt(kek, part["message"])
    else:
        dek = None
        kek = None
        message = part["message"]

    # Return a staged recording segment object.
    return {
        "key": part["key"],
        "kek": kek,
        "dek": dek,
        "message": message,
    }


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

        # Data encryption keys are optionally provided depending on if the message is encrypted or
        # not.
        if part["dek"] is not None:
            dek = base64.b64encode(part["dek"]).decode("utf-8")
        else:
            dek = None

        rows.append(
            {
                "dek": dek,
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
                dek=row["dek"],
                end=row["end"],
                filename=row["filename"],
                key=row["key"],
                start=row["start"],
            )
            for row in rows
        ]
    )

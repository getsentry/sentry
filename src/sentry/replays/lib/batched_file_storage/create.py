"""Batched file-part creation module."""
from __future__ import annotations

import base64
import io
import uuid
from typing import TypedDict

from django.conf import settings

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.storage import upload_blob
from sentry.utils.crypt_envelope import envelope_encrypt


class RawFilePart(TypedDict):
    message: bytes
    key: str


class FilePart(TypedDict):
    dek: str | None
    message: bytes
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


def process_raw_file_part(part: RawFilePart) -> FilePart:
    # Encryption is an optional process.
    #
    # If we encrypt the payload then we can support deletes without downloading the blob, zeroing
    # its bytes, and re-uploading to blob storage.  Deletes can be performed instantaneously by
    # deleting the row which contains the encryption key.
    #
    # Encryption comes with a cost, we need to maintain keys, rotate them, integrate with a key
    # provider, etc.  It likely requires the use of a service and introduces a new mode of
    # failure.  If we don't need a new service and are happy using an environment variable then
    # encryption could be a very useful way to delete files with minimal performance overhead.
    if settings.REPLAYS_ENCRYPT_FILE_PART:
        dek, message = envelope_encrypt(settings.REPLAYS_KEK, part["message"])
        encoded_dek = base64.b64encode(dek).decode("utf-8")
    else:
        encoded_dek = None
        message = part["message"]

    # NOTE: For now KEK is an environment variable.  But environment variables can change.  The
    # KEK needs to be stored in some safe third location.  A reference needs to be stored on the
    # file_part rows pointing to the KEK's location.  This allows us the change keys without
    # breaking older rows.
    #
    # This is all very complicated so I'm leaning towards _not_ supporting encryption and instead
    # eating the cost of zeroing the bytes in hard-delete scenarios.
    return {
        "key": part["key"],
        "dek": encoded_dek,
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

        rows.append(
            {
                "dek": part["dek"],
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
                is_archived=False,
            )
            for row in rows
        ]
    )

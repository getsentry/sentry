from __future__ import annotations

import logging
import uuid
from io import BytesIO
from typing import List, Optional, TypedDict

import msgpack
from sentry_kafka_schemas import codecs, get_codec

from sentry import options
from sentry.models.files.utils import get_storage
from sentry.replays.usecases.ingest import MissingRecordingSegmentHeaders, process_headers
from sentry.utils.crypt import generate_key
from sentry.utils.crypt_envelope import envelope_encrypt

logger = logging.getLogger()

RECORDINGS_CODEC = get_codec("ingest-replay-recordings")


class RecordingSegment(TypedDict):
    key_id: int | None
    org_id: int
    payload: bytes
    project_id: int
    received: int
    replay_id: str
    retention_days: int
    segment_id: int


class ProcessedRecordingSegment(TypedDict):
    dek: bytes
    encrypted_message: bytes
    kek: bytes
    key: str


class RecordingFilePartRow(TypedDict):
    end: int
    dek: bytes
    filename: str
    key: str
    start: int


class StagedCommit(TypedDict):
    filename: str
    payload: bytes
    rows: List[RecordingFilePartRow]


def decode_recording_message(message: bytes) -> Optional[RecordingSegment]:
    """Optionally return a decoded RecordingSegment message type."""
    try:
        message_dict = RECORDINGS_CODEC.decode(message)
    except (codecs.ValidationError, msgpack.exceptions.ExtraData):
        logger.exception("Invalid replay recording payload.")
        return None

    try:
        headers, payload = process_headers(message_dict["payload"])
    except MissingRecordingSegmentHeaders:
        logger.warning(f'missing header on {message_dict["replay_id"]}')
        return None

    return {
        "key_id": message_dict["key_id"],
        "org_id": message_dict["org_id"],
        "payload": payload,
        "project_id": message_dict["project_id"],
        "received": message_dict["received"],
        "replay_id": message_dict["replay_id"],
        "retention_days": message_dict["retention_days"],
        "segment_id": headers["segment_id"],
    }


def prepare_recording_message_batch_item(message: RecordingSegment) -> ProcessedRecordingSegment:
    """Prepare a recording-segment message for batch submission."""
    # Envelope encrypt the recording segment.
    #
    # Encryption is performed to provide guarantees around deletion semantics. Encrypting the
    # message allows us to quickly delete the encryption key (rendering the object functionally
    # deleted) without requiring us to delete the blob in the remote storage provider.
    #
    # Specific to the replays use case, a 90-day TTL is applied to _all_ blobs regardless of
    # retention period.
    kek = generate_key()
    dek, encrypted_message = envelope_encrypt(kek, message["payload"])

    # Return a staged recording segment object.
    return {
        "key": f'{message["replay_id"]}{str(message["segment_id"])}',
        "kek": kek,
        "dek": dek,
        "encrypted_message": encrypted_message,
    }


def prepare_batched_commit(segments: List[ProcessedRecordingSegment]) -> StagedCommit:
    filename = uuid.uuid4().hex

    payload = b""
    rows: List[RecordingFilePartRow] = []
    for segment in segments:
        # Get the current length of the payload to determine the new starting index value.
        #
        # Consider a length one message is added to an empty payload. The start index is the len
        # of the payload (0) and the ending index is the length of the payload after the message
        # has been appended minus 1 (0). Now assume a second length one message is added. The
        # start index is 1 (which is currently unoccupied). This is the length of the payload
        # prior to the new messages being appended.
        start = len(payload)

        # Append the recording-segment message part to the combined payload.
        message_part = segment["encrypted_message"]
        payload += message_part

        # The ending index is always the length of the payload after the message has been appended
        # minus 1.  Minus 1 makes the range exclusive and ensures multiple byte-ranges do not
        # overlap.
        end = len(payload) - 1

        # Record row information.
        rows.append(
            {
                "start": start,
                "end": end,
                "dek": segment["dek"],
                "key": segment["key"],
                "filename": filename,
            }
        )

    return {
        "filename": filename,
        "payload": payload,
        "rows": rows,
    }


def save_file(filename: str, message: bytes) -> None:
    storage = get_storage(_make_storage_options())
    storage.save(filename, BytesIO(message))


def _make_storage_options() -> Optional[dict]:
    backend = options.get("replay.storage.backend")
    if backend:
        return {"backend": backend, "options": options.get("replay.storage.options")}
    else:
        return None


def bulk_insert_file_part_rows(rows: List[RecordingFilePartRow]) -> None:
    # TODO
    return None

from __future__ import annotations

import pickle
import zlib
from typing import Any, Literal

from pydantic import BaseModel

from sentry import options
from sentry.digests.types import IdentifierKey, Notification
from sentry.utils.codecs import BytesCodec, ZstdCodec

_bytes_zstd = BytesCodec() | ZstdCodec()

# All zstd frames start with a 4-byte little-endian magic number 0xFD2FB528
# (RFC 8878 §3.1.1). Used to distinguish JSON+zstd payloads from legacy
# pickle+zlib data on decode. No collision is possible: legacy data is
# zlib-compressed (CMF byte 0x78 from Python's default 32KB window), and
# 0x28B5 isn't a valid zlib header (fails the CMF/FLG checksum).
_ZSTD_MAGIC = b"\x28\xb5\x2f\xfd"


class NotificationPayload(BaseModel):
    """Schema for the JSON+zstd serialized notification payload.

    ``version`` should be bumped when making a breaking schema change.
    It can be used if needed in decode to dispatch on the right deserialization logic.

    Fields added as optional don't need a version bump since the reader can
    check for their presence.
    """

    version: Literal[1]
    project_id: int
    event_id: str
    group_id: int | None
    timestamp: float
    rule_ids: list[int]
    notification_uuid: str | None
    identifier_key: str


class Codec:
    def encode(self, value: Any) -> bytes:
        raise NotImplementedError

    def decode(self, value: bytes) -> Any:
        raise NotImplementedError


class CompressedPickleCodec(Codec):
    def encode(self, value: Notification) -> bytes:
        if not options.get("digests.encode-json-zstd"):
            return zlib.compress(pickle.dumps(value, protocol=5))

        event = value.event
        payload = NotificationPayload(
            version=1,
            project_id=event.project_id,
            event_id=event.event_id,
            group_id=event.group_id,
            timestamp=event.datetime.timestamp(),
            rule_ids=list(value.rules),
            notification_uuid=value.notification_uuid,
            identifier_key=str(value.identifier_key),
        )
        return _bytes_zstd.encode(payload.json())

    def decode(self, value: bytes) -> Notification:
        if value[:4] == _ZSTD_MAGIC:
            # Deferred to avoid circular import: this module is loaded during
            # app init (via digests backend config), but Event pulls in the
            # full model graph which isn't ready yet at that point.
            from sentry.services.eventstore.models import Event

            raw = NotificationPayload.parse_raw(_bytes_zstd.decode(value))
            # Partial Event: only project_id, event_id, group_id, and
            # datetime are populated. Do not access other fields (e.g.
            # tags, title, message) — they will silently return empty values.
            event = Event(
                project_id=raw.project_id,
                event_id=raw.event_id,
                group_id=raw.group_id,
                data={"timestamp": raw.timestamp},
            )
            return Notification(
                event=event,
                rules=raw.rule_ids,
                notification_uuid=raw.notification_uuid,
                identifier_key=IdentifierKey(raw.identifier_key),
            )
        # Legacy: pickle + zlib
        return pickle.loads(zlib.decompress(value))

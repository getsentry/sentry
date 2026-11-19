"""Share each hour's 16-day hourly series across the minute runs of that hour."""

from __future__ import annotations

import zlib
from collections.abc import Sequence
from datetime import datetime, timedelta
from hashlib import sha256
from typing import TYPE_CHECKING

import msgspec

from sentry.anomaly_detection.contracts import SeriesRow
from sentry.anomaly_detection.inputs.measurements import collect
from sentry.types.cell import get_local_cell
from sentry.utils import metrics
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project

_HOURLY_LOOKBACK = timedelta(days=16)
_TTL = 3600
# Stay under the 1 MB memcached item limit; large organizations span several chunks.
_CHUNK_BYTES = 900_000
_decoder = msgspec.msgpack.Decoder(list[SeriesRow])


def hourly_rows(
    organization: Organization, projects: Sequence[Project], end: datetime
) -> list[SeriesRow]:
    """Collect the hourly series ending at end's hour, reusing a cached snapshot."""
    end = end.replace(minute=0, second=0, microsecond=0)
    scope = sha256(":".join(str(project.id) for project in projects).encode()).hexdigest()
    key = (
        f"anomaly-detection:hourly:v3:{get_local_cell().name}:"
        f"{organization.id}:{scope}:{end.isoformat()}"
    )
    rows = _read(key)
    if rows is None:
        rows = collect(organization, projects, end - _HOURLY_LOOKBACK, end, "1h")
        _write(key, rows)
    return rows


def _chunk_key(key: str, digest: str, index: int) -> str:
    # Name chunks by content, so concurrent writers never mix their chunks.
    return f"{key}:{digest}:{index}"


def _read(key: str) -> list[SeriesRow] | None:
    manifest = cache.get(key)
    if manifest is None:
        return None
    try:
        count, digest = manifest
        keys = [_chunk_key(key, digest, index) for index in range(count)]
        chunks = cache.get_many(keys)
        if len(chunks) != count:
            metrics.incr("anomaly_detection.hourly_snapshot_corrupt", tags={"reason": "missing"})
            return None
        payload = b"".join(chunks[chunk_key] for chunk_key in keys)
        if sha256(payload).hexdigest() != digest:
            metrics.incr("anomaly_detection.hourly_snapshot_corrupt", tags={"reason": "digest"})
            return None
        return _decoder.decode(zlib.decompress(payload))
    except (TypeError, ValueError, zlib.error, msgspec.DecodeError):
        metrics.incr("anomaly_detection.hourly_snapshot_corrupt", tags={"reason": "decode"})
        return None


def _write(key: str, rows: list[SeriesRow]) -> None:
    payload = zlib.compress(msgspec.msgpack.encode(rows))
    digest = sha256(payload).hexdigest()
    chunks = [
        payload[offset : offset + _CHUNK_BYTES] for offset in range(0, len(payload), _CHUNK_BYTES)
    ]
    cache.set_many(
        {_chunk_key(key, digest, index): chunk for index, chunk in enumerate(chunks)}, _TTL
    )
    # Publish the manifest last, so readers never see it before its chunks.
    cache.set(key, (len(chunks), digest), _TTL)

"""Versioned binary checkpoints of an organization evaluator.

The evaluator's state is a tree of plain dataclasses, so msgspec encodes and type-checks
it without per-type code, and no class names or callables are stored. Two things need
help: change events are shared by reference across subsystems, so each is stored once in
an event table and restored as one shared object; and deques/counters are stored with
their bounds. Minute series are stored densely from their first minute.
"""

import logging
import zlib
from collections import Counter, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from types import GenericAlias
from typing import Any, get_args, get_origin, get_type_hints

import msgspec

from sentry.anomaly_detection.contracts import ChangeEvent, SeriesKey
from sentry.anomaly_detection.evaluation.organization import Checkpoint, EvaluatorState
from sentry.anomaly_detection.evaluation.series import Series

logger = logging.getLogger(__name__)

# Bump whenever a persisted type changes shape; other versions restart cold.
CHECKPOINT_VERSION = 5
_MINUTE = timedelta(minutes=1)

_EVENT_FIELDS = {
    name: hint for name, hint in get_type_hints(ChangeEvent.__init__).items() if name != "return"
}
# One table row per shared event, in constructor order.
_EVENT_ROWS = GenericAlias(list, (GenericAlias(tuple, tuple(_EVENT_FIELDS.values())),))
# A minute series from its first minute; absent minutes inside the span read as missing.
_DenseSeries = tuple[datetime, list[float | None]]


@dataclass
class _Payload:
    series: dict[SeriesKey, _DenseSeries | None]
    hourly: dict[SeriesKey, Series]
    state: EvaluatorState


@dataclass
class _Envelope:
    version: int
    events: msgspec.Raw
    payload: msgspec.Raw


def encode(checkpoint: Checkpoint) -> bytes:
    events: list[ChangeEvent] = []
    indices: dict[int, int] = {}

    def enc_hook(obj: Any) -> Any:
        if isinstance(obj, ChangeEvent):
            index = indices.get(id(obj))
            if index is None:
                index = indices[id(obj)] = len(events)
                events.append(obj)
            return index
        if isinstance(obj, deque):
            return obj.maxlen, list(obj)
        raise NotImplementedError(f"Cannot checkpoint {type(obj).__name__}")

    payload = msgspec.msgpack.encode(
        _Payload(
            series={key: _dense(points) for key, points in checkpoint.series.items()},
            hourly=checkpoint.hourly,
            state=checkpoint.state,
        ),
        enc_hook=enc_hook,
    )
    # Events don't reference other events, so this adds no table entries.
    rows = msgspec.msgpack.encode(
        [tuple(getattr(event, name) for name in _EVENT_FIELDS) for event in events],
        enc_hook=enc_hook,
    )
    envelope = _Envelope(CHECKPOINT_VERSION, msgspec.Raw(rows), msgspec.Raw(payload))
    return zlib.compress(msgspec.msgpack.encode(envelope), 1)


def decode(blob: bytes) -> Checkpoint | None:
    """Restore a checkpoint, or None if it is from another version or unreadable."""
    try:
        envelope = msgspec.msgpack.decode(zlib.decompress(blob), type=_Envelope)
        if envelope.version != CHECKPOINT_VERSION:
            return None
        rows = msgspec.msgpack.decode(envelope.events, type=_EVENT_ROWS, dec_hook=_containers)
        events = [ChangeEvent(**dict(zip(_EVENT_FIELDS, row))) for row in rows]

        def dec_hook(type_: Any, obj: Any) -> Any:
            if type_ is ChangeEvent:
                if type(obj) is not int or not 0 <= obj < len(events):
                    raise ValueError("Invalid checkpoint event reference")
                return events[obj]
            return _containers(type_, obj, dec_hook)

        payload = msgspec.msgpack.decode(envelope.payload, type=_Payload, dec_hook=dec_hook)
    except (zlib.error, msgspec.DecodeError, ValueError, TypeError):
        logger.warning("anomaly_detection.checkpoint_unreadable", exc_info=True)
        return None
    series = {key: _sparse(dense) for key, dense in payload.series.items()}
    return Checkpoint(series, payload.hourly, payload.state)


def _containers(type_: Any, obj: Any, dec_hook: Any = None) -> Any:
    origin, args = get_origin(type_), get_args(type_)
    if origin is deque:
        maxlen, items = obj
        items = msgspec.convert(items, GenericAlias(list, args), dec_hook=dec_hook)
        return deque(items, maxlen)
    if origin is Counter:
        counts = msgspec.convert(obj, GenericAlias(dict, (args[0], int)), dec_hook=dec_hook)
        return Counter(counts)
    raise NotImplementedError(f"Cannot restore {type_}")


def _dense(points: Series) -> _DenseSeries | None:
    if not points:
        return None
    first, last = min(points), max(points)
    return first, [
        points.get(first + offset * _MINUTE) for offset in range((last - first) // _MINUTE + 1)
    ]


def _sparse(dense: _DenseSeries | None) -> Series:
    if dense is None:
        return {}
    first, values = dense
    return {first + offset * _MINUTE: value for offset, value in enumerate(values)}

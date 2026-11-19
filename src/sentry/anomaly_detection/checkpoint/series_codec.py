"""Checkpoint encoding for collected measurements and rolling detector state."""

from base64 import b64decode, b64encode
from collections import deque
from datetime import datetime, timedelta
from struct import Struct, pack
from typing import Any
from zlib import compress, decompress

from sentry.anomaly_detection.checkpoint.event_codec import (
    _EventReader,
    _EventWriter,
    _iso,
    _key,
    _read_key,
    _time,
)
from sentry.anomaly_detection.contracts import SeriesKey
from sentry.anomaly_detection.evaluation.count_windows import DISPERSION_MIN, CountTotals
from sentry.anomaly_detection.evaluation.rate_shifts import RateShiftState, RateShiftTracker
from sentry.anomaly_detection.evaluation.series import Series
from sentry.anomaly_detection.evaluation.series_history import (
    RULES,
    RecentMinute,
    SeriesHistory,
    SeriesState,
)

_MINUTE = timedelta(minutes=1)
_HOUR = timedelta(hours=1)
_FLOAT64 = Struct("<d")
_SLOT = Struct("<H")
_NULL_SLOT = 1 << 15
_COVERAGE_SLOT = Struct("<HQ")


def _minute_values(points: Series, since: datetime, cursor: datetime) -> list[Any]:
    # Dense series use 8 bytes per minute before optional compression. Sparse
    # series use a 2-byte minute offset per observed slot (high bit = explicit
    # null). Omitted minutes need no space, even with rapidly changing top slices.
    observed = [(ts, value) for ts, value in points.items() if since <= ts < cursor]
    if not observed:
        return []
    first, last = observed[0][0], observed[-1][0]
    dense = (last - first) // _MINUTE + 1 == len(observed) and all(
        value is not None for _, value in observed
    )
    if dense:
        raw = pack(f"<{len(observed)}d", *(value for _, value in observed))
    else:
        sparse = bytearray()
        for ts, value in observed:
            offset = (ts - first) // _MINUTE
            sparse += _SLOT.pack(offset if value is not None else offset | _NULL_SLOT)
            if value is not None:
                sparse += _FLOAT64.pack(value)
        raw = bytes(sparse)
    packed = compress(raw, level=1)
    compressed = len(packed) < len(raw)
    return [
        _iso(first),
        dense,
        compressed,
        b64encode(packed if compressed else raw).decode("ascii"),
    ]


def _series(series: dict[SeriesKey, Series], since: datetime, cursor: datetime) -> list[Any]:
    return [[_key(key), _minute_values(points, since, cursor)] for key, points in series.items()]


def _read_series(data: list[Any]) -> dict[SeriesKey, Series]:
    series: dict[SeriesKey, Series] = {}
    # Reuse timestamp instances across series instead of allocating a datetime
    # for every measurement on restore.
    minutes: dict[datetime, datetime] = {}
    for key, history in data:
        points: Series = {}
        series[_read_key(key)] = points
        if not history:
            continue
        first, dense, compressed, packed = history
        start = datetime.fromisoformat(first)
        raw = b64decode(packed)
        if compressed:
            raw = decompress(raw)
        if dense:
            for offset, (value,) in enumerate(_FLOAT64.iter_unpack(raw)):
                ts = start + offset * _MINUTE
                points[minutes.setdefault(ts, ts)] = value
        else:
            index = 0
            while index < len(raw):
                (slot,) = _SLOT.unpack_from(raw, index)
                index += _SLOT.size
                ts = start + (slot & (_NULL_SLOT - 1)) * _MINUTE
                value = None
                if not slot & _NULL_SLOT:
                    (value,) = _FLOAT64.unpack_from(raw, index)
                    index += _FLOAT64.size
                points[minutes.setdefault(ts, ts)] = value
    return series


def _coverage(hours: dict[datetime, int]) -> list[Any]:
    first = min(hours)
    packed = b"".join(
        _COVERAGE_SLOT.pack((hour - first) // _HOUR, mask) for hour, mask in hours.items()
    )
    return [first.isoformat(), b64encode(packed).decode("ascii")]


def _read_coverage(first: str, packed: str) -> dict[datetime, int]:
    start = datetime.fromisoformat(first)
    return {
        start + offset * _HOUR: mask
        for offset, mask in _COVERAGE_SLOT.iter_unpack(b64decode(packed))
    }


def _detector(detector: SeriesHistory, events: _EventWriter) -> dict[str, Any]:
    return {
        "watched": [_key(key) for key in detector.watched],
        "exclude": [[_key(key), reason] for key, reason in detector.exclude.items()],
        # Pseudo-event floors are computed on the first observation in an hour, not
        # at the hour boundary. Recomputing a floor mid-hour would change sizing.
        "pseudo": [
            [_key(key), ts.isoformat(), floor] for (key, ts), floor in detector._pseudo.items()
        ],
        "state": [
            [
                _key(key),
                {
                    "recent": [
                        [reading.minute.isoformat(), reading.flagged, reading.actual]
                        for reading in state.recent
                    ],
                    "open": events.optional(state.open),
                    "anchor": _iso(state.anchor),
                    "anchor_level": state.anchor_level,
                    "anchor_sigma": state.anchor_sigma,
                    "anchor_points": state.anchor_points,
                    "excluded": [ts.isoformat() for ts in sorted(state.excluded)],
                    "score": state.score,
                    "level_ratio": state.level_ratio,
                    "worse_run": list(state.worse_run),
                    "counts": None
                    if state.counts is None
                    else [
                        [
                            _iso(point.ts),
                            point.events,
                            point.expected,
                            point.samples,
                            point.missing,
                            point.volume,
                            point.shaped_denominator,
                            point.level,
                        ]
                        for point in state.counts
                    ],
                    "window": state.window,
                    "closed_at": _iso(state.closed_at),
                    "recent_ratios": list(state.recent_ratios),
                    "failure_reference": state.failure_reference,
                },
            ]
            for key, state in detector.state.items()
        ],
    }


def _restore_detector(detector: SeriesHistory, data: dict[str, Any], events: _EventReader) -> None:
    watched = {}
    for fields in data["watched"]:
        key = _read_key(fields)
        rule = next(
            (
                rule
                for rule in RULES
                if (rule.signal, rule.metric, rule.slices)
                == (key.signal, key.metric, bool(key.dim_value))
            ),
            None,
        )
        if rule is None:
            raise ValueError("Invalid anomaly checkpoint detector rule")
        watched[key] = rule
    detector.watched = watched
    detector.exclude = {_read_key(key): reason for key, reason in data["exclude"]}
    detector._pseudo = {
        (_read_key(key), datetime.fromisoformat(ts)): floor for key, ts, floor in data["pseudo"]
    }
    for key_fields, state_data in data["state"]:
        count_rows = state_data["counts"]
        series_key = _read_key(key_fields)
        detector.state[series_key] = SeriesState(
            recent=deque(
                (
                    RecentMinute(datetime.fromisoformat(minute_iso), flagged, actual)
                    for minute_iso, flagged, actual in state_data["recent"]
                ),
                maxlen=watched[series_key].persist[1],
            ),
            open=events.optional(state_data["open"]),
            anchor=_time(state_data["anchor"]),
            anchor_level=state_data["anchor_level"],
            anchor_sigma=state_data["anchor_sigma"],
            anchor_points=state_data["anchor_points"],
            excluded={datetime.fromisoformat(minute_iso) for minute_iso in state_data["excluded"]},
            score=state_data["score"],
            level_ratio=state_data["level_ratio"],
            worse_run=list(state_data["worse_run"]),
            counts=None
            if count_rows is None
            else deque(
                (
                    CountTotals(
                        _time(minute_iso),
                        events_total,
                        expected_total,
                        samples,
                        missing,
                        volume,
                        shaped_denominator,
                        level,
                    )
                    for (
                        minute_iso,
                        events_total,
                        expected_total,
                        samples,
                        missing,
                        volume,
                        shaped_denominator,
                        level,
                    ) in count_rows
                ),
                maxlen=max(detector.cfg.windows) + DISPERSION_MIN + 1,
            ),
            window=state_data["window"],
            closed_at=_time(state_data["closed_at"]),
            recent_ratios=deque(state_data["recent_ratios"], maxlen=30),
            failure_reference=tuple(state_data["failure_reference"])
            if state_data["failure_reference"] is not None
            else None,
        )


def _change_points(cp: RateShiftTracker, events: _EventWriter) -> dict[str, Any]:
    return {
        "watched": [_key(key) for key in cp.watched],
        "exclude": [[_key(key), reason] for key, reason in cp.exclude.items()],
        "state": [
            [
                _key(key),
                state.hits,
                events.optional(state.open),
                state.level_before,
                _iso(state.hold_until),
            ]
            for key, state in cp.state.items()
        ],
        "spike_minutes": [
            [_key(key), [ts.isoformat() for ts in sorted(times)]]
            for key, times in cp.spike_minutes.items()
        ],
        "spike_seen": [[_key(key), ts.isoformat()] for key, ts in cp._spike_seen.items()],
    }


def _restore_change_points(
    cp: RateShiftTracker, data: dict[str, Any], events: _EventReader
) -> None:
    cp.watched = [_read_key(key) for key in data["watched"]]
    cp.exclude = {_read_key(key): reason for key, reason in data["exclude"]}
    cp.state = {
        _read_key(key): RateShiftState(
            hits, events.optional(index), level_before, _time(hold_until)
        )
        for key, hits, index, level_before, hold_until in data["state"]
    }
    cp.spike_minutes = {
        _read_key(key): {datetime.fromisoformat(ts) for ts in times}
        for key, times in data["spike_minutes"]
    }
    cp._spike_seen = {_read_key(key): datetime.fromisoformat(ts) for key, ts in data["spike_seen"]}

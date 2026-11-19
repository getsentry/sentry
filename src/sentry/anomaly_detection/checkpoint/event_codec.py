"""A snapshot-local reference table for shared change events."""

from datetime import datetime
from math import isfinite
from typing import Any

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    Service,
    Signal,
)


def _iso(ts: datetime | None) -> str | None:
    return ts.isoformat() if ts is not None else None


def _time(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value is not None else None


def _key(key: SeriesKey) -> list[int | str]:
    return [key.project_id, key.env, key.signal, key.metric, key.dim_value]


def _read_key(data: list[Any]) -> SeriesKey:
    project_id, env, signal, metric, dim_value = data
    return SeriesKey(project_id, env, Signal(signal), Metric(metric), dim_value)


def _service(service: Service) -> list[int | str]:
    return [service.project_id, service.env]


def _read_service(data: list[Any]) -> Service:
    project_id, env = data
    return Service(project_id, env)


_NOVELTY_FIELDS = (
    "unusual",
    "size",
    "return_days",
    "similar",
    "history_days",
    "pooled_rate",
    "kind",
    "p_normal",
    "lasting_min",
    "harm",
    "vouched",
    "opened_on_escalation",
    "opened_on_duration",
)


def _novelty_data(novelty: dict[str, Any] | None) -> dict[str, Any] | None:
    if novelty is None:
        return None
    data = {}
    for key in _NOVELTY_FIELDS:
        if key in novelty:
            value = novelty[key]
            # JSON cannot represent infinity (e.g. a return period with zero mean rate).
            data[key] = str(value) if isinstance(value, float) and not isfinite(value) else value
    if "unusual_since" in novelty:
        data["unusual_since"] = _iso(novelty["unusual_since"])
    return data


def _read_novelty(data: dict[str, Any] | None) -> dict[str, Any] | None:
    if data is None:
        return None
    novelty = {}
    for key in _NOVELTY_FIELDS:
        if key in data:
            value = data[key]
            novelty[key] = (
                float(value)
                if key not in ("kind", "harm", "vouched")
                and isinstance(value, str)
                and value in ("inf", "-inf", "nan")
                else value
            )
    if "unusual_since" in data:
        novelty["unusual_since"] = _time(data["unusual_since"])
    return novelty


class _EventWriter:
    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []
        self._indices: dict[int, int] = {}

    def ref(self, event: ChangeEvent) -> int:
        identity = id(event)
        if identity in self._indices:
            return self._indices[identity]
        index = self._indices[identity] = len(self.records)
        self.records.append(
            {
                "key": _key(event.key),
                "change_type": event.change_type.value,
                "start": event.start.isoformat(),
                "actual": event.actual,
                "expected": event.expected,
                "confidence": event.confidence,
                "evidence": list(event.evidence),
                "detected_at": _iso(event.detected_at),
                "ended_at": _iso(event.ended_at),
                "peak_ratio": event.peak_ratio,
                "open_ratio": event.open_ratio,
                "novelty": _novelty_data(event.novelty),
                "escalations": [[ts.isoformat(), ratio] for ts, ratio in event.escalations],
                "recent_ratio": event.recent_ratio,
                "sustained_at": _iso(event.sustained_at),
                "issue_ids": list(event.issue_ids),
            }
        )
        return index

    def optional(self, event: ChangeEvent | None) -> int | None:
        return self.ref(event) if event is not None else None


class _EventReader:
    def __init__(self, records: list[dict[str, Any]]) -> None:
        self._events = [
            ChangeEvent(
                key=_read_key(data["key"]),
                change_type=ChangeType(data["change_type"]),
                start=datetime.fromisoformat(data["start"]),
                actual=data["actual"],
                expected=data["expected"],
                confidence=data["confidence"],
                evidence=list(data["evidence"]),
                detected_at=_time(data["detected_at"]),
                ended_at=_time(data["ended_at"]),
                peak_ratio=data["peak_ratio"],
                open_ratio=data["open_ratio"],
                novelty=_read_novelty(data["novelty"]),
                escalations=[
                    (datetime.fromisoformat(ts), ratio) for ts, ratio in data["escalations"]
                ],
                recent_ratio=data["recent_ratio"],
                sustained_at=_time(data["sustained_at"]),
                issue_ids=tuple(data["issue_ids"]),
            )
            for data in records
        ]

    def ref(self, index: int) -> ChangeEvent:
        if type(index) is not int or not 0 <= index < len(self._events):
            raise ValueError("Invalid anomaly checkpoint event reference")
        return self._events[index]

    def optional(self, index: int | None) -> ChangeEvent | None:
        return self.ref(index) if index is not None else None

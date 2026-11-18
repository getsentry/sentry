"""Durable delivery state. The statistical checkpoint has its own versioned codec."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any
from uuid import uuid4

from sentry.anomaly_detection.contracts import Urgency
from sentry.anomaly_detection.grouptype import AnomalyTransition
from sentry.anomaly_detection.pipeline import AnomalyDecision
from sentry.workflow_engine.types import DetectorPriorityLevel

_STATE_VERSION = 2
_MAX_PINS = 1024
_MAX_PENDING = 256
_PRIORITIES = {
    Urgency.LOW: DetectorPriorityLevel.LOW,
    Urgency.MEDIUM: DetectorPriorityLevel.MEDIUM,
    Urgency.HIGH: DetectorPriorityLevel.HIGH,
}


@dataclass(frozen=True)
class Pin:
    detector_id: int
    project_id: int
    env: str
    title: str
    activation_key: str
    closed: bool = False
    retired: bool = False


@dataclass
class PendingTransition:
    logical_key: str  # The evaluator's group key, not the published activation key.
    detector_id: int
    transition: AnomalyTransition
    confirm_ingested: bool
    broker_acked_at: datetime | None = None


@dataclass
class DeliveryState:
    pins: dict[str, Pin] = field(default_factory=dict)
    pending: list[PendingTransition] = field(default_factory=list)

    @classmethod
    def from_json(cls, value: dict[str, Any] | None) -> "DeliveryState":
        if value is None:
            return cls()
        if value["version"] != _STATE_VERSION:
            raise ValueError("Unsupported anomaly delivery state version")
        return cls(
            pins={
                group_key: Pin(
                    detector_id=item["detector_id"],
                    project_id=item["project_id"],
                    env=item["env"],
                    title=item["title"],
                    activation_key=item["activation_key"],
                    closed=item["closed"],
                    retired=item["retired"],
                )
                for group_key, item in value["pins"].items()
            },
            pending=[
                PendingTransition(
                    logical_key=item["logical_key"],
                    detector_id=item["detector_id"],
                    transition=AnomalyTransition(
                        group_key=item["group_key"],
                        project_id=item["project_id"],
                        timestamp=datetime.fromisoformat(item["timestamp"]),
                        priority=DetectorPriorityLevel(item["priority"]),
                        is_resolved=item["is_resolved"],
                        title=item["title"],
                        evidence={},
                        env=item["env"],
                    ),
                    confirm_ingested=item["confirm_ingested"],
                    broker_acked_at=(
                        datetime.fromisoformat(item["broker_acked_at"])
                        if item["broker_acked_at"]
                        else None
                    ),
                )
                for item in value["pending"]
            ],
        )

    def to_json(self) -> dict[str, Any]:
        return {
            "version": _STATE_VERSION,
            "pins": {
                group_key: {
                    "detector_id": pin.detector_id,
                    "project_id": pin.project_id,
                    "env": pin.env,
                    "title": pin.title,
                    "activation_key": pin.activation_key,
                    "closed": pin.closed,
                    "retired": pin.retired,
                }
                for group_key, pin in self.pins.items()
            },
            "pending": [
                {
                    "logical_key": item.logical_key,
                    "detector_id": item.detector_id,
                    "group_key": item.transition.group_key,
                    "project_id": item.transition.project_id,
                    "timestamp": item.transition.timestamp.isoformat(),
                    "priority": int(item.transition.priority),
                    "is_resolved": item.transition.is_resolved,
                    "title": item.transition.title,
                    "env": item.transition.env,
                    "confirm_ingested": item.confirm_ingested,
                    "broker_acked_at": (
                        item.broker_acked_at.isoformat() if item.broker_acked_at else None
                    ),
                }
                for item in self.pending
            ],
        }

    def retire(self, logical_key: str) -> None:
        """Drop an undeliverable lifecycle without ever rebinding its owner."""
        self.pins[logical_key] = replace(self.pins[logical_key], retired=True)
        self.pending = [item for item in self.pending if item.logical_key != logical_key]

    def stage(
        self,
        decisions: Iterable[AnomalyDecision],
        detectors: Mapping[int, int],
        *,
        start: datetime,
        end: datetime,
        retained_keys: set[str],
    ) -> None:
        """Use evaluator order within a minute. An update cannot repoint an existing issue."""
        for decision in sorted(decisions, key=lambda decision: decision.timestamp):
            if not start <= decision.timestamp < end:
                continue
            key = decision.group_key
            pin = self.pins.get(key)
            needs_open = pin is None or pin.closed
            if pin is not None and pin.retired:
                continue
            if decision.is_resolved and (pin is None or pin.closed):
                continue
            if pin is None:
                detector_id = detectors.get(decision.project_id)
                if detector_id is None:
                    continue
                pin = Pin(
                    detector_id, decision.project_id, decision.env, decision.title, uuid4().hex
                )
            elif pin.closed:
                # An in-flight close retry still targets the old activation. Reuse
                # the owner, not the fingerprint, when the evaluator reopens it.
                pin = replace(pin, activation_key=uuid4().hex)
            self.pins[key] = replace(pin, closed=decision.is_resolved)
            self.pending.append(
                PendingTransition(
                    logical_key=key,
                    detector_id=pin.detector_id,
                    transition=AnomalyTransition(
                        group_key=pin.activation_key,
                        project_id=pin.project_id,
                        timestamp=decision.timestamp,
                        priority=_PRIORITIES[decision.urgency],
                        is_resolved=decision.is_resolved,
                        title=pin.title,
                        # Internal evidence may contain data from other projects.
                        evidence={},
                        env=pin.env,
                    ),
                    confirm_ingested=needs_open or decision.is_resolved,
                )
            )
        # Scope reconciliation can discard an open group without emitting a close.
        queued = {item.logical_key for item in self.pending}
        self.pins = {
            key: pin for key, pin in self.pins.items() if key in retained_keys or key in queued
        }
        if len(self.pending) > _MAX_PENDING or len(self.pins) > _MAX_PINS:
            raise RuntimeError("Anomaly delivery state exceeded its capacity")

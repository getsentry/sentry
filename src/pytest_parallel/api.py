from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True, slots=True)
class Shard:
    files: tuple[Path, ...]
    nodeids: tuple[str, ...]
    weight: float
    groups: tuple[str, ...]
    ordinal: int


@dataclass(frozen=True, slots=True)
class RunInfo:
    run_id: str
    role: Literal["controller", "worker", "serial"]
    collection_seed: int | None


@dataclass(frozen=True, slots=True)
class WorkerInfo:
    index: int
    count: int


_current_run: RunInfo | None = None
_current_worker: WorkerInfo | None = None


def current_run() -> RunInfo | None:
    return _current_run


def current_worker() -> WorkerInfo | None:
    return _current_worker


def _publish(run: RunInfo, worker: WorkerInfo | None) -> None:
    global _current_run, _current_worker
    if (run.role == "worker") != (worker is not None):
        raise RuntimeError("worker identity does not match run role")
    _current_run = run
    _current_worker = worker


__all__ = ["RunInfo", "Shard", "WorkerInfo", "current_run", "current_worker"]

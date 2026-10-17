from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

from .api import Shard


@dataclass
class FileUnit:
    path: Path
    key: str
    items: list[Any] = field(default_factory=list)
    groups: set[str] = field(default_factory=set)
    weight: float = 0.0
    ordinal: int = 0


@dataclass
class Unit:
    files: tuple[Path, ...]
    items: list[Any]
    weight: float
    groups: tuple[str, ...]
    ordinal: int

    def shard(self) -> Shard:
        return Shard(
            files=self.files,
            nodeids=tuple(item.nodeid for item in self.items),
            weight=float(self.weight),
            groups=self.groups,
            ordinal=self.ordinal,
        )


def validate_weight(value: object, path: Path) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise pytest.UsageError(
            f"pytest_parallel_file_weight for {path} must return a positive finite number or None, got {value!r}"
        )
    weight = float(value)
    if not math.isfinite(weight) or weight <= 0.0:
        raise pytest.UsageError(
            f"pytest_parallel_file_weight for {path} must return a positive finite number or None, got {value!r}"
        )
    return weight


def validate_group_names(values: object, path: Path, source: str) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str | bytes) or not isinstance(values, Sequence):
        raise pytest.UsageError(
            f"{source} for {path} must return a list of group names or None, got {values!r}"
        )
    names: list[str] = []
    for raw in values:
        if not isinstance(raw, str) or not raw.strip():
            raise pytest.UsageError(
                f"{source} for {path} requires non-empty string group names, got {raw!r}"
            )
        names.append(raw.strip())
    return names


def merge_units(files: Sequence[FileUnit]) -> list[Unit]:
    parent = list(range(len(files)))

    def find(idx: int) -> int:
        while parent[idx] != idx:
            parent[idx] = parent[parent[idx]]
            idx = parent[idx]
        return idx

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            low, high = (ra, rb) if ra < rb else (rb, ra)
            parent[high] = low

    first_for_group: dict[str, int] = {}
    for idx, file_unit in enumerate(files):
        for name in sorted(file_unit.groups):
            if name in first_for_group:
                union(first_for_group[name], idx)
            else:
                first_for_group[name] = idx

    by_root: dict[int, list[FileUnit]] = {}
    order: list[int] = []
    for file_unit in files:
        root = find(file_unit.ordinal)
        if root not in by_root:
            by_root[root] = []
            order.append(root)
        by_root[root].append(file_unit)

    units: list[Unit] = []
    for root in order:
        members = by_root[root]
        items: list[Any] = []
        for member in members:
            items.extend(member.items)
        groups = tuple(sorted({name for member in members for name in member.groups}))
        units.append(
            Unit(
                files=tuple(member.path for member in members),
                items=items,
                weight=float(sum(member.weight for member in members)),
                groups=groups,
                ordinal=members[0].ordinal,
            )
        )
    return units


def assign_units(
    units: Sequence[Unit],
    num_workers: int,
    *,
    balance: str = "count",
    pins: dict[int, int] | None = None,
) -> list[list[Unit]]:
    pins = pins or {}
    buckets: list[list[Unit]] = [[] for _ in range(num_workers)]
    loads = [0.0] * num_workers
    for unit_idx in sorted(pins, key=lambda i: units[i].ordinal):
        worker = pins[unit_idx]
        buckets[worker].append(units[unit_idx])
        loads[worker] += units[unit_idx].weight
    unpinned = [unit for idx, unit in enumerate(units) if idx not in pins]
    if balance == "count":
        for unit in sorted(unpinned, key=lambda unit: (-unit.weight, unit.ordinal)):
            worker = min(range(num_workers), key=lambda w: (loads[w], w))
            buckets[worker].append(unit)
            loads[worker] += unit.weight
    else:
        for position, unit in enumerate(sorted(unpinned, key=lambda unit: unit.ordinal)):
            worker = position % num_workers
            buckets[worker].append(unit)
            loads[worker] += unit.weight
    for bucket in buckets:
        bucket.sort(key=lambda unit: unit.ordinal)
    return buckets


def plan_dict(
    buckets: Sequence[Sequence[Unit]],
    units: Sequence[Unit],
    *,
    balance: str,
    pins: dict[int, int],
    rootpath: Path,
) -> dict[str, Any]:
    index_of = {id(unit): idx for idx, unit in enumerate(units)}
    weights: list[float] = []
    workers: list[dict[str, Any]] = []
    for worker_id, bucket in enumerate(buckets):
        weight = float(sum(unit.weight for unit in bucket))
        weights.append(weight)
        workers.append(
            {
                "worker": worker_id,
                "weight": weight,
                "test_count": sum(len(unit.items) for unit in bucket),
                "file_count": sum(len(unit.files) for unit in bucket),
                "files": [_display_path(path, rootpath) for unit in bucket for path in unit.files],
                "units": [
                    {
                        "files": [_display_path(path, rootpath) for path in unit.files],
                        "nodeids": [item.nodeid for item in unit.items],
                        "test_count": len(unit.items),
                        "weight": float(unit.weight),
                        "groups": list(unit.groups),
                        "ordinal": unit.ordinal,
                        "pinned": index_of.get(id(unit), -1) in pins,
                        "worker": worker_id,
                    }
                    for unit in bucket
                ],
            }
        )
    return {
        "version": 1,
        "balance": balance,
        "num_workers": len(buckets),
        "num_units": len(units),
        "total_weight": float(sum(weights)),
        "imbalance": float(max(weights) - min(weights)) if weights else 0.0,
        "workers": workers,
    }


def _display_path(path: Path, rootpath: Path) -> str:
    try:
        return path.relative_to(rootpath).as_posix()
    except Exception:
        return path.as_posix()


def format_plan_text(plan: dict[str, Any]) -> str:
    lines = [
        f"pytest-parallel plan: balance={plan['balance']} workers={plan['num_workers']} units={plan['num_units']} "
        f"total_weight={plan['total_weight']:g} imbalance={plan['imbalance']:g}"
    ]
    for worker in plan["workers"]:
        lines.append(
            f"worker {worker['worker']}: {worker['test_count']} tests, {worker['file_count']} files, "
            f"weight={worker['weight']:g}"
        )
        for unit in worker["units"]:
            kind = "pinned" if unit["pinned"] else "auto"
            groups = ",".join(unit["groups"]) if unit["groups"] else "-"
            lines.append(
                f"  [{kind}] groups={groups} weight={unit['weight']:g} files={', '.join(unit['files'])}"
            )
    return "\n".join(lines)

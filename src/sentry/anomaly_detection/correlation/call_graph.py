"""Order related anomaly series using observed and historical call paths."""

from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence

from sentry.anomaly_detection.contracts import SeriesKey
from sentry.anomaly_detection.correlation.footprint import (
    SLICE_LAYERS,
    CallEdge,
    Footprint,
    base_signal,
    service_of,
)

DOWNSTREAM = 1
UPSTREAM = -1


class _CallGraph:
    def __init__(self, edges: Mapping[CallEdge, int], *, majority: bool = False) -> None:
        call_counts: Counter[tuple[str, str]] = Counter()
        for (caller, _, callee), count in edges.items():
            if caller != callee and count > 0:
                call_counts[caller, callee] += count
        self.forward: dict[str, set[str]] = defaultdict(set)
        self.domains: dict[tuple[str, str], set[str]] = defaultdict(set)
        for caller, domain, callee in edges:
            forward_count, reverse_count = call_counts[caller, callee], call_counts[callee, caller]
            if not forward_count or (
                majority and (forward_count, callee) <= (reverse_count, caller)
            ):
                continue
            self.forward[caller].add(callee)
            self.domains[caller, domain].add(callee)
        self._reachable: dict[str, set[str]] = {}
        self.depth: dict[str, int] = {}
        if majority:
            calls = sorted(
                (caller, callee) for caller, callees in self.forward.items() for callee in callees
            )
            limit = len({service for call in calls for service in call})
            # Longest path for acyclic graphs. Bound relaxation for cyclic call maps.
            for _ in range(limit):
                changed = False
                for caller, callee in calls:
                    callee_depth = self.depth.get(caller, 0) + 1
                    if self.depth.get(callee, 0) < callee_depth <= limit:
                        self.depth[callee] = callee_depth
                        changed = True
                if not changed:
                    break

    def position(self, key: SeriesKey) -> int:
        return self.depth.get(service_of(key), 0) * 3 + _layer(key)

    def reachable(self, start: str) -> set[str]:
        if start not in self._reachable:
            seen, pending = {start}, [start]
            while pending:
                for target in self.forward.get(pending.pop(), ()):
                    if target not in seen:
                        seen.add(target)
                        pending.append(target)
            seen.remove(start)
            self._reachable[start] = seen
        return self._reachable[start]

    def _on_path(self, key: SeriesKey, target: str) -> bool:
        source = service_of(key)
        if target not in self.reachable(source):
            return False
        if _layer(key) < 2:
            return True  # Service totals and endpoints sit above their outbound calls.
        if base_signal(key.signal) != "outbound_http":
            return False  # A database slice isn't a step toward another project.
        return any(
            target == callee or target in self.reachable(callee)
            for callee in self.domains.get((source, key.dim_value), ())
        )

    def order(self, reference_key: SeriesKey, compared_key: SeriesKey) -> int | None:
        compared_is_downstream = self._on_path(reference_key, service_of(compared_key))
        reference_is_downstream = self._on_path(compared_key, service_of(reference_key))
        if compared_is_downstream == reference_is_downstream:
            return None
        return DOWNSTREAM if compared_is_downstream else UPSTREAM


def observed_order(
    reference_key: SeriesKey,
    compared_key: SeriesKey,
    footprints: Sequence[Footprint | None],
) -> int | None:
    """Determine the direction from slice layers or affected traces, without call history."""
    if service_of(reference_key) == service_of(compared_key):
        left, right = _layer(reference_key), _layer(compared_key)
        return (right > left) - (right < left)
    trace_edges: Counter[CallEdge] = Counter()
    for footprint in footprints:
        if footprint:
            trace_edges.update(footprint.edges)
    return _CallGraph(trace_edges).order(reference_key, compared_key) if trace_edges else None


def is_project_level(key: SeriesKey) -> bool:
    return _layer(key) == 0


def _layer(key: SeriesKey) -> int:
    return SLICE_LAYERS.get(base_signal(key.signal), 0) if key.dim_value else 0

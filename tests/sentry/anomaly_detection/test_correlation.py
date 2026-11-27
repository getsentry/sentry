from collections import Counter

import pytest

from sentry.anomaly_detection.contracts import (
    Metric,
    SeriesKey,
    Service,
    Signal,
)
from sentry.anomaly_detection.correlation.call_graph import DOWNSTREAM, UPSTREAM, CallGraph
from sentry.anomaly_detection.correlation.footprint import (
    CallEdge,
)

LATENCY = Metric.P95_DURATION


def _service(project_id: int) -> Service:
    return Service(project_id, "production")


def _total(project_id: int) -> SeriesKey:
    return SeriesKey(project_id, "production", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)


def _call_edges(*calls: tuple[int, int, int]) -> Counter[CallEdge]:
    edges: Counter[CallEdge] = Counter()
    for caller, callee, count in calls:
        edges[CallEdge(_service(caller), f"{callee}.example.com", _service(callee))] = count
    return edges


@pytest.mark.parametrize(
    ("calls", "expected"),
    [
        pytest.param([(1, 2, 3), (2, 1, 1)], DOWNSTREAM, id="more-calls-forward"),
        pytest.param([(1, 2, 1), (2, 1, 3)], UPSTREAM, id="more-calls-back"),
        pytest.param([(1, 2, 2), (2, 1, 2)], DOWNSTREAM, id="tie"),
        pytest.param([(2, 1, 2), (1, 2, 2)], DOWNSTREAM, id="tie-listed-in-reverse"),
    ],
)
def test_majority_call_graph_keeps_one_direction_per_service_pair(
    calls: list[tuple[int, int, int]], expected: int
) -> None:
    edges = _call_edges(*calls)

    assert CallGraph(edges, majority=True).order(_total(1), _total(2)) == expected
    # Without a majority, calls in both directions leave the pair unordered.
    assert CallGraph(edges).order(_total(1), _total(2)) is None


def test_majority_call_graph_bounds_depth_in_call_cycles() -> None:
    graph = CallGraph(_call_edges((1, 2, 1), (2, 3, 1), (3, 1, 1)), majority=True)

    assert set(graph.depth) == {_service(1), _service(2), _service(3)}
    assert max(graph.depth.values()) <= 3
    assert graph.order(_total(1), _total(2)) is None
    assert graph.order(_total(3), _total(1)) is None


def test_majority_call_graph_positions_follow_the_longest_call_path() -> None:
    # Calls relax in caller order, so 4 -> 3 is seen after 3 -> 2; 4 -> 2 is a shortcut.
    graph = CallGraph(_call_edges((3, 2, 1), (4, 2, 1), (4, 3, 1)), majority=True)
    database = SeriesKey(4, "production", Signal.OUTBOUND_DB, LATENCY, "orders")
    endpoint = SeriesKey(4, "production", Signal.ENDPOINTS, LATENCY, "/checkout")
    keys = [_total(2), _total(3), database, endpoint, _total(4)]

    assert graph.depth == {_service(3): 1, _service(2): 2}
    assert sorted(keys, key=graph.position) == [_total(4), endpoint, database, _total(3), _total(2)]

from __future__ import annotations

from unittest.mock import patch

from sentry.testutils.pytest.xdist_scheduler import DeterministicScheduling


class MockGateway:
    def __init__(self, gw_id: str):
        self.id = gw_id


class MockNode:
    def __init__(self, gw_id: str):
        self.gateway = MockGateway(gw_id)
        self.sent_indices: list[int] = []
        self.shutdowns = 0

    def send_runtest_some(self, indices: list[int]) -> None:
        self.sent_indices.extend(indices)

    def shutdown(self) -> None:
        self.shutdowns += 1


def make_scheduler(num_workers: int) -> DeterministicScheduling:
    with patch(
        "sentry.testutils.pytest.xdist_scheduler.parse_spec_config",
        return_value=["gw" + str(i) for i in range(num_workers)],
    ):
        sched = DeterministicScheduling(config=None)
    return sched


def collect_worker_nodeids(
    sched: DeterministicScheduling, nodes: list[MockNode], collection: list[str]
) -> dict[str, list[str]]:
    """Register nodes, add collections, schedule, and return per-worker nodeids in order."""
    for node in nodes:
        sched.add_node(node)
    for node in nodes:
        sched.add_node_collection(node, collection)
    sched.schedule()

    result: dict[str, list[str]] = {}
    for node in nodes:
        result[node.gateway.id] = [collection[i] for i in node.sent_indices]
    return result


class TestDeterministicSchedulerOrdering:
    def test_interleaved_nodeids_preserve_collection_order(self):
        """Workers receive nodeids interleaved from the sorted collection."""
        collection = [
            "tests/a.py::test_1",
            "tests/a.py::test_2",
            "tests/b.py::test_1",
            "tests/b.py::test_2",
            "tests/c.py::test_1",
        ]
        sched = make_scheduler(2)
        nodes = [MockNode("gw0"), MockNode("gw1")]
        per_worker = collect_worker_nodeids(sched, nodes, collection)

        sorted_collection = sorted(collection)
        # Worker 0 gets indices 0, 2, 4; worker 1 gets indices 1, 3
        assert per_worker["gw0"] == [sorted_collection[i] for i in range(0, 5, 2)]
        assert per_worker["gw1"] == [sorted_collection[i] for i in range(1, 5, 2)]

    def test_combined_worker_order_matches_collection(self):
        """Interleaving worker assignments reconstructs the original sorted collection."""
        collection = [
            "tests/z.py::test_last",
            "tests/a.py::test_first",
            "tests/m.py::test_middle",
            "tests/a.py::test_second",
            "tests/b.py::test_one",
            "tests/b.py::test_two",
        ]
        sched = make_scheduler(2)
        nodes = [MockNode("gw0"), MockNode("gw1")]
        per_worker = collect_worker_nodeids(sched, nodes, collection)

        # Reconstruct by interleaving: position 0 from gw0, position 1 from gw1, ...
        gw0_tests = per_worker["gw0"]
        gw1_tests = per_worker["gw1"]
        reconstructed = []
        for i in range(max(len(gw0_tests), len(gw1_tests))):
            if i < len(gw0_tests):
                reconstructed.append(gw0_tests[i])
            if i < len(gw1_tests):
                reconstructed.append(gw1_tests[i])

        assert reconstructed == sorted(collection)

    def test_three_workers_round_robin(self):
        """With 3 workers, test i goes to worker i % 3."""
        collection = [f"tests/file{i}.py::test" for i in range(9)]
        sched = make_scheduler(3)
        nodes = [MockNode("gw0"), MockNode("gw1"), MockNode("gw2")]
        per_worker = collect_worker_nodeids(sched, nodes, collection)

        sorted_collection = sorted(collection)
        assert per_worker["gw0"] == [
            sorted_collection[0],
            sorted_collection[3],
            sorted_collection[6],
        ]
        assert per_worker["gw1"] == [
            sorted_collection[1],
            sorted_collection[4],
            sorted_collection[7],
        ]
        assert per_worker["gw2"] == [
            sorted_collection[2],
            sorted_collection[5],
            sorted_collection[8],
        ]

    def test_workers_with_different_collection_order(self):
        """Workers that collected tests in different order still get the same assignment."""
        collection = [
            "tests/a.py::test_1",
            "tests/a.py::test_2",
            "tests/b.py::test_1",
            "tests/b.py::test_2",
        ]
        shuffled = list(reversed(collection))

        sched = make_scheduler(2)
        nodes = [MockNode("gw0"), MockNode("gw1")]

        for node in nodes:
            sched.add_node(node)
        # Each worker collected in different order
        sched.add_node_collection(nodes[0], collection)
        sched.add_node_collection(nodes[1], shuffled)
        sched.schedule()

        # Both workers should resolve to the same sorted assignment
        gw0_nodeids = [collection[i] for i in nodes[0].sent_indices]
        gw1_nodeids = [shuffled[i] for i in nodes[1].sent_indices]

        sorted_collection = sorted(collection)
        assert gw0_nodeids == [sorted_collection[0], sorted_collection[2]]
        assert gw1_nodeids == [sorted_collection[1], sorted_collection[3]]

    def test_all_workers_receive_shutdown(self):
        collection = ["tests/a.py::test_1", "tests/b.py::test_1"]
        sched = make_scheduler(2)
        nodes = [MockNode("gw0"), MockNode("gw1")]
        collect_worker_nodeids(sched, nodes, collection)

        for node in nodes:
            assert node.shutdowns == 1

    def test_mark_test_complete(self):
        collection = ["tests/a.py::test_1", "tests/b.py::test_1"]
        sched = make_scheduler(2)
        nodes = [MockNode("gw0"), MockNode("gw1")]
        collect_worker_nodeids(sched, nodes, collection)

        assert sched.has_pending
        assert not sched.tests_finished

        for node in nodes:
            for idx in node.sent_indices:
                sched.mark_test_complete(node, idx)

        assert sched.tests_finished
        assert not sched.has_pending

    def test_single_test_single_worker(self):
        collection = ["tests/a.py::test_only"]
        sched = make_scheduler(2)
        nodes = [MockNode("gw0"), MockNode("gw1")]

        for node in nodes:
            sched.add_node(node)
        for node in nodes:
            sched.add_node_collection(node, collection)
        sched.schedule()

        # Only 1 test, so excess worker should be shut down
        assert nodes[0].sent_indices == [0]
        assert nodes[1].sent_indices == []
        # Excess node gets shutdown from excess removal + not from the send loop
        assert nodes[1].shutdowns >= 1

from __future__ import annotations

from unittest.mock import Mock

from pytest_parallel.coordinator import CoordinatorPlugin


def _make_item(nodeid: str) -> Mock:
    item = Mock()
    item.nodeid = nodeid
    return item


class TestPartition:
    def test_round_robin_preserves_file_order(self):
        """Files are distributed round-robin in collection order."""
        items = [
            _make_item("a.py::test_1"),
            _make_item("a.py::test_2"),
            _make_item("b.py::test_1"),
            _make_item("c.py::test_1"),
            _make_item("c.py::test_2"),
            _make_item("d.py::test_1"),
            _make_item("e.py::test_1"),
        ]

        buckets = CoordinatorPlugin._partition(items, 3)

        assert [it.nodeid for it in buckets[0]] == ["a.py::test_1", "a.py::test_2", "d.py::test_1"]
        assert [it.nodeid for it in buckets[1]] == ["b.py::test_1", "e.py::test_1"]
        assert [it.nodeid for it in buckets[2]] == ["c.py::test_1", "c.py::test_2"]

    def test_preserves_test_order_within_file(self):
        """Tests within a file keep their original collection order."""
        items = [
            _make_item("f.py::TestA::test_3"),
            _make_item("f.py::TestA::test_1"),
            _make_item("f.py::TestB::test_2"),
        ]

        buckets = CoordinatorPlugin._partition(items, 2)

        assert [it.nodeid for it in buckets[0]] == [
            "f.py::TestA::test_3",
            "f.py::TestA::test_1",
            "f.py::TestB::test_2",
        ]
        assert buckets[1] == []

    def test_single_worker_gets_everything(self):
        items = [_make_item(f"f{i}.py::test") for i in range(5)]

        buckets = CoordinatorPlugin._partition(items, 1)

        assert len(buckets) == 1
        assert len(buckets[0]) == 5

    def test_more_workers_than_files(self):
        """Extra workers get empty buckets."""
        items = [_make_item("a.py::test_1"), _make_item("b.py::test_1")]

        buckets = CoordinatorPlugin._partition(items, 4)

        assert [it.nodeid for it in buckets[0]] == ["a.py::test_1"]
        assert [it.nodeid for it in buckets[1]] == ["b.py::test_1"]
        assert buckets[2] == []
        assert buckets[3] == []

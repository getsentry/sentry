from __future__ import annotations

import types
from typing import Sequence
from unittest import mock

import pytest

from sentry.testutils.pytest import sentry

NODEIDS = (
    "test1.py::test1",
    "test1.py::test2",
    "test1.py::test3",
    "test1.py::MyTest::test",
    "test1.py::MyTest::test2",
    "test2.py::test",
    "test3.py::test1",
    "test3.py::test2",
    "test3.py::test3",
    "test3.py::test4",
)

strategies = pytest.mark.parametrize("strategy", ("scope", "roundrobin"))


def _bucket(ids: Sequence[str], strategy: str) -> list[list[str]]:
    ret = []
    for i in range(3):
        items = [types.SimpleNamespace(nodeid=nodeid) for nodeid in ids]
        sentry.pytest_collection_modifyitems(
            mock.Mock(),
            items,
            _total_groups=3,
            _current_group=i,
            _grouping_strategy=strategy,
        )
        ret.append([item.nodeid for item in items])
    return ret


@strategies
def test_bucketing_includes_all_items(strategy: str) -> None:
    all_items = [nodeid for bucket in _bucket(NODEIDS, strategy) for nodeid in bucket]
    assert len(all_items) == len(NODEIDS)
    assert set(all_items) == set(NODEIDS)


@strategies
def test_bucketing_independent_of_collection_order(strategy: str) -> None:
    items_forward = _bucket(NODEIDS, strategy)
    items_reversed = _bucket(NODEIDS[::-1], strategy)
    assert items_forward == items_reversed


def test_round_robin_bucketing():
    assert _bucket(NODEIDS, "roundrobin") == [
        ["test1.py::MyTest::test", "test1.py::test2", "test3.py::test1", "test3.py::test4"],
        ["test1.py::MyTest::test2", "test1.py::test3", "test3.py::test2"],
        ["test1.py::test1", "test2.py::test", "test3.py::test3"],
    ]


def test_scope_bucketing():
    assert _bucket(NODEIDS, "scope") == [
        ["test3.py::test1", "test3.py::test2", "test3.py::test3", "test3.py::test4"],
        ["test1.py::test1", "test1.py::test2", "test1.py::test3"],
        ["test1.py::MyTest::test", "test1.py::MyTest::test2", "test2.py::test"],
    ]

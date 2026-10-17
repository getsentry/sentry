from __future__ import annotations

from pytest_parallel.worker import _absolute_nodeids


def test_absolute_nodeids_resolves_file_part_against_rootdir(tmp_path):
    assert _absolute_nodeids(str(tmp_path), ["tests/test_sample.py::TestCase::test_ok"]) == [
        f"{tmp_path}/tests/test_sample.py::TestCase::test_ok"
    ]


def test_absolute_nodeids_leaves_absolute_file_part_alone(tmp_path):
    nodeid = f"{tmp_path}/test_sample.py::test_ok"

    assert _absolute_nodeids(str(tmp_path), [nodeid]) == [nodeid]

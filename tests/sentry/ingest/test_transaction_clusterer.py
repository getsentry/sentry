from unittest import mock

from sentry.ingest.transaction_clusterer.collect.redis import (
    _get_transaction_names,
    _store_transaction_name,
)
from sentry.ingest.transaction_clusterer.tree import TreeClusterer
from sentry.models.project import Project


def test_multi_fanout():
    clusterer = TreeClusterer(merge_threshold=3)
    transaction_names = [
        "/a/b0/c/d0/e",
        "/a/b0/c/d1/e",
        "/a/b0/c/d2/e",
        "/a/b1/c/d0/e",
        "/a/b1/c/d1/e/",
        "/a/b1/c/d2/e",
        "/a/b2/c/d0/e",
        "/a/b2/c/d1/e/",
        "/a/b2/c/d2/e",
        "/a/b2/c1/d2/e",
    ]
    clusterer.add_input(transaction_names)
    assert clusterer.get_rules() == ["/a/*/c/*/**", "/a/*/**"]


def test_single_leaf():
    clusterer = TreeClusterer(merge_threshold=2)
    transaction_names = [
        "/a/b1/c/",
        "/a/b2/c/",
    ]
    clusterer.add_input(transaction_names)
    assert clusterer.get_rules() == ["/a/*/**"]


@mock.patch("sentry.ingest.transaction_clusterer.collect.redis.MAX_SET_SIZE", 5)
def test_collection():
    project1 = Project(id=101, name="p1", organization_id=1)
    project2 = Project(id=102, name="project2", organization_id=1)

    for project in (project1, project2):
        for i in range(len(project.name)):
            _store_transaction_name(project, f"tx-{project.name}-{i}")
            _store_transaction_name(project, f"tx-{project.name}-{i}")

    set_entries1 = _get_transaction_names(project1)
    assert set(set_entries1) == {"tx-p1-0", "tx-p1-1"}

    set_entries2 = _get_transaction_names(project2)
    assert len(set_entries2) == 5
    # We don't know which entries made it into the final set:
    for name in set_entries2:
        assert name.startswith("tx-project2-")

    project3 = Project(id=103, name="project3", organization_id=1)
    assert set() == _get_transaction_names(project3)

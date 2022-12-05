from unittest import mock

import pytest

from sentry.eventstore.models import Event
from sentry.ingest.transaction_clusterer.datasource.redis import (
    _store_transaction_name,
    get_transaction_names,
    record_transaction_name,
)
from sentry.ingest.transaction_clusterer.tree import TreeClusterer
from sentry.models.project import Project
from sentry.testutils.helpers import Feature


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


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 5)
def test_collection():
    project1 = Project(id=101, name="p1", organization_id=1)
    project2 = Project(id=102, name="project2", organization_id=1)

    for project in (project1, project2):
        for i in range(len(project.name)):
            _store_transaction_name(project, f"tx-{project.name}-{i}")
            _store_transaction_name(project, f"tx-{project.name}-{i}")

    set_entries1 = set(get_transaction_names(project1))
    assert set_entries1 == {"tx-p1-0", "tx-p1-1"}

    set_entries2 = set(get_transaction_names(project2))
    assert len(set_entries2) == 5, set_entries2
    # We don't know which entries made it into the final set:
    for name in set_entries2:
        assert name.startswith("tx-project2-")

    project3 = Project(id=103, name="project3", organization_id=1)
    assert set() == set(get_transaction_names(project3))


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 100)
def test_distribution():
    """Make sure that the redis set prefers newer entries"""
    project = Project(id=103, name="", organization_id=1)
    for i in range(1000):
        _store_transaction_name(project, str(i))

    freshness = sum(map(int, get_transaction_names(project))) / 100

    # The average is usually around ~900, check for > 800 to be on the safe side
    assert freshness > 800, freshness


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis._store_transaction_name")
@pytest.mark.django_db
@pytest.mark.parametrize(
    "source,txname,feature,expected",
    [
        ("url", "/a/b/c", True, 1),
        ("route", "/", True, 0),
        ("url", None, True, 0),
        ("url", "/", False, 0),
        ("route", None, False, 0),
    ],
)
def test_record_transactions(
    mocked_record, default_organization, source, txname, feature, expected
):
    with Feature({"organizations:transaction-name-clusterer": feature}):
        project = Project(id=111, name="project", organization_id=default_organization.id)
        event = Event(
            project.id,
            "02552061b47b467cb38d1d2dd26eed21",
            data={
                "tags": [["transaction", txname]],
                "transaction": txname,
                "transaction_info": {"source": source},
            },
        )
        record_transaction_name(project, event)
        assert len(mocked_record.mock_calls) == expected

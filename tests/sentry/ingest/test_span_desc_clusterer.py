from unittest import mock

import pytest
from freezegun import freeze_time

from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.ingest.transaction_clusterer.datasource.redis import (
    _store_span_description,
    clear_span_descriptions,
    get_active_projects,
    get_span_descriptions,
    record_span_descriptions,
)
from sentry.ingest.transaction_clusterer.rules import (
    ProjectOptionRuleStore,
    get_rules,
    get_sorted_rules,
    update_rules,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.helpers.features import Feature


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 5)
def test_collection():
    org = Organization(pk=666)
    project1 = Project(id=101, name="p1", organization=org)
    project2 = Project(id=102, name="project2", organization=org)

    for project in (project1, project2):
        for i in range(len(project.name)):
            _store_span_description(project, f"span.desc-{project.name}-{i}")
            _store_span_description(project, f"span.desc-{project.name}-{i}")

    set_entries1 = set(get_span_descriptions(project1))
    assert set_entries1 == {"span.desc-p1-0", "span.desc-p1-1"}

    set_entries2 = set(get_span_descriptions(project2))
    assert len(set_entries2) == 5, set_entries2
    # We don't know which entries made it into the final set:
    for name in set_entries2:
        assert name.startswith("span.desc-project2-")

    project3 = Project(id=103, name="project3", organization=Organization(pk=66))
    assert set() == set(get_span_descriptions(project3))


def test_clear_redis():
    project = Project(id=101, name="p1", organization=Organization(pk=66))
    _store_span_description(project, "foo")
    assert set(get_span_descriptions(project)) == {"foo"}
    clear_span_descriptions(project)
    assert set(get_span_descriptions(project)) == set()

    # Deleting for a none-existing project does not crash:
    project2 = Project(id=666, name="project2", organization=Organization(pk=66))
    clear_span_descriptions(project2)


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 100)
def test_distribution():
    """Make sure that the redis set prefers newer entries"""
    project = Project(id=103, name="", organization=Organization(pk=66))
    for i in range(1000):
        _store_span_description(project, str(i))

    freshness = sum(map(int, get_span_descriptions(project))) / 100

    # The average is usually around ~900, check for > 800 to be on the safe side
    assert freshness > 800, freshness


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis._store_span_description")
@pytest.mark.django_db
@pytest.mark.parametrize(
    "description, description_scrubbed, op, feat_flag_enabled, expected",
    [
        ("", "", "http.client", True, 0),
        ("", "/a/b/c", "something.else", True, 0),
        ("", "/a/b/c", "http.client", True, 1),
        ("/a/b/c", "", "something.else", True, 0),
        ("/a/b/c", "", "http.client", True, 1),
        ("/a/b/c", "/a/*/c", "something.else", True, 0),
        ("/a/b/c", "/a/*/c", "http.client", True, 1),
        ("/a/b/c", "/a/*/c", "http.client", False, 0),
    ],
)
def test_record_span(
    mocked_record,
    default_organization,
    description,
    description_scrubbed,
    op,
    feat_flag_enabled,
    expected,
):
    with Feature(
        {
            "projects:span-metrics-extraction": feat_flag_enabled,
        }
    ):
        project = Project(id=111, name="project", organization_id=default_organization.id)
        record_span_descriptions(
            project,
            {
                "spans": [
                    {
                        "description": description,
                        "op": op,
                        "data": {"description.scrubbed": description_scrubbed},
                    }
                ]
            },
        )
        assert len(mocked_record.mock_calls) == expected


def test_sort_rules():
    rules = {"/a/*/**": 1, "/a/**": 2, "/a/*/c/**": 3}
    assert ProjectOptionRuleStore(ClustererNamespace.SPANS)._sort(rules) == [
        ("/a/*/c/**", 3),
        ("/a/*/**", 1),
        ("/a/**", 2),
    ]


@mock.patch("sentry.ingest.transaction_clusterer.rules.CompositeRuleStore.MERGE_MAX_RULES", 2)
@pytest.mark.django_db
def test_max_rule_threshold_merge_composite_store(default_project):
    assert len(get_sorted_rules(ClustererNamespace.SPANS, default_project)) == 0

    with freeze_time("2000-01-01 01:00:00"):
        update_rules(ClustererNamespace.SPANS, default_project, [ReplacementRule("foo/foo")])
        update_rules(ClustererNamespace.SPANS, default_project, [ReplacementRule("bar/bar")])

    assert get_sorted_rules(ClustererNamespace.SPANS, default_project) == [
        ("foo/foo", 946688400),
        ("bar/bar", 946688400),
    ]

    with freeze_time("2000-01-01 02:00:00"):
        update_rules(ClustererNamespace.SPANS, default_project, [ReplacementRule("baz/baz")])
        assert len(get_sorted_rules(ClustererNamespace.SPANS, default_project)) == 2
        update_rules(ClustererNamespace.SPANS, default_project, [ReplacementRule("qux/qux")])
        assert len(get_sorted_rules(ClustererNamespace.SPANS, default_project)) == 2

    assert get_sorted_rules(ClustererNamespace.SPANS, default_project) == [
        ("baz/baz", 946692000),
        ("qux/qux", 946692000),
    ]


@pytest.mark.django_db
def test_save_rules(default_project):
    project = default_project

    project_rules = get_rules(ClustererNamespace.SPANS, project)
    assert project_rules == {}

    with freeze_time("2012-01-14 12:00:01"):
        assert 2 == update_rules(
            ClustererNamespace.SPANS,
            default_project,
            [ReplacementRule("foo"), ReplacementRule("bar")],
        )
    project_rules = get_rules(ClustererNamespace.SPANS, project)
    assert project_rules == {"foo": 1326542401, "bar": 1326542401}

    with freeze_time("2012-01-14 12:00:02"):
        assert 1 == update_rules(
            ClustererNamespace.SPANS,
            default_project,
            [ReplacementRule("bar"), ReplacementRule("zap")],
        )
    project_rules = get_rules(ClustererNamespace.SPANS, project)
    assert {"bar": 1326542402, "foo": 1326542401, "zap": 1326542402}


@pytest.mark.django_db
def test_get_deleted_project():
    deleted_project = Project(pk=666, organization=Organization(pk=666))
    _store_span_description(deleted_project, "foo")
    assert list(get_active_projects(ClustererNamespace.SPANS)) == []

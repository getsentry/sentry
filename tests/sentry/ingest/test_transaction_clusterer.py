from unittest import mock

import pytest
from freezegun import freeze_time

from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.ingest.transaction_clusterer.datasource.redis import (
    _store_transaction_name,
    clear_transaction_names,
    get_active_projects,
    get_transaction_names,
    record_transaction_name,
)
from sentry.ingest.transaction_clusterer.rules import (
    ProjectOptionRuleStore,
    _get_rules,
    get_sorted_rules,
    update_rules,
)
from sentry.ingest.transaction_clusterer.tasks import cluster_projects, spawn_clusterers
from sentry.ingest.transaction_clusterer.tree import TreeClusterer
from sentry.models import Organization, Project
from sentry.models.options.project_option import ProjectOption
from sentry.relay.config import get_project_config
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
    org = Organization(pk=666)
    project1 = Project(id=101, name="p1", organization=org)
    project2 = Project(id=102, name="project2", organization=org)

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

    project3 = Project(id=103, name="project3", organization=Organization(pk=66))
    assert set() == set(get_transaction_names(project3))


def test_clear_redis():
    project = Project(id=101, name="p1", organization=Organization(pk=66))
    _store_transaction_name(project, "foo")
    assert set(get_transaction_names(project)) == {"foo"}
    clear_transaction_names(project)
    assert set(get_transaction_names(project)) == set()

    # Deleting for a none-existing project does not crash:
    project2 = Project(id=666, name="project2", organization=Organization(pk=66))
    clear_transaction_names(project2)


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 100)
def test_distribution():
    """Make sure that the redis set prefers newer entries"""
    project = Project(id=103, name="", organization=Organization(pk=66))
    for i in range(1000):
        _store_transaction_name(project, str(i))

    freshness = sum(map(int, get_transaction_names(project))) / 100

    # The average is usually around ~900, check for > 800 to be on the safe side
    assert freshness > 800, freshness


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis._store_transaction_name")
@pytest.mark.django_db
@pytest.mark.parametrize(
    "source, txname, tags, feature_enabled, expected",
    [
        ("url", "/a/b/c", [["transaction", "/a/b/c"]], True, 1),
        ("url", "/a/b/c", [["http.status_code", "200"]], True, 1),
        ("route", "/", [["transaction", "/"]], True, 0),
        ("url", None, [], True, 0),
        ("url", "/a/b/c", [["http.status_code", "404"]], True, 0),
        ("url", "/", [["transaction", "/"]], False, 0),
        ("route", None, [], False, 0),
    ],
)
def test_record_transactions(
    mocked_record, default_organization, source, txname, tags, feature_enabled, expected
):
    with Feature({"organizations:transaction-name-clusterer": feature_enabled}):
        project = Project(id=111, name="project", organization_id=default_organization.id)
        record_transaction_name(
            project,
            {
                "tags": tags,
                "transaction": txname,
                "transaction_info": {"source": source},
            },
        )
        assert len(mocked_record.mock_calls) == expected


def test_sort_rules():
    rules = {"/a/*/**": 1, "/a/**": 2, "/a/*/c/**": 3}
    assert ProjectOptionRuleStore()._sort(rules) == [
        ("/a/*/c/**", 3),
        ("/a/*/**", 1),
        ("/a/**", 2),
    ]


@pytest.fixture(params=(True, False))
def pickle_mode(request):
    field = ProjectOption._meta.get_field("value")
    with mock.patch.object(field, "write_json", request.param):
        yield


@mock.patch("sentry.ingest.transaction_clusterer.rules.CompositeRuleStore.MERGE_MAX_RULES", 2)
@pytest.mark.django_db
@pytest.mark.usefixtures("pickle_mode")
def test_max_rule_threshold_merge_composite_store(default_project):
    assert len(get_sorted_rules(default_project)) == 0

    with freeze_time("2000-01-01 01:00:00"):
        update_rules(default_project, [ReplacementRule("foo/foo")])
        update_rules(default_project, [ReplacementRule("bar/bar")])

    assert get_sorted_rules(default_project) == [("foo/foo", 946688400), ("bar/bar", 946688400)]

    with freeze_time("2000-01-01 02:00:00"):
        update_rules(default_project, [ReplacementRule("baz/baz")])
        assert len(get_sorted_rules(default_project)) == 2
        update_rules(default_project, [ReplacementRule("qux/qux")])
        assert len(get_sorted_rules(default_project)) == 2

    assert get_sorted_rules(default_project) == [("baz/baz", 946692000), ("qux/qux", 946692000)]


@pytest.mark.django_db
def test_save_rules(default_project):
    project = default_project

    project_rules = _get_rules(project)
    assert project_rules == {}

    with freeze_time("2012-01-14 12:00:01"):
        update_rules(project, [ReplacementRule("foo"), ReplacementRule("bar")])
    project_rules = _get_rules(project)
    assert project_rules == {"foo": 1326542401, "bar": 1326542401}

    with freeze_time("2012-01-14 12:00:02"):
        update_rules(project, [ReplacementRule("bar"), ReplacementRule("zap")])
    project_rules = _get_rules(project)
    assert {"bar": 1326542402, "foo": 1326542401, "zap": 1326542402}


@mock.patch("django.conf.settings.SENTRY_TRANSACTION_CLUSTERER_RUN", True)
# From the test -- number of transactions: 30 == 10 * 2 + 5 * 2
@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 30)
@mock.patch("sentry.ingest.transaction_clusterer.tasks.MERGE_THRESHOLD", 5)
@mock.patch(
    "sentry.ingest.transaction_clusterer.tasks.cluster_projects.delay",
    wraps=cluster_projects,  # call immediately
)
@pytest.mark.django_db
def test_run_clusterer_task(cluster_projects_delay, default_organization):
    def _add_mock_data(proj, number):
        for i in range(0, number):
            _store_transaction_name(proj, f"/user/tx-{proj.name}-{i}")
            _store_transaction_name(proj, f"/org/tx-{proj.name}-{i}")

    with Feature({"organizations:transaction-name-clusterer": True}):
        project1 = Project(id=123, name="project1", organization_id=default_organization.id)
        project2 = Project(id=223, name="project2", organization_id=default_organization.id)
        for project in (project1, project2):
            project.save()
            _add_mock_data(project, 10)

        spawn_clusterers()

        assert cluster_projects_delay.call_count == 1
        cluster_projects_delay.reset_mock()

        # Not stored enough transactions yet
        assert _get_rules(project1) == {}
        assert _get_rules(project2) == {}

        # Clear transactions if batch minimum is not met
        assert list(get_transaction_names(project1)) == []
        assert list(get_transaction_names(project2)) == []

        _add_mock_data(project1, 10)
        _add_mock_data(project2, 10)

        # add more transactions to the project 1
        for i in range(5):
            _store_transaction_name(project1, f"/users/trans/tx-{project1.id}-{i}")
            _store_transaction_name(project1, f"/test/path/{i}")

        # Add a transaction to project2 so it runs again
        _store_transaction_name(project2, "foo")

        with mock.patch("sentry.ingest.transaction_clusterer.tasks.PROJECTS_PER_TASK", 1):
            spawn_clusterers()

        # One project per batch now:
        assert cluster_projects_delay.call_count == 2, cluster_projects_delay.call_args

        pr_rules = _get_rules(project1)
        assert pr_rules.keys() == {
            "/org/*/**",
            "/user/*/**",
            "/test/path/*/**",
            "/users/trans/*/**",
        }


@mock.patch("django.conf.settings.SENTRY_TRANSACTION_CLUSTERER_RUN", True)
@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 2)
@mock.patch("sentry.ingest.transaction_clusterer.rules.update_rules")
@pytest.mark.django_db
def test_clusterer_only_runs_when_enough_transactions(mock_update_rules, default_organization):
    project = Project(id=456, name="test_project", organization_id=default_organization.id)
    assert _get_rules(project) == {}

    _store_transaction_name(project, "/transaction/number/1")
    with Feature({"organizations:transaction-name-clusterer": True}):
        cluster_projects([project])
    assert mock_update_rules.call_count == 0
    assert _get_rules(project) == {}  # Transaction names are deleted if there aren't enough

    _store_transaction_name(project, "/transaction/number/1")
    _store_transaction_name(project, "/transaction/number/2")
    with Feature({"organizations:transaction-name-clusterer": True}):
        cluster_projects([project])
    assert mock_update_rules.call_count == 1


@pytest.mark.django_db
def test_get_deleted_project():
    deleted_project = Project(pk=666, organization=Organization(pk=666))
    _store_transaction_name(deleted_project, "foo")
    assert list(get_active_projects()) == []


@pytest.mark.django_db
def test_transaction_clusterer_generates_rules(default_project):
    def _get_projconfig_tx_rules(project: Project):
        return (
            get_project_config(project, full_config=True).to_dict().get("config").get("txNameRules")
        )

    feature = "organizations:transaction-name-normalize"
    with Feature({feature: False}):
        assert _get_projconfig_tx_rules(default_project) is None
    with Feature({feature: True}):
        assert _get_projconfig_tx_rules(default_project) is None

    rules = {"/rule/*/0/**": 0, "/rule/*/1/**": 1}
    ProjectOptionRuleStore().write(default_project, rules)

    with Feature({feature: False}):
        assert _get_projconfig_tx_rules(default_project) is None
    with Feature({feature: True}):
        assert _get_projconfig_tx_rules(default_project) == [
            # TTL is 90d, so three months to expire
            {
                "pattern": "/rule/*/0/**",
                "expiry": "1970-04-01T00:00:00+00:00",
                "scope": {"source": "url"},
                "redaction": {"method": "replace", "substitution": "*"},
            },
            {
                "pattern": "/rule/*/1/**",
                "expiry": "1970-04-01T00:00:01+00:00",
                "scope": {"source": "url"},
                "redaction": {"method": "replace", "substitution": "*"},
            },
        ]


@mock.patch("django.conf.settings.SENTRY_TRANSACTION_CLUSTERER_RUN", True)
@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 10)
@mock.patch("sentry.ingest.transaction_clusterer.tasks.MERGE_THRESHOLD", 5)
@mock.patch(
    "sentry.ingest.transaction_clusterer.tasks.cluster_projects.delay",
    wraps=cluster_projects,  # call immediately
)
@pytest.mark.django_db
def test_transaction_clusterer_bumps_rules(_m, default_organization):
    with Feature({"organizations:transaction-name-clusterer": True}):
        project1 = Project(id=123, name="project1", organization_id=default_organization.id)
        project1.save()
        for i in range(10):
            _store_transaction_name(project1, f"/user/tx-{project1.name}-{i}/settings")

        with mock.patch("sentry.ingest.transaction_clusterer.rules._now", lambda: 1):
            spawn_clusterers()

        assert _get_rules(project1) == {"/user/*/**": 1}

        with mock.patch("sentry.ingest.transaction_clusterer.rules._now", lambda: 2):
            record_transaction_name(
                project1,
                {
                    "transaction": "/user/*/settings",
                    "transaction_info": {"source": "sanitized"},
                    "_meta": {
                        "transaction": {
                            "": {
                                "rem": [["int", "s", 0, 0], ["/user/*/**", "s"]],
                                "val": "/user/tx-project1-pi/settings",
                            }
                        }
                    },
                },
            )

        assert _get_rules(project1) == {"/user/*/**": 2}

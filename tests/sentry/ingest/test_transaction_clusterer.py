from unittest import mock

import pytest

from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.ingest.transaction_clusterer.datasource.redis import (
    _get_projects_key,
    _get_redis_key,
    _record_sample,
    clear_samples,
    get_active_projects,
    get_redis_client,
    get_transaction_names,
    record_transaction_name,
)
from sentry.ingest.transaction_clusterer.meta import get_clusterer_meta
from sentry.ingest.transaction_clusterer.rules import (
    ProjectOptionRuleStore,
    RedisRuleStore,
    bump_last_used,
    get_redis_rules,
    get_rules,
    get_sorted_rules,
    update_rules,
)
from sentry.ingest.transaction_clusterer.tasks import cluster_projects, spawn_clusterers
from sentry.ingest.transaction_clusterer.tree import TreeClusterer
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.relay.config import get_project_config
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


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


def test_deep_tree():
    clusterer = TreeClusterer(merge_threshold=1)
    transaction_names = [
        1001 * "/.",
    ]
    clusterer.add_input(transaction_names)

    # Does not throw an exception:
    clusterer.get_rules()


def test_clusterer_doesnt_generate_invalid_rules():
    clusterer = TreeClusterer(merge_threshold=1)
    all_stars = ["/a/b", "/b/c", "/c/d"]
    clusterer.add_input(all_stars)
    assert clusterer.get_rules() == []

    clusterer = TreeClusterer(merge_threshold=2)
    scheme_stars = ["http://a", "http://b", "http://c"]
    clusterer.add_input(scheme_stars)
    assert clusterer.get_rules() == []


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 5)
def test_collection():
    org = Organization(pk=666)
    project1 = Project(id=101, name="p1", organization=org)
    project2 = Project(id=102, name="project2", organization=org)

    for project in (project1, project2):
        for i in range(len(project.name)):
            _record_sample(ClustererNamespace.TRANSACTIONS, project, f"tx-{project.name}-{i}")
            _record_sample(ClustererNamespace.TRANSACTIONS, project, f"tx-{project.name}-{i}")

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
    _record_sample(ClustererNamespace.TRANSACTIONS, project, "foo")
    assert set(get_transaction_names(project)) == {"foo"}
    clear_samples(ClustererNamespace.TRANSACTIONS, project)
    assert set(get_transaction_names(project)) == set()

    # Deleting for a non-existing project does not crash:
    project2 = Project(id=666, name="project2", organization=Organization(pk=66))
    clear_samples(ClustererNamespace.TRANSACTIONS, project2)


def test_clear_redis_projects():
    project1 = Project(id=101, name="p1", organization=Organization(pk=66))
    project2 = Project(id=102, name="p2", organization=Organization(pk=66))
    client = get_redis_client()

    assert not client.exists(_get_projects_key(ClustererNamespace.TRANSACTIONS))
    assert not client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project1))
    assert not client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project2))

    _record_sample(ClustererNamespace.TRANSACTIONS, project1, "foo")

    assert client.smembers(_get_projects_key(ClustererNamespace.TRANSACTIONS)) == {"101"}
    assert client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project1))
    assert not client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project2))

    _record_sample(ClustererNamespace.TRANSACTIONS, project2, "bar")

    assert client.smembers(_get_projects_key(ClustererNamespace.TRANSACTIONS)) == {"101", "102"}
    assert client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project1))
    assert client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project2))

    clear_samples(ClustererNamespace.TRANSACTIONS, project1)

    assert client.smembers(_get_projects_key(ClustererNamespace.TRANSACTIONS)) == {"102"}
    assert not client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project1))
    assert client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project2))

    clear_samples(ClustererNamespace.TRANSACTIONS, project2)

    # Everything is gone
    assert not client.exists(_get_projects_key(ClustererNamespace.TRANSACTIONS))
    assert not client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project1))
    assert not client.exists(_get_redis_key(ClustererNamespace.TRANSACTIONS, project2))


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 100)
def test_distribution():
    """Make sure that the redis set prefers newer entries"""
    project = Project(id=103, name="", organization=Organization(pk=66))
    for i in range(1000):
        _record_sample(ClustererNamespace.TRANSACTIONS, project, str(i))

    freshness = sum(map(int, get_transaction_names(project))) / 100

    # The average is usually around ~900, check for > 800 to be on the safe side
    assert freshness > 800, freshness


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis._record_sample")
@django_db_all
@pytest.mark.parametrize(
    "source, txname, tags, expected",
    [
        ("url", "/a/b/c", [["transaction", "/a/b/c"]], 1),
        ("url", "/a/b/c", [["http.status_code", "200"]], 1),
        ("route", "/", [["transaction", "/"]], 0),
        ("url", None, [], 0),
        ("url", "/a/b/c", [["http.status_code", "404"]], 0),
        (None, "/a/b/c", [], 1),
        (None, "foo", [], 0),
    ],
)
def test_record_transactions(mocked_record, default_organization, source, txname, tags, expected):
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
    rules = {
        ReplacementRule("/a/*/**"): 1,
        ReplacementRule("/a/**"): 2,
        ReplacementRule("/a/*/c/**"): 3,
    }
    assert ProjectOptionRuleStore(ClustererNamespace.TRANSACTIONS)._sort(rules) == [
        ("/a/*/c/**", 3),
        ("/a/*/**", 1),
        ("/a/**", 2),
    ]


@mock.patch("sentry.ingest.transaction_clusterer.rules.CompositeRuleStore.MERGE_MAX_RULES", 2)
@django_db_all
def test_max_rule_threshold_merge_composite_store(default_project):
    assert len(get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project)) == 0

    with freeze_time("2000-01-01 01:00:00"):
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [ReplacementRule("foo/foo")])
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [ReplacementRule("bar/bar")])

    assert get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project) == [
        ("foo/foo", 946688400),
        ("bar/bar", 946688400),
    ]

    with freeze_time("2000-01-01 02:00:00"):
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [ReplacementRule("baz/baz")])
        assert len(get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project)) == 2
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [ReplacementRule("qux/qux")])
        assert len(get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project)) == 2

    assert get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project) == [
        ("baz/baz", 946692000),
        ("qux/qux", 946692000),
    ]


@django_db_all
def test_save_rules(default_project):
    project = default_project

    project_rules = get_rules(ClustererNamespace.TRANSACTIONS, project)
    assert project_rules == {}

    with freeze_time("2012-01-14 12:00:01"):
        assert 2 == update_rules(
            ClustererNamespace.TRANSACTIONS,
            default_project,
            [ReplacementRule("foo"), ReplacementRule("bar")],
        )
    project_rules = get_rules(ClustererNamespace.TRANSACTIONS, project)
    assert project_rules == {"foo": 1326542401, "bar": 1326542401}

    with freeze_time("2012-01-14 12:00:02"):
        assert 1 == update_rules(
            ClustererNamespace.TRANSACTIONS,
            default_project,
            [ReplacementRule("bar"), ReplacementRule("zap")],
        )
    project_rules = get_rules(ClustererNamespace.TRANSACTIONS, project)
    assert {"bar": 1326542402, "foo": 1326542401, "zap": 1326542402}


# From the test -- number of transactions: 30 == 10 * 2 + 5 * 2
@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 30)
@mock.patch("sentry.ingest.transaction_clusterer.tasks.MERGE_THRESHOLD", 5)
@mock.patch(
    "sentry.ingest.transaction_clusterer.tasks.cluster_projects.delay",
    wraps=cluster_projects,  # call immediately
)
@django_db_all
@freeze_time("2000-01-01 01:00:00")
def test_run_clusterer_task(cluster_projects_delay, default_organization):
    def _add_mock_data(proj, number):
        for i in range(0, number):
            _record_sample(ClustererNamespace.TRANSACTIONS, proj, f"/user/tx-{proj.name}-{i}")
            _record_sample(ClustererNamespace.TRANSACTIONS, proj, f"/org/tx-{proj.name}-{i}")

    project1 = Project(id=123, name="project1", organization_id=default_organization.id)
    project2 = Project(id=223, name="project2", organization_id=default_organization.id)
    for project in (project1, project2):
        project.save()
        _add_mock_data(project, 4)

    assert (
        get_clusterer_meta(ClustererNamespace.TRANSACTIONS, project1)
        == get_clusterer_meta(ClustererNamespace.TRANSACTIONS, project2)
        == {"first_run": 0, "last_run": 0, "runs": 0}
    )

    spawn_clusterers()

    assert cluster_projects_delay.call_count == 1
    cluster_projects_delay.reset_mock()

    # Not stored enough transactions yet
    assert get_rules(ClustererNamespace.TRANSACTIONS, project1) == {}
    assert get_rules(ClustererNamespace.TRANSACTIONS, project2) == {}

    assert (
        get_clusterer_meta(ClustererNamespace.TRANSACTIONS, project1)
        == get_clusterer_meta(ClustererNamespace.TRANSACTIONS, project2)
        == {"first_run": 946688400, "last_run": 946688400, "runs": 1}
    )

    # Clear transactions if batch minimum is not met
    assert list(get_transaction_names(project1)) == []
    assert list(get_transaction_names(project2)) == []

    _add_mock_data(project1, 10)
    _add_mock_data(project2, 10)

    # add more transactions to the project 1
    for i in range(5):
        _record_sample(
            ClustererNamespace.TRANSACTIONS, project1, f"/users/trans/tx-{project1.id}-{i}"
        )
        _record_sample(ClustererNamespace.TRANSACTIONS, project1, f"/test/path/{i}")

    # Add a transaction to project2 so it runs again
    _record_sample(ClustererNamespace.TRANSACTIONS, project2, "foo")

    with (
        mock.patch("sentry.ingest.transaction_clusterer.tasks.PROJECTS_PER_TASK", 1),
        freeze_time("2000-01-01 01:00:01"),
    ):
        spawn_clusterers()

    # One project per batch now:
    assert cluster_projects_delay.call_count == 2, cluster_projects_delay.call_args

    pr_rules = get_rules(ClustererNamespace.TRANSACTIONS, project1)
    assert pr_rules.keys() == {
        "/org/*/**",
        "/user/*/**",
        "/test/path/*/**",
        "/users/trans/*/**",
    }

    assert (
        get_clusterer_meta(ClustererNamespace.TRANSACTIONS, project1)
        == get_clusterer_meta(ClustererNamespace.TRANSACTIONS, project2)
        == {"first_run": 946688400, "last_run": 946688401, "runs": 2}
    )


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 2)
@mock.patch("sentry.ingest.transaction_clusterer.tasks.MERGE_THRESHOLD", 2)
@mock.patch("sentry.ingest.transaction_clusterer.rules.update_rules")
@django_db_all
def test_clusterer_only_runs_when_enough_transactions(mock_update_rules, default_project):
    project = default_project
    assert get_rules(ClustererNamespace.TRANSACTIONS, project) == {}

    _record_sample(ClustererNamespace.TRANSACTIONS, project, "/transaction/number/1")
    cluster_projects([project])
    # Clusterer didn't create rules. Still, it updates the stores.
    assert mock_update_rules.call_count == 1
    assert mock_update_rules.call_args == mock.call(ClustererNamespace.TRANSACTIONS, project, [])
    # Transaction names are deleted if there aren't enough
    assert get_rules(ClustererNamespace.TRANSACTIONS, project) == {}

    _record_sample(ClustererNamespace.TRANSACTIONS, project, "/transaction/number/1")
    _record_sample(ClustererNamespace.TRANSACTIONS, project, "/transaction/number/2")
    cluster_projects([project])
    assert mock_update_rules.call_count == 2
    assert mock_update_rules.call_args == mock.call(
        ClustererNamespace.TRANSACTIONS, project, ["/transaction/number/*/**"]
    )


@django_db_all
def test_get_deleted_project():
    deleted_project = Project(pk=666, organization=Organization(pk=666))
    _record_sample(ClustererNamespace.TRANSACTIONS, deleted_project, "foo")
    assert list(get_active_projects(ClustererNamespace.TRANSACTIONS)) == []


@django_db_all
def test_transaction_clusterer_generates_rules(default_project):
    def _get_projconfig_tx_rules(project: Project):
        return get_project_config(project).to_dict()["config"].get("txNameRules")

    feature = "organizations:transaction-name-normalize"
    with Feature({feature: False}):
        assert _get_projconfig_tx_rules(default_project) is None
    with Feature({feature: True}):
        assert _get_projconfig_tx_rules(default_project) is None

    rules = {ReplacementRule("/rule/*/0/**"): 0, ReplacementRule("/rule/*/1/**"): 1}
    ProjectOptionRuleStore(ClustererNamespace.TRANSACTIONS).write(default_project, rules)

    with Feature({feature: False}):
        assert _get_projconfig_tx_rules(default_project) is None
    with Feature({feature: True}):
        assert _get_projconfig_tx_rules(default_project) == [
            # TTL is 90d, so three months to expire
            {
                "pattern": "/rule/*/0/**",
                "expiry": "1970-04-01T00:00:00Z",
                "redaction": {"method": "replace", "substitution": "*"},
            },
            {
                "pattern": "/rule/*/1/**",
                "expiry": "1970-04-01T00:00:01Z",
                "redaction": {"method": "replace", "substitution": "*"},
            },
        ]


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 10)
@mock.patch("sentry.ingest.transaction_clusterer.tasks.MERGE_THRESHOLD", 5)
@mock.patch(
    "sentry.ingest.transaction_clusterer.tasks.cluster_projects.delay",
    wraps=cluster_projects,  # call immediately
)
@django_db_all
def test_transaction_clusterer_bumps_rules(_, default_organization):
    project1 = Project(id=123, name="project1", organization_id=default_organization.id)
    project1.save()

    with override_options({"txnames.bump-lifetime-sample-rate": 1.0}):
        for i in range(10):
            _record_sample(
                ClustererNamespace.TRANSACTIONS, project1, f"/user/tx-{project1.name}-{i}/settings"
            )

        with mock.patch("sentry.ingest.transaction_clusterer.rules._now", lambda: 1):
            spawn_clusterers()

        assert get_rules(ClustererNamespace.TRANSACTIONS, project1) == {"/user/*/**": 1}

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

        # _get_rules fetches from project options, which arent updated yet.
        assert get_redis_rules(ClustererNamespace.TRANSACTIONS, project1) == {"/user/*/**": 2}
        assert get_rules(ClustererNamespace.TRANSACTIONS, project1) == {"/user/*/**": 1}
        # Update rules to update the project option storage.
        with mock.patch("sentry.ingest.transaction_clusterer.rules._now", lambda: 3):
            assert 0 == update_rules(ClustererNamespace.TRANSACTIONS, project1, [])
        # After project options are updated, the last_seen should also be updated.
        assert get_redis_rules(ClustererNamespace.TRANSACTIONS, project1) == {"/user/*/**": 2}
        assert get_rules(ClustererNamespace.TRANSACTIONS, project1) == {"/user/*/**": 2}


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 3)
@mock.patch("sentry.ingest.transaction_clusterer.tasks.MERGE_THRESHOLD", 2)
@mock.patch(
    "sentry.ingest.transaction_clusterer.tasks.cluster_projects.delay",
    wraps=cluster_projects,  # call immediately
)
@django_db_all
def test_dont_store_inexisting_rules(_, default_organization):
    rogue_transaction = {
        "transaction": "/transaction/for/rogue/*/rule",
        "transaction_info": {"source": "sanitized"},
        "_meta": {
            "transaction": {
                "": {
                    "rem": [
                        ["int", "s", 0, 0],
                        ["/i/am/a/rogue/rule/dont/store/me/**", "s"],
                    ],
                    "val": "/transaction/for/rogue/hola/rule",
                }
            }
        },
    }

    with override_options({"txnames.bump-lifetime-sample-rate": 1.0}):
        project1 = Project(id=234, name="project1", organization_id=default_organization.id)
        project1.save()
        for i in range(3):
            _record_sample(
                ClustererNamespace.TRANSACTIONS, project1, f"/user/tx-{project1.name}-{i}/settings"
            )

        with mock.patch("sentry.ingest.transaction_clusterer.rules._now", lambda: 1):
            spawn_clusterers()

        record_transaction_name(
            project1,
            rogue_transaction,
        )

        assert get_rules(ClustererNamespace.TRANSACTIONS, project1) == {"/user/*/**": 1}


@django_db_all
def test_stale_rules_arent_saved(default_project):
    assert len(get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project)) == 0

    with freeze_time("2000-01-01 01:00:00"):
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [ReplacementRule("foo/foo")])
    assert get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project) == [
        ("foo/foo", 946688400)
    ]

    with freeze_time("2000-02-02 02:00:00"):
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [ReplacementRule("bar/bar")])
    assert get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project) == [
        ("bar/bar", 949456800),
        ("foo/foo", 946688400),
    ]

    with freeze_time("2001-01-01 01:00:00"):
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [ReplacementRule("baz/baz")])
    assert get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project) == [
        ("baz/baz", 978310800)
    ]


def test_bump_last_used():
    """Redis update works and does not delete other keys in the set."""
    project1 = Project(id=123, name="project1")
    RedisRuleStore(namespace=ClustererNamespace.TRANSACTIONS).write(
        project1, {ReplacementRule("foo"): 1, ReplacementRule("bar"): 2}
    )
    assert get_redis_rules(ClustererNamespace.TRANSACTIONS, project1) == {"foo": 1, "bar": 2}
    with freeze_time("2000-01-01 01:00:00"):
        bump_last_used(ClustererNamespace.TRANSACTIONS, project1, "bar")
    assert get_redis_rules(ClustererNamespace.TRANSACTIONS, project1) == {
        "foo": 1,
        "bar": 946688400,
    }


@django_db_all
def test_stored_invalid_rules_dropped_on_update(default_project):
    """
    Validate that invalid rules are removed from storage even if they already
    exist there. Updates before and after the removal don't impact the outcome.
    """
    rule = ReplacementRule("http://*/*/**")

    assert len(get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project)) == 0
    RedisRuleStore(namespace=ClustererNamespace.TRANSACTIONS).write(default_project, {rule: 1})
    assert get_redis_rules(ClustererNamespace.TRANSACTIONS, default_project) == {rule: 1}
    with freeze_time("2000-01-01 01:00:00"):
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [rule])
    assert get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project) == []
    with freeze_time("2000-01-01 01:00:00"):
        update_rules(ClustererNamespace.TRANSACTIONS, default_project, [rule])
    assert get_sorted_rules(ClustererNamespace.TRANSACTIONS, default_project) == []

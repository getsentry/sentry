from unittest import mock

from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.ingest.transaction_clusterer.datasource.redis import (
    _record_sample,
    clear_samples,
    get_active_projects,
    get_span_descriptions,
    record_span_descriptions,
)
from sentry.ingest.transaction_clusterer.meta import get_clusterer_meta
from sentry.ingest.transaction_clusterer.rules import (
    ProjectOptionRuleStore,
    get_rules,
    get_sorted_rules,
    update_rules,
)
from sentry.ingest.transaction_clusterer.tasks import (
    cluster_projects_span_descs,
    spawn_clusterers_span_descs,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 5)
def test_collection():
    org = Organization(pk=666)
    project1 = Project(id=101, name="p1", organization=org)
    project2 = Project(id=102, name="project2", organization=org)

    for project in (project1, project2):
        for i in range(len(project.name)):
            _record_sample(ClustererNamespace.SPANS, project, f"span.desc-{project.name}-{i}")
            _record_sample(ClustererNamespace.SPANS, project, f"span.desc-{project.name}-{i}")

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
    _record_sample(ClustererNamespace.SPANS, project, "foo")
    assert set(get_span_descriptions(project)) == {"foo"}
    clear_samples(ClustererNamespace.SPANS, project)
    assert set(get_span_descriptions(project)) == set()

    # Deleting for a none-existing project does not crash:
    project2 = Project(id=666, name="project2", organization=Organization(pk=66))
    clear_samples(ClustererNamespace.SPANS, project2)


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 100)
def test_distribution():
    """Make sure that the redis set prefers newer entries"""
    project = Project(id=103, name="", organization=Organization(pk=66))
    for i in range(1000):
        _record_sample(ClustererNamespace.SPANS, project, str(i))

    freshness = sum(map(int, get_span_descriptions(project))) / 100

    # The average is usually around ~900, check for > 800 to be on the safe side
    assert freshness > 800, freshness


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis._record_sample")
@django_db_all
def test_record_span_desc_url(mocked_record, default_organization):
    with Feature(
        {
            "projects:span-metrics-extraction": True,
        }
    ):
        project = Project(id=111, name="project", organization_id=default_organization.id)
        record_span_descriptions(
            project,
            {
                "spans": [
                    {
                        "op": "resource.css",
                        "description": "https://www.domain.com/jane/path/to/something.en-us.js;p?q=s",
                    },
                    {
                        "op": "resource.css",
                        "description": "webroot/my.js",
                    },
                ],
            },
        )
        assert mocked_record.mock_calls == [
            mock.call(
                ClustererNamespace.SPANS,
                Project(id=111, name="project", slug=None),
                "www.domain.com/jane/path/to/something.en-us.js",
            ),
            mock.call(
                ClustererNamespace.SPANS,
                Project(id=111, name="project", slug=None),
                "webroot/my.js",
            ),
        ]


def test_sort_rules():
    rules = {
        ReplacementRule("/a/*/**"): 1,
        ReplacementRule("/a/**"): 2,
        ReplacementRule("/a/*/c/**"): 3,
    }
    assert ProjectOptionRuleStore(ClustererNamespace.SPANS)._sort(rules) == [
        ("/a/*/c/**", 3),
        ("/a/*/**", 1),
        ("/a/**", 2),
    ]


@mock.patch("sentry.ingest.transaction_clusterer.rules.CompositeRuleStore.MERGE_MAX_RULES", 2)
@django_db_all
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


@django_db_all
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


# From the test -- number of transactions: 30 == 10 * 2 + 5 * 2
@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 30)
@mock.patch("sentry.ingest.transaction_clusterer.tasks.MERGE_THRESHOLD_SPANS", 5)
@mock.patch(
    "sentry.ingest.transaction_clusterer.tasks.cluster_projects_span_descs.delay",
    wraps=cluster_projects_span_descs,  # call immediately
)
@django_db_all
@freeze_time("2000-01-01 01:00:00")
def test_run_clusterer_task(cluster_projects_span_descs, default_organization):
    def _add_mock_data(proj, number):
        for i in range(0, number):
            _record_sample(ClustererNamespace.SPANS, proj, f"/user/span.desc-{proj.name}-{i}")
            _record_sample(ClustererNamespace.SPANS, proj, f"/org/span.desc-{proj.name}-{i}")

    with Feature({"projects:span-metrics-extraction", True}):
        project1 = Project(id=123, name="project1", organization_id=default_organization.id)
        project2 = Project(id=223, name="project2", organization_id=default_organization.id)

        for project in (project1, project2):
            project.save()
            _add_mock_data(project, 4)

        assert (
            get_clusterer_meta(ClustererNamespace.SPANS, project1)
            == get_clusterer_meta(ClustererNamespace.SPANS, project2)
            == {"first_run": 0, "last_run": 0, "runs": 0}
        )

        spawn_clusterers_span_descs()

        assert cluster_projects_span_descs.call_count == 1
        cluster_projects_span_descs.reset_mock()

        # Not stored enough transactions yet
        assert get_rules(ClustererNamespace.SPANS, project1) == {}
        assert get_rules(ClustererNamespace.SPANS, project2) == {}

        assert (
            get_clusterer_meta(ClustererNamespace.SPANS, project1)
            == get_clusterer_meta(ClustererNamespace.SPANS, project2)
            == {"first_run": 946688400, "last_run": 946688400, "runs": 1}
        )

        # Clear transactions if batch minimum is not met
        assert list(get_span_descriptions(project1)) == []
        assert list(get_span_descriptions(project2)) == []

        _add_mock_data(project1, 10)
        _add_mock_data(project2, 10)

        # add more span descriptions to the project 1
        for i in range(5):
            _record_sample(
                ClustererNamespace.SPANS, project1, f"/users/spans.desc/span-{project1.id}-{i}"
            )
            _record_sample(ClustererNamespace.SPANS, project1, f"/test/path/{i}")

        # Add a transaction to project2 so it runs again
        _record_sample(ClustererNamespace.SPANS, project2, "foo")

        with mock.patch(
            "sentry.ingest.transaction_clusterer.tasks.PROJECTS_PER_TASK", 1
        ), freeze_time("2000-01-01 01:00:01"):
            spawn_clusterers_span_descs()

        # One project per batch now:
        assert cluster_projects_span_descs.call_count == 2, cluster_projects_span_descs.call_args

        rules = get_rules(ClustererNamespace.SPANS, project1)
        assert rules.keys() == {
            "/org/*/**",
            "/user/*/**",
            "/test/path/*/**",
            "/users/spans.desc/*/**",
        }

        assert (
            get_clusterer_meta(ClustererNamespace.SPANS, project1)
            == get_clusterer_meta(ClustererNamespace.SPANS, project2)
            == {"first_run": 946688400, "last_run": 946688401, "runs": 2}
        )


@mock.patch("sentry.ingest.transaction_clusterer.datasource.redis.MAX_SET_SIZE", 2)
@mock.patch("sentry.ingest.transaction_clusterer.tasks.MERGE_THRESHOLD_SPANS", 2)
@mock.patch("sentry.ingest.transaction_clusterer.rules.update_rules")
@django_db_all
def test_clusterer_only_runs_when_enough_data(mock_update_rules, default_project):
    project = default_project
    assert get_rules(ClustererNamespace.SPANS, project) == {}

    _record_sample(ClustererNamespace.SPANS, project, "/span-desc/number/1")
    cluster_projects_span_descs([project])
    # Clusterer didn't create rules. Still, it updates the stores.
    assert mock_update_rules.call_count == 1
    assert mock_update_rules.call_args == mock.call(ClustererNamespace.SPANS, project, [])
    # Transaction names are deleted if there aren't enough
    assert get_rules(ClustererNamespace.SPANS, project) == {}

    _record_sample(ClustererNamespace.SPANS, project, "http://domain.com/span-desc/number/1")
    _record_sample(ClustererNamespace.SPANS, project, "http://domain.com/span-desc/number/2")
    cluster_projects_span_descs([project])
    assert mock_update_rules.call_count == 2
    assert mock_update_rules.call_args == mock.call(
        ClustererNamespace.SPANS, project, ["http://domain.com/span-desc/number/*/**"]
    )


@django_db_all
def test_get_deleted_project():
    deleted_project = Project(pk=666, organization=Organization(pk=666))
    _record_sample(ClustererNamespace.SPANS, deleted_project, "foo")
    assert list(get_active_projects(ClustererNamespace.SPANS)) == []


@django_db_all
def test_record_span_descriptions_no_databag(default_organization):
    """Verify a `None` databag doesn't break the span description clusterer."""
    with Feature("projects:span-metrics-extraction"), override_options(
        {"span_descs.bump-lifetime-sample-rate": 1.0}
    ):
        payload = {
            "spans": [
                {
                    "op": "resource.css",
                },
            ],
        }

        project = Project(id=123, name="project", organization_id=default_organization.id)
        record_span_descriptions(project, payload)


@django_db_all
def test_stale_rules_arent_saved(default_project):
    assert len(get_sorted_rules(ClustererNamespace.SPANS, default_project)) == 0

    with freeze_time("2000-01-01 01:00:00"):
        update_rules(ClustererNamespace.SPANS, default_project, [ReplacementRule("foo/foo")])
    assert get_sorted_rules(ClustererNamespace.SPANS, default_project) == [("foo/foo", 946688400)]

    with freeze_time("2000-02-02 02:00:00"):
        update_rules(ClustererNamespace.SPANS, default_project, [ReplacementRule("bar/bar")])
    assert get_sorted_rules(ClustererNamespace.SPANS, default_project) == [
        ("bar/bar", 949456800),
        ("foo/foo", 946688400),
    ]

    with freeze_time("2001-01-01 01:00:00"):
        update_rules(ClustererNamespace.SPANS, default_project, [ReplacementRule("baz/baz")])
    assert get_sorted_rules(ClustererNamespace.SPANS, default_project) == [("baz/baz", 978310800)]

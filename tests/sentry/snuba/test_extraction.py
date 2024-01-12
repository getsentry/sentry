from unittest.mock import patch

import pytest

from sentry.api.event_search import ParenExpression, parse_search_query
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import (
    OnDemandMetricSpec,
    SearchQueryConverter,
    apdex_tag_spec,
    cleanup_search_query,
    failure_tag_spec,
    query_tokens_to_string,
    should_use_on_demand_metrics,
    to_standard_metrics_query,
)
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.mark.parametrize(
    "agg, query, result",
    [
        ("count()", "release:a", False),  # supported by standard metrics
        ("failure_rate()", "release:a", False),  # supported by standard metrics
        ("count_unique(geo.city)", "release:a", False),
        # geo.city not supported by standard metrics, but also not by on demand
        (
            "count()",
            "transaction.duration:>1",
            True,
        ),  # transaction.duration not supported by standard metrics
        ("failure_count()", "transaction.duration:>1", True),  # supported by on demand
        ("failure_rate()", "transaction.duration:>1", True),  # supported by on demand
        ("apdex(10)", "", True),  # every apdex query is on-demand
        ("apdex(10)", "transaction.duration:>10", True),  # supported by on demand
        (
            "count_if(transaction.duration,equals,0)",
            "release:a",
            False,
        ),  # count_if supported by standard metrics
        ("p75(transaction.duration)", "release:a", False),  # supported by standard metrics
        (
            "p75(transaction.duration)",
            "transaction.duration:>1",
            True,
        ),  # transaction.duration query is on-demand
        ("p90(transaction.duration)", "release:a", False),  # supported by standard metrics
        (
            "p90(transaction.duration)",
            "transaction.duration:>1",
            True,
        ),  # transaction.duration query is on-demand
        (
            "percentile(transaction.duration, 0.9)",
            "release:a",
            False,
        ),  # supported by standard metrics
        (
            "percentile(transaction.duration, 0.9)",
            "transaction.duration:>1",
            True,
        ),  # transaction.duration query is on-demand
        (
            "percentile(transaction.duration, 0.90)",
            "release:a",
            False,
        ),  # supported by standard metrics
        (
            "percentile(transaction.duration, 0.90)",
            "transaction.duration:>1",
            True,
        ),
        ("count()", "", False),  # Malformed aggregate should return false
        (
            "count()",
            "event.type:error transaction.duration:>0",
            False,
        ),  # event.type:error not supported by metrics
        (
            "count()",
            "event.type:default transaction.duration:>0",
            False,
        ),  # event.type:error not supported by metrics
        (
            "count()",
            "error.handled:true transaction.duration:>0",
            False,
        ),  # error.handled is an error search term
    ],
)
def test_should_use_on_demand(agg, query, result) -> None:
    assert should_use_on_demand_metrics(Dataset.PerformanceMetrics, agg, query) is result


@pytest.mark.parametrize(
    "agg, query, result",
    [
        ("sum(c:custom/page_load@millisecond)", "release:a", False),
        ("sum(c:custom/page_load@millisecond)", "transaction.duration:>0", False),
        (
            "p75(d:transactions/measurements.fcp@millisecond)",
            "release:a",
            False,
        ),
        (
            "p75(d:transactions/measurements.fcp@millisecond)",
            "transaction.duration:>0",
            False,
        ),
        (
            "p95(d:spans/duration@millisecond)",
            "release:a",
            False,
        ),
        (
            "p95(d:spans/duration@millisecond)",
            "transaction.duration:>0",
            False,
        ),
    ],
)
def test_should_use_on_demand_with_mri(agg, query, result) -> None:
    assert should_use_on_demand_metrics(Dataset.PerformanceMetrics, agg, query) is result


def create_spec_if_needed(dataset, agg, query) -> OnDemandMetricSpec | None:
    return (
        OnDemandMetricSpec(agg, query)
        if should_use_on_demand_metrics(dataset, agg, query)
        else None
    )


class TestCreatesOndemandMetricSpec:
    dataset = Dataset.PerformanceMetrics

    @pytest.mark.parametrize(
        "aggregate, query",
        [
            # transaction duration not supported by standard metrics
            ("count()", "transaction.duration:>0"),
            ("count()", "user.ip:192.168.0.1"),
            ("count()", "user.username:foobar"),
            ("count()", "transaction.duration:>0 event.type:transaction project:abc"),
            ("count()", "(transaction.duration:>0) AND (event.type:transaction)"),
            ("p75(measurements.fp)", "transaction.duration:>0"),
            ("p75(transaction.duration)", "transaction.duration:>0"),
            ("p100(transaction.duration)", "transaction.duration:>0"),
            # we don't support custom percentiles that can be mapped to one of standard percentiles
            ("percentile(transaction.duration, 0.5)", "transaction.duration>0"),
            ("percentile(transaction.duration, 0.50)", "transaction.duration>0"),
            ("percentile(transaction.duration, 0.9)", "transaction.duration>0"),
            ("percentile(transaction.duration, 0.90)", "transaction.duration>0"),
            ("percentile(transaction.duration, 0.95)", "transaction.duration>0"),
            ("percentile(transaction.duration, 0.99)", "transaction.duration>0"),
            ("percentile(transaction.duration, 1)", "transaction.duration>0"),
            ("count_if(transaction.duration,equals,0)", "transaction.duration:>0"),
            ("count_if(transaction.duration,notEquals,0)", "transaction.duration:>0"),
            (
                "count()",
                "project:a-1 route.action:CloseBatch level:info",  # custom tags not supported by standard metrics
            ),
            ("count()", "transaction.duration:[1,2,3]"),
            ("count()", "project:a_1 or project:b-2 or transaction.duration:>0"),
            ("count()", "foo:bar"),  # custom tags not supported by standard metrics
            ("failure_count()", "transaction.duration:>100"),
            ("failure_rate()", "transaction.duration:>100"),
            ("apdex(10)", "transaction.duration:>100"),
            (
                "count_web_vitals(measurements.fcp,any)",
                "transaction.duration:>0",
            ),  # count_web_vitals supported by on demand
            (
                "apdex(10)",
                "",
            ),  # apdex with specified threshold is on-demand metric even without query
            ("count()", "transaction.duration:>0 my-transaction"),
            ("count()", "transaction.source:route"),
        ],
    )
    def test_creates_on_demand_spec(self, aggregate, query) -> None:
        assert create_spec_if_needed(self.dataset, aggregate, query)

    @pytest.mark.parametrize(
        "aggregate, query",
        [
            ("count()", "release:a"),  # supported by standard metrics
            (
                "count_unique(user)",
                "transaction.duration:>0",
            ),  # count_unique not supported by on demand
            ("last_seen()", "transaction.duration:>0"),  # last_seen not supported by on demand
            ("any(user)", "transaction.duration:>0"),  # any not supported by on demand
            ("p95(transaction.duration)", ""),  # p95 without query is supported by standard metrics
            # we do not support custom percentiles that can not be mapped to one of standard percentiles
            ("percentile(transaction.duration, 0.123)", "transaction.duration>0"),
            (
                "count()",
                "p75(transaction.duration):>0",
            ),  # p75 without query is supported by standard metrics
            ("message", "transaction.duration:>0"),  # message not supported by on demand
            (
                "equation| count() / count()",
                "transaction.duration:>0",
            ),  # equation not supported by on demand
            ("p75(measurements.lcp)", "!event.type:transaction"),  # supported by standard metrics
            # supported by standard metrics
            ("p95(measurements.lcp)", ""),
            ("avg(spans.http)", ""),
            ("failure_count()", ""),
            ("failure_rate()", "release:bar"),
            ("failure_rate()", ""),
        ],
    )
    def test_does_not_create_on_demand_spec(self, aggregate, query) -> None:
        assert not create_spec_if_needed(self.dataset, aggregate, query)


@pytest.mark.parametrize(
    "percentile",
    [0.5, 0.75, 0.9, 0.95, 0.99],
)
def test_spec_equivalence_with_percentiles(percentile) -> None:
    fixed_percentile = f"p{int(percentile * 100)}"

    spec_1 = OnDemandMetricSpec(f"{fixed_percentile}(measurements.fp)", "transaction.duration:>1s")
    spec_2 = OnDemandMetricSpec(
        f"percentile(measurements.fp, {percentile})", "transaction.duration:>1s"
    )

    assert spec_1._metric_type == spec_2._metric_type
    assert spec_1.field_to_extract == spec_2.field_to_extract
    assert spec_1.op == spec_2.op
    assert spec_1.condition == spec_2.condition


def test_spec_simple_query_count() -> None:
    spec = OnDemandMetricSpec("count()", "transaction.duration:>1s")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "sum"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_simple_query_distribution() -> None:
    spec = OnDemandMetricSpec("p75(measurements.fp)", "transaction.duration:>1s")

    assert spec._metric_type == "d"
    assert spec.field_to_extract == "event.measurements.fp.value"
    assert spec.op == "p75"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}


def test_spec_simple_query_with_environment() -> None:
    spec = OnDemandMetricSpec("count()", "transaction.duration:>1s", "production")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "sum"
    assert spec.condition == {
        "inner": [
            {"name": "event.environment", "op": "eq", "value": "production"},
            {"name": "event.duration", "op": "gt", "value": 1000.0},
        ],
        "op": "and",
    }


def test_spec_simple_query_with_environment_only() -> None:
    # We use apdex, since it's the only metric which is on demand also without a query.
    spec = OnDemandMetricSpec("apdex(0.8)", "", "production")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "on_demand_apdex"
    assert spec.condition == {"name": "event.environment", "op": "eq", "value": "production"}


def test_spec_context_mapping() -> None:
    spec = OnDemandMetricSpec("count()", "device:SM-A226B")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "sum"
    assert spec.condition == {
        "name": "event.contexts.device.model",
        "op": "eq",
        "value": "SM-A226B",
    }


def test_spec_query_or_precedence_with_environment() -> None:
    spec_1 = OnDemandMetricSpec(
        "count()", "(transaction.duration:>1s OR http.status_code:200)", "dev"
    )
    spec_2 = OnDemandMetricSpec(
        "count()", "transaction.duration:>1s OR http.status_code:200", "dev"
    )

    assert spec_1._metric_type == "c"
    assert spec_1.field_to_extract is None
    assert spec_1.op == "sum"
    assert spec_1.condition == {
        "inner": [
            {"name": "event.environment", "op": "eq", "value": "dev"},
            {
                "inner": [
                    {"name": "event.duration", "op": "gt", "value": 1000.0},
                    {"name": "event.contexts.response.status_code", "op": "eq", "value": "200"},
                ],
                "op": "or",
            },
        ],
        "op": "and",
    }
    # We check whether the conditions are identical, since we expect that the environment injection preserves the
    # semantics of the query.
    assert spec_1.condition == spec_2.condition


def test_spec_count_if_query_with_environment() -> None:
    spec = OnDemandMetricSpec(
        "count_if(transaction.duration,equals,300)",
        "(http.method:GET AND endpoint:/hello)",
        "production",
    )

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "sum"
    assert spec.condition == {
        "inner": [
            {"name": "event.environment", "op": "eq", "value": "production"},
            {
                "inner": [
                    {"name": "event.request.method", "op": "eq", "value": "GET"},
                    {"name": "event.tags.endpoint", "op": "eq", "value": "/hello"},
                ],
                "op": "and",
            },
            {"name": "event.duration", "op": "eq", "value": 300.0},
        ],
        "op": "and",
    }


def test_spec_complex_query_with_environment() -> None:
    spec = OnDemandMetricSpec(
        "count()",
        "transaction.duration:>1s AND http.status_code:200 OR os.browser:Chrome",
        "staging",
    )

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "sum"
    # We care about keeping the precedence order being preserved and not the environment being injected taking
    # precedence.
    assert spec.condition == {
        "inner": [
            {"name": "event.environment", "op": "eq", "value": "staging"},
            {
                "inner": [
                    {
                        "inner": [
                            {"name": "event.duration", "op": "gt", "value": 1000.0},
                            {
                                "name": "event.contexts.response.status_code",
                                "op": "eq",
                                "value": "200",
                            },
                        ],
                        "op": "and",
                    },
                    {"name": "event.tags.os.browser", "op": "eq", "value": "Chrome"},
                ],
                "op": "or",
            },
        ],
        "op": "and",
    }


def test_spec_or_condition() -> None:
    spec = OnDemandMetricSpec("count()", "transaction.duration:>=100 OR transaction.duration:<1000")

    assert spec.condition == {
        "inner": [
            {"name": "event.duration", "op": "gte", "value": 100.0},
            {"name": "event.duration", "op": "lt", "value": 1000.0},
        ],
        "op": "or",
    }


def test_spec_and_condition() -> None:
    spec = OnDemandMetricSpec("count()", "release:foo transaction.duration:<10s")

    assert spec.condition == {
        "inner": [
            {"name": "event.release", "op": "eq", "value": "foo"},
            {"name": "event.duration", "op": "lt", "value": 10000.0},
        ],
        "op": "and",
    }


def test_spec_nested_condition() -> None:
    spec = OnDemandMetricSpec("count()", "(release:a OR transaction.op:b) transaction.duration:>1s")

    assert spec.condition == {
        "op": "and",
        "inner": [
            {
                "op": "or",
                "inner": [
                    {"name": "event.release", "op": "eq", "value": "a"},
                    {"name": "event.contexts.trace.op", "op": "eq", "value": "b"},
                ],
            },
            {"name": "event.duration", "op": "gt", "value": 1000.0},
        ],
    }


def test_spec_boolean_precedence() -> None:
    spec = OnDemandMetricSpec("count()", "release:a OR transaction.op:b transaction.duration:>1s")

    assert spec.condition == {
        "op": "or",
        "inner": [
            {"name": "event.release", "op": "eq", "value": "a"},
            {
                "op": "and",
                "inner": [
                    {"name": "event.contexts.trace.op", "op": "eq", "value": "b"},
                    {"name": "event.duration", "op": "gt", "value": 1000.0},
                ],
            },
        ],
    }


def test_spec_wildcard() -> None:
    spec = OnDemandMetricSpec("count()", "release.version:1.*")

    assert spec.condition == {
        "name": "event.release.version.short",
        "op": "glob",
        "value": ["1.*"],
    }


def test_spec_count_if() -> None:
    spec = OnDemandMetricSpec("count_if(transaction.duration,equals,300)", "")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "sum"
    assert spec.condition == {
        "name": "event.duration",
        "op": "eq",
        "value": 300.0,
    }


def test_spec_count_if_with_query() -> None:
    spec = OnDemandMetricSpec(
        "count_if(transaction.duration,equals,300)", "release:a OR transaction.op:b"
    )

    assert spec.condition == {
        "op": "and",
        "inner": [
            {
                "op": "or",
                "inner": [
                    {"name": "event.release", "op": "eq", "value": "a"},
                    {"name": "event.contexts.trace.op", "op": "eq", "value": "b"},
                ],
            },
            {"name": "event.duration", "op": "eq", "value": 300.0},
        ],
    }


def test_spec_in_operator() -> None:
    in_spec = OnDemandMetricSpec("count()", "transaction.duration:[1,2,3]")
    not_in_spec = OnDemandMetricSpec("count()", "!transaction.duration:[1,2,3]")

    assert in_spec.condition == {"name": "event.duration", "op": "eq", "value": [1.0, 2.0, 3.0]}
    assert not_in_spec.condition == {
        "inner": {"name": "event.duration", "op": "eq", "value": [1.0, 2.0, 3.0]},
        "op": "not",
    }


def test_spec_with_custom_measurement() -> None:
    spec = OnDemandMetricSpec("avg(measurements.memoryUsed)", "measurements.memoryUsed:>100")

    assert spec._metric_type == "d"
    assert spec.field_to_extract == "event.measurements.memoryUsed.value"
    assert spec.op == "avg"
    assert spec.condition == {
        "name": "event.measurements.memoryUsed.value",
        "op": "gt",
        "value": 100.0,
    }


def test_spec_with_has() -> None:
    spec = OnDemandMetricSpec(
        "avg(measurements.lcp)", "has:measurements.lcp AND !has:measurements.memoryUsage"
    )

    assert spec._metric_type == "d"
    assert spec.field_to_extract == "event.measurements.lcp.value"
    assert spec.op == "avg"
    assert spec.condition == {
        "inner": [
            {
                "inner": {"name": "event.measurements.lcp.value", "op": "eq", "value": None},
                "op": "not",
            },
            {"name": "event.measurements.memoryUsage.value", "op": "eq", "value": None},
        ],
        "op": "and",
    }


def test_spec_with_message() -> None:
    spec = OnDemandMetricSpec(
        "avg(measurements.lcp)", 'message:"issues" AND !message:"alerts" AND "api"'
    )

    assert spec._metric_type == "d"
    assert spec.field_to_extract == "event.measurements.lcp.value"
    assert spec.op == "avg"
    assert spec.condition == {
        "inner": [
            {"name": "event.transaction", "op": "glob", "value": ["*issues*"]},
            {
                "inner": {"name": "event.transaction", "op": "glob", "value": ["*alerts*"]},
                "op": "not",
            },
            {"name": "event.transaction", "op": "glob", "value": ["*api*"]},
        ],
        "op": "and",
    }


def test_spec_with_unknown_error_status() -> None:
    spec = OnDemandMetricSpec(
        "avg(measurements.lcp)", "transaction.status:unknown_error OR transaction.status:unknown"
    )

    assert spec._metric_type == "d"
    assert spec.field_to_extract == "event.measurements.lcp.value"
    assert spec.op == "avg"
    assert spec.condition == {
        "inner": [
            {"name": "event.contexts.trace.status", "op": "eq", "value": "unknown"},
            {"name": "event.contexts.trace.status", "op": "eq", "value": "unknown"},
        ],
        "op": "or",
    }


def test_spec_ignore_fields() -> None:
    with_ignored_field = OnDemandMetricSpec("count()", "transaction.duration:>=1 project:sentry")
    without_ignored_field = OnDemandMetricSpec("count()", "transaction.duration:>=1")

    assert with_ignored_field.condition == without_ignored_field.condition


@django_db_all
def test_spec_failure_count(default_project) -> None:
    spec = OnDemandMetricSpec("failure_count()", "transaction.duration:>1s")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "on_demand_failure_count"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}
    assert spec.tags_conditions(default_project) == failure_tag_spec(default_project, ["not_used"])


@django_db_all
def test_spec_failure_rate(default_project) -> None:
    spec = OnDemandMetricSpec("failure_rate()", "transaction.duration:>1s")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "on_demand_failure_rate"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}
    assert spec.tags_conditions(default_project) == failure_tag_spec(default_project, ["not_used"])


@django_db_all
@patch("sentry.snuba.metrics.extraction._get_satisfactory_threshold_and_metric")
def test_spec_apdex(_get_satisfactory_threshold_and_metric, default_project) -> None:
    _get_satisfactory_threshold_and_metric.return_value = 100, "transaction.duration"

    spec = OnDemandMetricSpec("apdex(10)", "release:a")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "on_demand_apdex"
    assert spec.condition == {"name": "event.release", "op": "eq", "value": "a"}
    assert spec.tags_conditions(default_project) == apdex_tag_spec(default_project, ["10"])


@django_db_all
@patch("sentry.snuba.metrics.extraction._get_satisfactory_threshold_and_metric")
def test_spec_apdex_decimal(_get_satisfactory_threshold_and_metric, default_project) -> None:
    _get_satisfactory_threshold_and_metric.return_value = 100, "transaction.duration"

    spec = OnDemandMetricSpec("apdex(0.8)", "release:a")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "on_demand_apdex"
    assert spec.condition == {"name": "event.release", "op": "eq", "value": "a"}
    assert spec.tags_conditions(default_project) == apdex_tag_spec(default_project, ["0.8"])


@django_db_all
def test_spec_epm(default_project) -> None:
    spec = OnDemandMetricSpec("epm()", "transaction.duration:>1s")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "on_demand_epm"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}
    assert spec.tags_conditions(default_project) == []


@django_db_all
def test_spec_eps(default_project) -> None:
    spec = OnDemandMetricSpec("eps()", "transaction.duration:>1s")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "on_demand_eps"
    assert spec.condition == {"name": "event.duration", "op": "gt", "value": 1000.0}
    assert spec.tags_conditions(default_project) == []


def test_cleanup_equivalent_specs() -> None:
    simple_spec = OnDemandMetricSpec("count()", "transaction.duration:>0")
    event_type_spec = OnDemandMetricSpec(
        "count()", "transaction.duration:>0 event.type:transaction"
    )
    parens_spec = OnDemandMetricSpec(
        "count()", "(transaction.duration:>0) AND (event.type:transaction) AND (project:foo)"
    )

    assert simple_spec.query_hash == event_type_spec.query_hash == parens_spec.query_hash


@pytest.mark.parametrize(
    "query",
    [
        "device:iPhone"
        "isNightlyBuild:true environment:production OR isNightlyBuild:True environment:production",
        "isNightlyBuild:true (environment:production OR isNightlyBuild:True) environment:production",
        "isNightlyBuild:true AND environment:production OR isNightlyBuild:True AND environment:production",
        "isNightlyBuild:true AND (environment:production OR isNightlyBuild:True) AND environment:production",
        "isNightlyBuild:true environment:production",
        "isNightlyBuild:true AND environment:production",
        "(isNightlyBuild:true environment:production)",
        "(isNightlyBuild:true AND environment:production)",
        "isNightlyBuild:true OR environment:production",
        "(isNightlyBuild:true OR environment:production)",
    ],
)
def test_cleanup_with_environment_injection(query) -> None:
    # We are simulating the transformation that the frontend performs in the query, since they add the
    # AND (`event.type:transaction`) at the end.
    field = "count()"
    transformed_query = f"({query}) AND (event.type:transaction)"
    environment = "production"

    # We test with both new and old env logic, in this case queries should be identical in both logics since we
    # scrape away parentheses.
    for updated_env_logic in (True, False):
        spec = OnDemandMetricSpec(
            field, query, environment=environment, use_updated_env_logic=updated_env_logic
        )
        transformed_spec = OnDemandMetricSpec(
            field,
            transformed_query,
            environment=environment,
            use_updated_env_logic=updated_env_logic,
        )

        assert spec.query_hash == transformed_spec.query_hash


@django_db_all
@patch("sentry.snuba.metrics.extraction._get_satisfactory_threshold_and_metric")
def test_spec_apdex_without_condition(
    _get_satisfactory_threshold_and_metric, default_project
) -> None:
    _get_satisfactory_threshold_and_metric.return_value = 100, "transaction.duration"

    spec = OnDemandMetricSpec("apdex(10)", "")

    assert spec._metric_type == "c"
    assert spec.field_to_extract is None
    assert spec.op == "on_demand_apdex"
    assert spec.condition is None
    assert spec.tags_conditions(default_project) == apdex_tag_spec(default_project, ["10"])


def test_spec_custom_tag() -> None:
    custom_tag_spec = OnDemandMetricSpec("count()", "foo:bar")

    assert custom_tag_spec.condition == {"name": "event.tags.foo", "op": "eq", "value": "bar"}


@pytest.mark.parametrize(
    "query",
    [
        "release:initial OR os.name:android",
        "browser.version:1 os.name:android",
        "(release:a OR (transaction.op:b and browser.version:1)) transaction.duration:>1s",
    ],
)
def test_query_tokens_to_string(query) -> None:
    tokens = parse_search_query(query)
    new_query = query_tokens_to_string(tokens)
    new_tokens = parse_search_query(new_query)

    assert tokens == new_tokens


@pytest.mark.parametrize(
    "dirty, clean",
    [
        ("transaction.duration:>=1 ", ""),
        ("transaction.duration:>=1 and geo.city:Vienna ", ""),
        ("transaction.duration:>=1 and geo.city:Vienna or os.name:android", "os.name:android"),
        ("(transaction.duration:>=1 and geo.city:Vienna) or os.name:android", "os.name:android"),
        (
            "release:initial OR (os.name:android AND transaction.duration:>=1 OR environment:dev)",
            "release:initial OR (os.name:android or environment:dev)",
        ),
    ],
)
def test_to_standard_metrics_query(dirty, clean) -> None:
    cleaned_up_query = to_standard_metrics_query(dirty)
    cleaned_up_tokens = parse_search_query(cleaned_up_query)
    clean_tokens = parse_search_query(clean)

    assert cleaned_up_tokens == clean_tokens


@pytest.mark.parametrize(
    "query, expected",
    [
        (
            "has:profile.id",
            {
                "op": "not",
                "inner": {"op": "eq", "name": "event.contexts.profile.profile_id", "value": None},
            },
        ),
        (
            "profile.id:abc123",
            {"op": "eq", "name": "event.contexts.profile.profile_id", "value": "abc123"},
        ),
    ],
)
def test_search_query_converter(query, expected) -> None:
    tokens = parse_search_query(query)
    converter = SearchQueryConverter(tokens)
    condition = converter.convert()

    assert expected == condition


@pytest.mark.parametrize(
    "dirty, clean",
    [
        ("release:initial OR os.name:android", "release:initial OR os.name:android"),
        ("OR AND OR release:initial OR os.name:android", "release:initial OR os.name:android"),
        ("release:initial OR os.name:android AND OR AND ", "release:initial OR os.name:android"),
        (
            "release:initial AND (AND OR) (OR )os.name:android ",
            "release:initial AND os.name:android",
        ),
        (
            " AND ((AND OR (OR ))) release:initial (((AND OR  (AND)))) AND os.name:android  (AND OR) ",
            "release:initial AND os.name:android",
        ),
        (" (AND) And (And) Or release:initial or (and) or", "release:initial"),
    ],
)
def test_cleanup_query(dirty, clean) -> None:
    dirty_tokens = parse_search_query(dirty)
    clean_tokens = parse_search_query(clean)
    actual_clean = cleanup_search_query(dirty_tokens)

    assert actual_clean == clean_tokens


def test_cleanup_query_with_empty_parens() -> None:
    """
    Separate test with empty parens because we can't parse a string with empty parens correctly
    """
    paren = ParenExpression
    dirty_tokens = (
        [paren([paren(["AND", "OR", paren([])])])]
        + parse_search_query("release:initial AND (AND OR) (OR)")  # ((AND OR (OR ())))
        + [paren([])]
        + parse_search_query("os.name:android")  # ()
        + [paren([paren([paren(["AND", "OR", paren([])])])])]  # ((()))
    )
    clean_tokens = parse_search_query("release:initial AND os.name:android")
    actual_clean = cleanup_search_query(dirty_tokens)
    assert actual_clean == clean_tokens

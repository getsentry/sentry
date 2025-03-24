from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any, Union, cast

from snuba_sdk import (
    And,
    BooleanCondition,
    Column,
    Condition,
    CurriedFunction,
    Direction,
    Entity,
    Formula,
    Metric,
    MetricsQuery,
    Op,
    OrderBy,
    Query,
    Request,
    Storage,
    Timeseries,
)
from snuba_sdk.formula import FormulaParameterGroup
from snuba_sdk.mql.mql import parse_mql

from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import (
    bulk_reverse_resolve,
    resolve_weak,
    reverse_resolve_weak,
    string_to_use_case_id,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mapping import get_mri
from sentry.snuba.metrics.naming_layer.mri import parse_mri
from sentry.snuba.metrics.utils import MetricDoesNotExistException, to_intervals
from sentry.utils import metrics
from sentry.utils.snuba import bulk_snuba_queries

logger = logging.getLogger(__name__)

FilterTypes = Union[Column, CurriedFunction, Condition, BooleanCondition, str, list]


ALLOWED_GRANULARITIES = [10, 60, 3600, 86400]
ALLOWED_GRANULARITIES = sorted(ALLOWED_GRANULARITIES)  # Ensure it's ordered

# These aliases are sent in from the product, and need to be mapped to the actual snuba function
# Provide a mapping from alias to aggregate/aggregate parameters.
AGGREGATE_ALIASES = {
    "p50": ("quantiles", [0.5]),
    "p75": ("quantiles", [0.75]),
    "p90": ("quantiles", [0.9]),
    "p95": ("quantiles", [0.95]),
    "p99": ("quantiles", [0.99]),
    "count_unique": ("uniq", None),
}


class ReverseMappings:
    """
    Used to keep track of which tag values need to be reverse resolved in the result for
    metrics (release health) queries. Stores a set of tag_keys in which the tag values need
    to be reverse resolved. Only tag keys which are resolved will be included in this set.
    Therefore, columns like project_id is included. Reverse_mappings saves a dictionary of resolved integers
    to their original string values when they are first resolved before query execution.
    Groupby columns values will still need to access the indexer as those reverse mappings will not be present here.
    """

    def __init__(self) -> None:
        self.tag_keys: set[str] = set()
        self.reverse_mappings: dict[int, str] = dict()


def bulk_run_query(requests: list[Request]) -> list[Mapping[str, Any]]:
    """
    Entrypoint for executing a list of metrics queries in Snuba.

    This function is used to execute multiple metrics queries in a single request.
    """
    if not requests:
        return []

    queries = []
    for request in requests:
        request, start, end = _setup_metrics_query(request)
        queries.append([request, start, end])

    logging_tags = {"referrer": request.tenant_ids["referrer"] or "unknown", "lang": "mql"}

    for q in queries:
        q[0], reverse_mappings, mappings = _resolve_metrics_query(q[0], logging_tags)
        q.extend([reverse_mappings, mappings])

    try:
        snuba_results = bulk_snuba_queries(
            [q[0] for q in queries],
            queries[0][0].tenant_ids["referrer"],
            use_cache=True,
        )
    except Exception:
        metrics.incr(
            "metrics_layer.query",
            tags={**logging_tags, "status": "query_error"},
        )
        raise

    for idx, snuba_result in enumerate(snuba_results):
        request, start, end, reverse_mappings, mappings = queries[idx]
        metrics_query = request.query

        snuba_result = convert_snuba_result(
            snuba_result,
            reverse_mappings,
            request.dataset,
            metrics_query.scope.use_case_id,
            metrics_query.scope.org_ids[0],
        )

        # If we normalized the start/end, return those values in the response so the caller is aware
        results = {
            **snuba_result,
            "modified_start": start,
            "modified_end": end,
            "indexer_mappings": mappings,
        }

        snuba_results[idx] = results

    metrics.incr(
        "metrics_layer.query",
        tags={**logging_tags, "status": "success"},
    )
    return snuba_results


def run_query(request: Request) -> Mapping[str, Any]:
    """
    Entrypoint for executing a metrics query in Snuba.
    """
    return bulk_run_query([request])[0]


def _setup_metrics_query(request: Request) -> tuple[Request, datetime, datetime]:
    metrics_query = request.query
    assert isinstance(metrics_query, MetricsQuery)

    # We allow users to pass in a string instead of a Formula/Timeseries object. Handle that case here.
    if isinstance(metrics_query.query, str):
        metrics_query = metrics_query.set_query(parse_mql(metrics_query.query))

    assert len(metrics_query.scope.org_ids) == 1  # Initially only allow 1 org id
    organization_id = metrics_query.scope.org_ids[0]
    tenant_ids = request.tenant_ids or {"organization_id": organization_id}
    request.tenant_ids = tenant_ids

    # Process intervals
    assert metrics_query.rollup is not None
    start = metrics_query.start
    end = metrics_query.end
    if metrics_query.rollup.interval:
        start, end, _ = to_intervals(
            metrics_query.start, metrics_query.end, metrics_query.rollup.interval
        )
        metrics_query = metrics_query.set_start(start).set_end(end)
    if metrics_query.rollup.granularity is None:
        granularity = _resolve_granularity(
            metrics_query.start, metrics_query.end, metrics_query.rollup.interval
        )
        metrics_query = metrics_query.set_rollup(
            replace(metrics_query.rollup, granularity=granularity)
        )
    request.query = metrics_query

    return request, start, end


def _resolve_aggregate_aliases(exp: Timeseries | Formula) -> MetricsQuery:
    """
    Replaces any aggregate aliases with the appropriate aggregate.
    """
    if isinstance(exp, Timeseries):
        if exp.aggregate in AGGREGATE_ALIASES:
            aggregate, parameters = AGGREGATE_ALIASES[exp.aggregate]
            return exp.set_aggregate(aggregate, parameters)
        return exp
    elif isinstance(exp, Formula):
        if not exp.parameters:
            return exp

        aliased_parameters = cast(list[FormulaParameterGroup], exp.parameters)
        for i, p in enumerate(aliased_parameters):
            if isinstance(p, (Timeseries, Formula)):
                aliased_parameters[i] = _resolve_aggregate_aliases(p)

        return exp.set_parameters(aliased_parameters)
    else:
        raise InvalidParams("Invalid query")


def _resolve_granularity(start: datetime, end: datetime, interval: int | None) -> int:
    """
    Returns the granularity in seconds based on the start, end, and interval.
    If the interval is set, then find the largest granularity that is smaller or equal to the interval.

    If the interval is None, then it must be a totals query, which means this will use the biggest granularity
    that matches the offset from the time range. This function does no automatic fitting of the time range to
    a performant granularity.

    E.g. if the time range is 7 days, but going from 3:01:53pm to 3:01:53pm, then it has to use the 10s
    granularity, and the performance will suffer.
    """
    if interval is not None:
        for granularity in ALLOWED_GRANULARITIES[::-1]:
            if granularity <= interval:
                return granularity

        return ALLOWED_GRANULARITIES[0]  # Default to smallest granularity

    found_granularities = []
    for t in [start, end]:
        rounded_to_day = t.replace(hour=0, minute=0, second=0, microsecond=0)
        second_diff = int((t - rounded_to_day).total_seconds())

        found = None
        for granularity in ALLOWED_GRANULARITIES[::-1]:
            if second_diff % granularity == 0:
                found = granularity
                break

        found_granularities.append(found if found is not None else ALLOWED_GRANULARITIES[0])

    return min(found_granularities)


def _resolve_metrics_query(
    request: Request, logging_tags: dict[str, str]
) -> tuple[Request, ReverseMappings, dict[str, str | int]]:
    metrics_query = request.query

    try:
        # There are two kinds of resolving: lookup up in the indexer, and resolving things like
        # aggregate_alias, entities and use_case_id.
        metrics_query, mappings = _resolve_query_metadata(metrics_query)
        # Release health AKA sessions uses a separate Dataset. Change the dataset based on the use case id.
        # This is necessary here because the product code that uses this isn't aware of which feature is
        # using it.
        if metrics_query.scope.use_case_id == UseCaseID.SESSIONS.value:
            request.dataset = Dataset.Metrics.value
        else:
            request.dataset = Dataset.PerformanceMetrics.value
        indexer_mappings, reverse_mappings = _lookup_indexer_resolve(metrics_query, request.dataset)
        mappings.update(indexer_mappings)
        request.query = metrics_query.set_indexer_mappings(mappings)
        request.tenant_ids["use_case_id"] = metrics_query.scope.use_case_id
    except Exception:
        metrics.incr(
            "metrics_layer.query",
            tags={**logging_tags, "status": "resolve_error"},
        )
        raise

    return request, reverse_mappings, mappings


def _resolve_query_metadata(
    metrics_query: MetricsQuery,
) -> tuple[MetricsQuery, dict[str, str | int]]:
    """
    Resolves all the fields of the Metric in the query. Public name -> MRI -> ID -> Entity.
    Returns a mapping dictionary that shows any resolving that the function did.

    Right now (2023-12-18) this function returns a modified query, since Timeseries objects have a Metric, and
    it's required for that Metric to have an ID in the SDK. Ideally, this function would only return a mapping
    and not modify the query at all. That simplifies the logic quite a bit.
    """
    assert metrics_query.query is not None

    org_id = metrics_query.scope.org_ids[0]
    use_case_ids = _resolve_use_case_ids(metrics_query.query)

    if not use_case_ids:
        raise InvalidParams("No use case found in formula parameters")
    if len(use_case_ids) > 1:
        raise InvalidParams("Formula parameters must all be from the same use case")
    use_case_id_str = use_case_ids.pop()

    if metrics_query.scope.use_case_id is None:
        metrics_query = metrics_query.set_scope(
            metrics_query.scope.set_use_case_id(use_case_id_str)
        )
    use_case_id = string_to_use_case_id(use_case_id_str)

    if isinstance(metrics_query.query, Timeseries):
        series, mappings = _resolve_timeseries_metadata(metrics_query.query, use_case_id, org_id)
        metrics_query = metrics_query.set_query(series)
    elif isinstance(metrics_query.query, Formula):
        formula, mappings = _resolve_formula_metadata(metrics_query.query, use_case_id, org_id)
        metrics_query = metrics_query.set_query(formula)

    new_query = _resolve_aggregate_aliases(metrics_query.query)
    metrics_query = metrics_query.set_query(new_query)

    return metrics_query, mappings


def _resolve_formula_metadata(
    formula: Formula, use_case_id: UseCaseID, org_id: int
) -> tuple[Formula, dict[str, str | int]]:
    parameters = formula.parameters
    formula_mappings = {}
    for i, p in enumerate(parameters):
        if isinstance(p, Timeseries):
            series, mappings = _resolve_timeseries_metadata(p, use_case_id, org_id)
            parameters[i] = series
            formula_mappings.update(mappings)
        elif isinstance(p, Formula):
            parameters[i], mappings = _resolve_formula_metadata(p, use_case_id, org_id)
            formula_mappings.update(mappings)

    formula = formula.set_parameters(parameters)
    return formula, formula_mappings


def _resolve_timeseries_metadata(
    series: Timeseries, use_case_id: UseCaseID, org_id: int
) -> tuple[Timeseries, dict[str, str | int]]:
    metric = series.metric
    mappings: dict[str, str | int] = {}
    if not metric.mri and not metric.public_name:
        raise InvalidParams("Metric must have either an MRI or a public name")

    if not metric.mri and metric.public_name:
        mri = get_mri(metric.public_name)
        metric = metric.set_mri(mri)  # TODO: Remove this, Snuba can resolve public names
        mappings[metric.public_name] = mri

    if metric.id is None:
        metric_id = resolve_weak(
            use_case_id, org_id, metric.mri
        )  # only support raw metrics for now
        mappings[metric.mri] = metric_id
        # There is a bug in the SDK that requires this for serialization to MQL,
        # even though MQL doesn't use the ID.
        metric = metric.set_id(metric_id)
    else:
        mappings[metric.mri] = metric.id

    series = series.set_metric(metric)
    return series, mappings


def _resolve_use_case_ids(exp: Formula | Timeseries) -> set[str]:
    def fetch_namespace(metric: Metric) -> str:
        if metric.mri is None:
            mri = get_mri(metric.public_name)
        else:
            mri = metric.mri
        parsed_mri = parse_mri(mri)
        if parsed_mri is None:
            raise InvalidParams(f"'{mri}' is not a valid MRI")

        return parsed_mri.namespace

    if isinstance(exp, Timeseries):
        return {fetch_namespace(exp.metric)}

    assert isinstance(exp, Formula), exp
    namespaces = set()
    for p in exp.parameters:
        if isinstance(p, (Formula, Timeseries)):
            namespaces |= _resolve_use_case_ids(p)

    return namespaces


def _lookup_indexer_resolve(
    metrics_query: MetricsQuery, dataset: str
) -> tuple[Mapping[str, str | int], ReverseMappings]:
    """
    Returns an updated metrics query with all the indexer resolves complete. Also returns a mapping
    that shows all the strings that were resolved and what they were resolved too.
    """
    reverse_mappings = ReverseMappings()
    org_id = metrics_query.scope.org_ids[0]
    use_case_id = string_to_use_case_id(metrics_query.scope.use_case_id)
    indexer_mappings = _lookup_indexer_resolve_exp(
        metrics_query.query, org_id, use_case_id, dataset, reverse_mappings
    )
    return indexer_mappings, reverse_mappings


def _lookup_indexer_resolve_exp(
    exp: Formula | Timeseries,
    org_id: int,
    use_case_id: UseCaseID,
    dataset: str,
    reverse_mappings: ReverseMappings,
) -> Mapping[str, str | int]:
    indexer_mappings: dict[str, str | int] = {}
    new_mappings = _lookup_resolve_groupby(exp.groupby, use_case_id, org_id, reverse_mappings)
    indexer_mappings.update(new_mappings)
    new_mappings = _lookup_resolve_filters(
        exp.filters, use_case_id, org_id, dataset, reverse_mappings
    )
    indexer_mappings.update(new_mappings)

    if isinstance(exp, Formula):
        parameters = exp.parameters
        for i, p in enumerate(parameters):
            if isinstance(p, (Formula, Timeseries)):
                new_mappings = _lookup_indexer_resolve_exp(
                    p, org_id, use_case_id, dataset, reverse_mappings
                )
                indexer_mappings.update(new_mappings)

    return indexer_mappings


def _lookup_resolve_groupby(
    groupby: list[Column] | None,
    use_case_id: UseCaseID,
    org_id: int,
    reverse_mappings: ReverseMappings,
) -> Mapping[str, str | int]:
    """
    Go through the groupby columns and resolve any that need to be resolved.
    We also return a reverse mapping of the resolved columns to the original
    so that they can be added to the results.
    """
    if not groupby:
        return {}

    mappings = {}
    for col in groupby:
        resolved = resolve_weak(use_case_id, org_id, col.name)
        if resolved > -1:
            mappings[col.name] = resolved
            reverse_mappings.tag_keys.add(col.name)

    return mappings


def _lookup_resolve_filters(
    filters: list[Condition | BooleanCondition],
    use_case_id: UseCaseID,
    org_id: int,
    dataset: str,
    reverse_mappings: ReverseMappings,
) -> Mapping[str, str | int]:
    """
    Go through the columns in the filter and resolve any that can be resolved.
    We also return a reverse mapping of the resolved columns to the original
    so that they can be added to the results.
    """
    if not filters:
        return {}

    mappings = {}

    def lookup_resolve_exp(
        exp: FilterTypes, dataset: str, reverse_mappings: ReverseMappings
    ) -> None:
        if dataset == Dataset.Metrics.value and (isinstance(exp, str) or isinstance(exp, list)):
            if isinstance(exp, str):
                resolved = resolve_weak(use_case_id, org_id, exp)
                if resolved > -1:
                    mappings[exp] = resolved
                    reverse_mappings.reverse_mappings[resolved] = exp
            elif isinstance(exp, list):
                for value in exp:
                    assert isinstance(value, str)
                    resolved = resolve_weak(use_case_id, org_id, value)
                    if resolved > -1:
                        mappings[value] = resolved
                        reverse_mappings.reverse_mappings[resolved] = value
            else:
                raise InvalidParams("Invalid filter tag value type")
        elif isinstance(exp, Column):
            resolved = resolve_weak(use_case_id, org_id, exp.name)
            if resolved > -1:
                mappings[exp.name] = resolved
                if dataset == Dataset.Metrics.value:
                    reverse_mappings.tag_keys.add(exp.name)
        elif isinstance(exp, CurriedFunction):
            for p in exp.parameters:
                lookup_resolve_exp(p, dataset, reverse_mappings)
        elif isinstance(exp, BooleanCondition):
            for c in exp.conditions:
                lookup_resolve_exp(c, dataset, reverse_mappings)
        elif isinstance(exp, Condition):
            lookup_resolve_exp(exp.lhs, dataset, reverse_mappings)
            # If the dataset is metrics, then we need to resolve the RHS tag values as well
            if dataset == Dataset.Metrics.value:
                lookup_resolve_exp(exp.rhs, dataset, reverse_mappings)

    for exp in filters:
        lookup_resolve_exp(exp, dataset, reverse_mappings)
    return mappings


def convert_snuba_result(
    snuba_result: Mapping[str, Any],
    reverse_mappings: ReverseMappings,
    dataset: str,
    use_case_id_str: str,
    org_id: int,
) -> Mapping[str, Any]:
    """
    If the dataset is metrics (release-health), then we need to convert the resultant tag values from
    their resolved integers back into their original strings.
    """
    if dataset == Dataset.PerformanceMetrics.value:
        return snuba_result
    for data_point in snuba_result["data"]:
        for key in data_point:
            if key in reverse_mappings.tag_keys:
                if data_point[key] in reverse_mappings.reverse_mappings:
                    data_point[key] = reverse_mappings.reverse_mappings[data_point[key]]
                else:
                    # Reverse mapping was not saved in initial resolve, this means column was only specfied in groupby.
                    # We need to manually do a reverse resolve here.
                    reverse_resolve = reverse_resolve_weak(
                        string_to_use_case_id(use_case_id_str), org_id, int(data_point[key])
                    )
                    if reverse_resolve:
                        data_point[key] = reverse_resolve
    return snuba_result


def fetch_metric_mris(
    org_id: int, project_ids: list[int], use_case_id: UseCaseID, app_id: str = ""
) -> dict[int, list[str]]:
    """
    Fetches all the metric MRIs for a set of projects and use case. This will reverse
    resolve all the metric IDs into MRIs.
    """
    return _query_meta_table(org_id, project_ids, use_case_id, app_id=app_id)


def fetch_metric_tag_keys(
    org_id: int, project_ids: list[int], use_case_id: UseCaseID, mri: str, app_id: str = ""
) -> dict[int, list[str]]:
    """
    Fetches the tag keys for a given metric MRI. This will reverse
    resolve all the tag keys into strings.
    """
    return _query_meta_table(org_id, project_ids, use_case_id, mri, app_id)


def _query_meta_table(
    org_id: int,
    project_ids: list[int],
    use_case_id: UseCaseID,
    mri: str | None = None,
    app_id: str = "",
) -> dict[int, list[str]]:
    """
    Helper function for querying the meta table. This will query across all four metric types, and resolve all the resulting
    values. If an MRI is provided, it is assumed that this function should find unique tag keys for that MRI.
    """

    if mri:
        column_name = "tag_key"
        metric_id = resolve_weak(use_case_id, org_id, mri)
        if metric_id == -1:
            raise MetricDoesNotExistException(f"Unknown metric: {mri}")
        extra_condition = And(
            [
                Condition(Column("metric_id"), Op.EQ, metric_id),
                Condition(Column("tag_key"), Op.NEQ, 0),
            ]
        )

    else:
        column_name = "metric_id"
        extra_condition = None

    conditions = [
        Condition(Column("org_id"), Op.EQ, org_id),
        Condition(Column("project_id"), Op.IN, project_ids),
        Condition(Column("use_case_id"), Op.EQ, use_case_id.value),
        Condition(Column("timestamp"), Op.GTE, datetime.now(UTC) - timedelta(days=90)),
        Condition(Column("timestamp"), Op.LT, datetime.now(UTC) + timedelta(days=1)),
    ]
    if extra_condition:
        conditions.append(extra_condition)

    counters_query = (
        Query(Storage("generic_metrics_counters_meta"))
        .set_select([Column("project_id"), Column(column_name)])
        .set_groupby([Column("project_id"), Column(column_name)])
        .set_where(conditions)
        .set_orderby(
            [
                OrderBy(Column("project_id"), Direction.ASC),
                OrderBy(Column(column_name), Direction.ASC),
            ]
        )
        .set_limit(1000)
    )

    def build_request(query: Query) -> Request:
        return Request(
            dataset="generic_metrics",
            app_id=use_case_id.value if app_id == "" else app_id,
            query=query,
            tenant_ids={
                "organization_id": org_id,
                "project_id": project_ids[0],
                "referrer": f"generic_metrics_meta_{column_name}",
            },
        )

    requests = [build_request(counters_query)]
    for mtype in ["sets", "gauges", "distributions"]:
        new_query = counters_query.set_match(Entity(f"generic_metrics_{mtype}_meta"))
        new_request = build_request(new_query)
        requests.append(new_request)

    results = bulk_snuba_queries(requests, f"generic_metrics_meta_{column_name}")
    indexed_ids = []
    for result in results:
        indexed_ids.extend([row[column_name] for row in result["data"]])

    resolved_ids = bulk_reverse_resolve(use_case_id, org_id, indexed_ids)
    # Group by project ID
    grouped_results: dict[int, list[str]] = {}
    for result in results:
        for row in result["data"]:
            indexed_id = row[column_name]
            val = resolved_ids[indexed_id]
            grouped_results.setdefault(row["project_id"], list()).append(val)

    return grouped_results

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from typing import Any, Mapping, Union

from snuba_sdk import (
    AliasedExpression,
    BooleanCondition,
    Column,
    Condition,
    CurriedFunction,
    Formula,
    MetricsQuery,
    Request,
    Timeseries,
)

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_weak, string_to_use_case_id
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mapping import get_mri
from sentry.snuba.metrics.naming_layer.mri import parse_mri
from sentry.snuba.metrics.utils import to_intervals
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

FilterTypes = Union[Column, CurriedFunction, Condition, BooleanCondition]


ALLOWED_GRANULARITIES = [10, 60, 3600, 86400]
ALLOWED_GRANULARITIES = sorted(ALLOWED_GRANULARITIES)  # Ensure it's ordered


def run_query(request: Request) -> Mapping[str, Any]:
    """
    Entrypoint for executing a metrics query in Snuba.

    First iteration:
    The purpose of this function is to eventually replace datasource.py::get_series().
    As a first iteration, this function will only support single timeseries metric queries.
    This means that for now, other queries such as total, formula, or meta queries
    will not be supported. Additionally, the first iteration will only support
    querying raw metrics (no derived). This means that each call to this function will only
    resolve into a single request (and single entity) to the Snuba API.
    """
    metrics_query = request.query
    assert isinstance(metrics_query, MetricsQuery)

    # Currently we don't support nested Formula queries. Check to make sure that is what is being passed in.
    # TODO: This should be removed once we fully support Formulas.
    if isinstance(metrics_query.query, Formula):
        metrics_query.query.validate()

    assert len(metrics_query.scope.org_ids) == 1  # Initially only allow 1 org id
    organization_id = metrics_query.scope.org_ids[0]
    tenant_ids = request.tenant_ids or {"organization_id": organization_id}
    request.tenant_ids = tenant_ids

    # Process intervals
    assert metrics_query.rollup is not None
    start = metrics_query.start
    end = metrics_query.end
    if metrics_query.rollup.interval:
        start, end, _num_intervals = to_intervals(
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

    # Resolves MRI or public name in metrics_query
    try:
        resolved_metrics_query, mappings = _resolve_metrics_query(metrics_query)
        request.query = resolved_metrics_query
        request.tenant_ids["use_case_id"] = resolved_metrics_query.scope.use_case_id
        # Release health AKA sessions uses a separate Dataset. Change the dataset based on the use case id.
        # This is necessary here because the product code that uses this isn't aware of which feature is
        # using it.
        if resolved_metrics_query.scope.use_case_id == UseCaseID.SESSIONS.value:
            request.dataset = Dataset.Metrics.value

    except Exception as e:
        metrics.incr(
            "metrics_layer.query",
            tags={
                "referrer": request.tenant_ids["referrer"] or "unknown",
                "status": "resolve_error",
            },
        )
        raise e

    try:
        snuba_results = raw_snql_query(request, request.tenant_ids["referrer"], use_cache=True)
    except Exception as e:
        metrics.incr(
            "metrics_layer.query",
            tags={"referrer": request.tenant_ids["referrer"] or "unknown", "status": "query_error"},
        )
        raise e

    # If we normalized the start/end, return those values in the response so the caller is aware
    results = {
        **snuba_results,
        "modified_start": start,
        "modified_end": end,
        "indexer_mappings": mappings,
    }
    metrics.incr(
        "metrics_layer.query",
        tags={"referrer": request.tenant_ids["referrer"] or "unknown", "status": "success"},
    )
    return results


RELEASE_HEALTH_ENTITIES = {
    "c": EntityKey.MetricsCounters,
    "d": EntityKey.MetricsDistributions,
    "s": EntityKey.MetricsSets,
}

GENERIC_ENTITIES = {
    "c": EntityKey.GenericMetricsCounters,
    "d": EntityKey.GenericMetricsDistributions,
    "s": EntityKey.GenericMetricsSets,
    "g": EntityKey.GenericMetricsGauges,
}


def _resolve_use_case_id_str(metrics_query: MetricsQuery) -> str:
    # Automatically resolve the use_case_id if it is not provided
    if isinstance(metrics_query.query, Timeseries):
        if metrics_query.query.metric.mri is None:
            mri = get_mri(metrics_query.query.metric.public_name)
        else:
            mri = metrics_query.query.metric.mri
        parsed_mri = parse_mri(mri)
        if parsed_mri is None:
            raise InvalidParams(f"'{mri}' is not a valid MRI")

        return parsed_mri.namespace

    assert isinstance(metrics_query.query, Formula)
    namespaces = set()
    for p in metrics_query.query.parameters:
        if isinstance(p, Timeseries):
            if p.metric.mri is None:
                mri = get_mri(p.metric.public_name)
            else:
                mri = p.metric.mri

            parsed_mri = parse_mri(mri)
            if parsed_mri is None:
                raise InvalidParams(f"'{mri}' is not a valid MRI")

            namespaces.add(parsed_mri.namespace)

    if not namespaces:
        raise InvalidParams("No use case found in formula parameters")
    if len(namespaces) > 1:
        raise InvalidParams("Formula parameters must all be from the same use case")

    return namespaces.pop()


def _resolve_metrics_entity(mri: str) -> EntityKey:
    parsed_mri = parse_mri(mri)
    if parsed_mri is None:
        raise InvalidParams(f"'{mri}' is not a valid MRI")

    if parsed_mri.namespace == "sessions":
        return RELEASE_HEALTH_ENTITIES[parsed_mri.entity]

    return GENERIC_ENTITIES[parsed_mri.entity]


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


def _resolve_query_metrics(
    metrics_query: MetricsQuery,
    use_case_id: UseCaseID,
    org_id: int,
) -> tuple[MetricsQuery, dict[str, str | int]]:
    """
    Resolves all the fields of the Metric in the query. Public name -> MRI -> ID -> Entity.
    Returns a mapping dictionary that shows any resolving that the function did.
    """
    assert metrics_query.query is not None
    if isinstance(metrics_query.query, Timeseries):
        series, mappings = _resolve_timeseries_metric(metrics_query.query, use_case_id, org_id)
        metrics_query = metrics_query.set_query(series)
    elif isinstance(metrics_query.query, Formula):
        formula, mappings = _resolve_formula_metrics(metrics_query.query, use_case_id, org_id)
        metrics_query = metrics_query.set_query(formula)

    return metrics_query, mappings


def _resolve_timeseries_metric(
    series: Timeseries, use_case_id: UseCaseID, org_id: int
) -> tuple[Timeseries, dict[str, str | int]]:
    metric = series.metric
    mappings: dict[str, str | int] = {}
    if not metric.mri and not metric.public_name:
        raise InvalidParams("Metric must have either an MRI or a public name")

    if not metric.mri and metric.public_name:
        mri = get_mri(metric.public_name)
        metric = metric.set_mri(mri)
        mappings[metric.public_name] = mri

    if metric.id is None:
        metric_id = resolve_weak(
            use_case_id, org_id, metric.mri
        )  # only support raw metrics for now
        metric = metric.set_id(metric_id)
        mappings[metric.mri] = metric_id

    if not metric.entity:
        entity = _resolve_metrics_entity(metric.mri)
        metric = metric.set_entity(entity.value)

    series = series.set_metric(metric)
    return series, mappings


def _resolve_formula_metrics(
    formula: Formula, use_case_id: UseCaseID, org_id: int
) -> tuple[Formula, dict[str, str | int]]:
    # TODO: This will eventually need to recursively resolve Formulas as Formula becomes a valid paramaeter
    parameters = formula.parameters
    formula_mappings = {}
    for i, p in enumerate(parameters):
        if isinstance(p, Timeseries):
            series, mappings = _resolve_timeseries_metric(p, use_case_id, org_id)
            parameters[i] = series
            formula_mappings.update(mappings)

    formula = formula.set_parameters(parameters)
    return formula, mappings


def _resolve_metrics_query(
    metrics_query: MetricsQuery,
) -> tuple[MetricsQuery, Mapping[str, str | int]]:
    """
    Returns an updated metrics query with all the indexer resolves complete. Also returns a mapping
    that shows all the strings that were resolved and what they were resolved too.
    """

    org_id = metrics_query.scope.org_ids[0]
    use_case_id_str = _resolve_use_case_id_str(metrics_query)
    if metrics_query.scope.use_case_id is None:
        metrics_query = metrics_query.set_scope(
            metrics_query.scope.set_use_case_id(use_case_id_str)
        )

    use_case_id = string_to_use_case_id(use_case_id_str)
    metrics_query, mappings = _resolve_query_metrics(metrics_query, use_case_id, org_id)

    new_groupby, new_mappings = _resolve_groupby(metrics_query.query.groupby, use_case_id, org_id)
    metrics_query = metrics_query.set_query(metrics_query.query.set_groupby(new_groupby))
    mappings.update(new_mappings)

    if isinstance(metrics_query.query, Formula):
        parameters = metrics_query.query.parameters
        for i, p in enumerate(parameters):
            if isinstance(p, Timeseries):
                new_groupby, new_mappings = _resolve_groupby(p.groupby, use_case_id, org_id)
                parameters[i] = p.set_groupby(new_groupby)
                mappings.update(new_mappings)

        metrics_query = metrics_query.set_query(metrics_query.query.set_parameters(parameters))

    new_filters, new_mappings = _resolve_filters(metrics_query.query.filters, use_case_id, org_id)
    metrics_query = metrics_query.set_query(metrics_query.query.set_filters(new_filters))
    mappings.update(new_mappings)

    if isinstance(metrics_query.query, Formula):
        parameters = metrics_query.query.parameters
        for i, p in enumerate(parameters):
            if isinstance(p, Timeseries):
                new_filters, new_mappings = _resolve_filters(p.filters, use_case_id, org_id)
                parameters[i] = p.set_filters(new_filters)
                mappings.update(new_mappings)

        metrics_query = metrics_query.set_query(metrics_query.query.set_parameters(parameters))

    return metrics_query, mappings


def _resolve_groupby(
    groupby: list[Column] | None, use_case_id: UseCaseID, org_id: int
) -> tuple[list[Column] | None, Mapping[str, int]]:
    """
    Go through the groupby columns and resolve any that need to be resolved.
    We also return a reverse mapping of the resolved columns to the original
    so that they can be added to the results.
    """
    if not groupby:
        return groupby, {}

    new_groupby = []
    mappings = {}
    for col in groupby:
        resolved = resolve_weak(use_case_id, org_id, col.name)
        if resolved > -1:
            # TODO: This currently assumes the use of `tags_raw` but that might not always be correct
            # It also doesn't take into account mapping indexed tag values back to their original values
            new_groupby.append(
                AliasedExpression(exp=replace(col, name=f"tags_raw[{resolved}]"), alias=col.name)
            )
            mappings[col.name] = resolved
        else:
            new_groupby.append(col)

    return new_groupby, mappings


def _resolve_filters(
    filters: list[Condition | BooleanCondition], use_case_id: UseCaseID, org_id: int
) -> tuple[list[Condition | BooleanCondition] | None, Mapping[str, int]]:
    """
    Go through the columns in the filter and resolve any that can be resolved.
    We also return a reverse mapping of the resolved columns to the original
    so that they can be added to the results.
    """
    if not filters:
        return filters, {}

    mappings = {}

    def resolve_exp(exp: FilterTypes) -> FilterTypes:
        if isinstance(exp, Column):
            resolved = resolve_weak(use_case_id, org_id, exp.name)
            if resolved > -1:
                mappings[exp.name] = resolved
                return replace(exp, name=f"tags_raw[{resolved}]")
        elif isinstance(exp, CurriedFunction):
            return replace(exp, parameters=[resolve_exp(p) for p in exp.parameters])
        elif isinstance(exp, BooleanCondition):
            return replace(exp, conditions=[resolve_exp(c) for c in exp.conditions])
        elif isinstance(exp, Condition):
            return replace(exp, lhs=resolve_exp(exp.lhs))
        return exp

    new_filters = [resolve_exp(exp) for exp in filters]
    return new_filters, mappings

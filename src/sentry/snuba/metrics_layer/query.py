from __future__ import annotations

import logging
import random
from dataclasses import replace
from datetime import datetime
from typing import Any, List, Mapping, Union, cast

from snuba_sdk import (
    AliasedExpression,
    BooleanCondition,
    Column,
    Condition,
    CurriedFunction,
    Formula,
    Metric,
    MetricsQuery,
    Request,
    Timeseries,
)
from snuba_sdk.formula import FormulaParameterGroup

from sentry import options
from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_weak, string_to_use_case_id
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mapping import get_mri
from sentry.snuba.metrics.naming_layer.mri import parse_mri
from sentry.snuba.metrics.utils import to_intervals
from sentry.utils import metrics
from sentry.utils.snuba import bulk_snuba_queries, raw_snql_query

logger = logging.getLogger(__name__)

FilterTypes = Union[Column, CurriedFunction, Condition, BooleanCondition]


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
        if any(isinstance(p, Formula) for p in metrics_query.query.parameters):
            raise InvalidParams("Nested formulas are not supported")

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
    request.query = metrics_query

    use_mql_endpoint = float(options.get("snuba.use-mql-endpoint"))
    if (
        isinstance(request.query.query, Timeseries)  # TODO: Eventually support Formulas
        and use_mql_endpoint
        and random.random() < use_mql_endpoint
    ):
        return mql_query(request, start, end)

    return snql_query(request, start, end)


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

        aliased_parameters = cast(List[FormulaParameterGroup], exp.parameters)
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


def mql_query(request: Request, start: datetime, end: datetime) -> Mapping[str, Any]:
    metrics_query = request.query
    logging_tags = {"referrer": request.tenant_ids["referrer"] or "unknown", "lang": "mql"}

    try:
        # There are two kinds of resolving: lookup up in the indexer, and resolving things like
        # aggregate_alias, entities and use_case_id.
        metrics_query, mappings = _resolve_query_metadata(metrics_query)
        indexer_mappings = _lookup_indexer_resolve(metrics_query)
        mappings.update(indexer_mappings)
        request.query = metrics_query.set_indexer_mappings(mappings)
        request.tenant_ids["use_case_id"] = metrics_query.scope.use_case_id
        # Release health AKA sessions uses a separate Dataset. Change the dataset based on the use case id.
        # This is necessary here because the product code that uses this isn't aware of which feature is
        # using it.
        if metrics_query.scope.use_case_id == UseCaseID.SESSIONS.value:
            request.dataset = Dataset.Metrics.value
    except Exception as e:
        metrics.incr(
            "metrics_layer.query",
            tags={**logging_tags, "status": "resolve_error"},
        )
        raise e

    try:
        snuba_result = bulk_snuba_queries(
            [request],
            request.tenant_ids["referrer"],
            use_cache=True,
            use_mql=True,
        )[0]
    except Exception as e:
        metrics.incr(
            "metrics_layer.query",
            tags={**logging_tags, "status": "query_error"},
        )
        raise e

    # If we normalized the start/end, return those values in the response so the caller is aware
    results = {
        **snuba_result,
        "modified_start": start,
        "modified_end": end,
        "indexer_mappings": mappings,
    }
    metrics.incr(
        "metrics_layer.query",
        tags={**logging_tags, "status": "success"},
    )
    return results


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
    use_case_id_str = _resolve_use_case_id_str(metrics_query.query)
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
    return formula, mappings


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

    if not metric.entity:
        entity = _resolve_metrics_entity(metric.mri)  # This should eventually be done in Snuba
        metric = metric.set_entity(entity.value)

    series = series.set_metric(metric)
    return series, mappings


def _resolve_use_case_id_str(exp: Formula | Timeseries) -> str:
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
        return fetch_namespace(exp.metric)

    assert isinstance(exp, Formula), exp
    namespaces = set()
    for p in exp.parameters:
        if isinstance(p, (Formula, Timeseries)):
            namespaces.add(_resolve_use_case_id_str(p))

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


def _lookup_indexer_resolve(metrics_query: MetricsQuery) -> Mapping[str, str | int]:
    """
    Returns an updated metrics query with all the indexer resolves complete. Also returns a mapping
    that shows all the strings that were resolved and what they were resolved too.
    """
    org_id = metrics_query.scope.org_ids[0]
    use_case_id = string_to_use_case_id(metrics_query.scope.use_case_id)
    return _lookup_indexer_resolve_exp(metrics_query.query, org_id, use_case_id)


def _lookup_indexer_resolve_exp(
    exp: Formula | Timeseries, org_id: int, use_case_id: UseCaseID
) -> Mapping[str, str | int]:
    indexer_mappings: dict[str, str | int] = {}
    new_mappings = _lookup_resolve_groupby(exp.groupby, use_case_id, org_id)
    indexer_mappings.update(new_mappings)
    new_mappings = _lookup_resolve_filters(exp.filters, use_case_id, org_id)
    indexer_mappings.update(new_mappings)

    if isinstance(exp, Formula):
        parameters = exp.parameters
        for i, p in enumerate(parameters):
            if isinstance(p, (Formula, Timeseries)):
                new_mappings = _lookup_indexer_resolve_exp(p, org_id, use_case_id)
                indexer_mappings.update(new_mappings)

    return indexer_mappings


def _lookup_resolve_groupby(
    groupby: list[Column] | None, use_case_id: UseCaseID, org_id: int
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

    return mappings


def _lookup_resolve_filters(
    filters: list[Condition | BooleanCondition], use_case_id: UseCaseID, org_id: int
) -> Mapping[str, str | int]:
    """
    Go through the columns in the filter and resolve any that can be resolved.
    We also return a reverse mapping of the resolved columns to the original
    so that they can be added to the results.
    """
    if not filters:
        return {}

    mappings = {}

    def lookup_resolve_exp(exp: FilterTypes) -> None:
        if isinstance(exp, Column):
            resolved = resolve_weak(use_case_id, org_id, exp.name)
            if resolved > -1:
                mappings[exp.name] = resolved
        elif isinstance(exp, CurriedFunction):
            for p in exp.parameters:
                lookup_resolve_exp(p)
        elif isinstance(exp, BooleanCondition):
            for c in exp.conditions:
                lookup_resolve_exp(c)
        elif isinstance(exp, Condition):
            lookup_resolve_exp(exp.lhs)

    for exp in filters:
        lookup_resolve_exp(exp)
    return mappings


####################
# TO BE DEPRECATED #
####################

# TODO: This can all be removed once we are using `mql_query` at 100%.


def snql_query(request: Request, start: datetime, end: datetime) -> Mapping[str, Any]:
    metrics_query = request.query
    logging_tags = {"referrer": request.tenant_ids["referrer"] or "unknown", "lang": "snql"}
    # Resolves MRI or public name in metrics_query
    try:
        # Replace any aggregate aliases with the appropriate aggregate
        metrics_query = metrics_query.set_query(_resolve_aggregate_aliases(metrics_query.query))
        resolved_metrics_query, mappings = _resolve_metrics_query(metrics_query)
        request.query = resolved_metrics_query.set_indexer_mappings(mappings)
        request.tenant_ids["use_case_id"] = resolved_metrics_query.scope.use_case_id
        # Release health AKA sessions uses a separate Dataset. Change the dataset based on the use case id.
        # This is necessary here because the product code that uses this isn't aware of which feature is
        # using it.
        if resolved_metrics_query.scope.use_case_id == UseCaseID.SESSIONS.value:
            request.dataset = Dataset.Metrics.value

    except Exception as e:
        metrics.incr(
            "metrics_layer.query",
            tags={**logging_tags, "status": "resolve_error"},
        )
        raise e

    try:
        snuba_results = raw_snql_query(request, request.tenant_ids["referrer"], use_cache=True)
    except Exception as e:
        metrics.incr(
            "metrics_layer.query",
            tags={**logging_tags, "status": "query_error"},
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
        tags={**logging_tags, "status": "success"},
    )
    return results


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
    use_case_id_str = _resolve_use_case_id_str(metrics_query.query)
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

from __future__ import annotations

from dataclasses import replace
from typing import Any, Mapping, Sequence, Union

from snuba_sdk import (
    AliasedExpression,
    BooleanCondition,
    Column,
    Condition,
    CurriedFunction,
    MetricsQuery,
    Request,
)

from sentry.models.project import Project
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_weak, string_to_use_case_id
from sentry.snuba.metrics.fields.base import _get_entity_of_metric_mri, org_id_from_projects
from sentry.snuba.metrics.naming_layer.mapping import get_mri, get_public_name_from_mri
from sentry.snuba.metrics.utils import to_intervals
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

FilterTypes = Union[Column, CurriedFunction, Condition, BooleanCondition]


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

    assert len(metrics_query.scope.org_ids) == 1  # Initially only allow 1 org id
    organization_id = metrics_query.scope.org_ids[0]
    tenant_ids = request.tenant_ids or {"organization_id": organization_id}
    if "use_case_id" not in tenant_ids and metrics_query.scope.use_case_id is not None:
        tenant_ids["use_case_id"] = metrics_query.scope.use_case_id
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

    # Resolves MRI or public name in metrics_query
    try:
        resolved_metrics_query = resolve_metrics_query(metrics_query)
        request.query = resolved_metrics_query
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
    results = {**snuba_results, "modified_start": start, "modified_end": end}
    metrics.incr(
        "metrics_layer.query",
        tags={"referrer": request.tenant_ids["referrer"] or "unknown", "status": "success"},
    )
    return results


def resolve_metrics_query(metrics_query: MetricsQuery) -> MetricsQuery:
    assert metrics_query.query is not None
    metric = metrics_query.query.metric
    scope = metrics_query.scope

    if not metric.public_name and metric.mri:
        public_name = get_public_name_from_mri(metric.mri)
        metrics_query = metrics_query.set_query(
            metrics_query.query.set_metric(metrics_query.query.metric.set_public_name(public_name))
        )
    elif not metric.mri and metric.public_name:
        mri = get_mri(metric.public_name)
        metrics_query = metrics_query.set_query(
            metrics_query.query.set_metric(metrics_query.query.metric.set_mri(mri))
        )

    projects = get_projects(scope.project_ids)
    org_id = org_id_from_projects(projects)
    use_case_id = string_to_use_case_id(scope.use_case_id)
    metric_id = resolve_weak(
        use_case_id, org_id, metrics_query.query.metric.mri
    )  # only support raw metrics for now
    metrics_query = metrics_query.set_query(
        metrics_query.query.set_metric(metrics_query.query.metric.set_id(metric_id))
    )

    if not metrics_query.query.metric.entity:
        entity = _get_entity_of_metric_mri(
            projects, metrics_query.query.metric.mri, use_case_id
        )  # TODO: will need reimplement this as this runs old metrics query
        metrics_query = metrics_query.set_query(
            metrics_query.query.set_metric(metrics_query.query.metric.set_entity(entity.value))
        )

    new_groupby = resolve_groupby(metrics_query.query.groupby, use_case_id, org_id)
    metrics_query = metrics_query.set_query(metrics_query.query.set_groupby(new_groupby))
    new_groupby = resolve_groupby(metrics_query.groupby, use_case_id, org_id)
    metrics_query = metrics_query.set_groupby(new_groupby)

    metrics_query = metrics_query.set_query(
        metrics_query.query.set_filters(
            resolve_filters(metrics_query.query.filters, use_case_id, org_id)
        )
    )
    metrics_query = metrics_query.set_filters(
        resolve_filters(metrics_query.filters, use_case_id, org_id)
    )
    return metrics_query


def resolve_groupby(
    groupby: list[Column] | None, use_case_id: UseCaseID, org_id: int
) -> list[Column] | None:
    """
    Go through the groupby columns and resolve any that need to be resolved.
    We also return a reverse mapping of the resolved columns to the original
    so that we can edit the results
    """
    if not groupby:
        return groupby

    new_groupby = []
    for col in groupby:
        resolved = resolve_weak(use_case_id, org_id, col.name)
        if resolved > -1:
            # TODO: This currently assumes the use of `tags_raw` but that might not always be correct
            # It also doesn't take into account mapping indexed tag values back to their original values
            new_groupby.append(
                AliasedExpression(exp=replace(col, name=f"tags_raw[{resolved}]"), alias=col.name)
            )
        else:
            new_groupby.append(col)

    return new_groupby


def resolve_filters(
    filters: list[Condition | BooleanCondition], use_case_id: UseCaseID, org_id: int
) -> list[Condition | BooleanCondition] | None:
    if not filters:
        return filters

    def resolve_exp(exp: FilterTypes) -> FilterTypes:
        if isinstance(exp, Column):
            resolved = resolve_weak(use_case_id, org_id, exp.name)
            if resolved > -1:
                return replace(exp, name=f"tags_raw[{resolved}]")
        elif isinstance(exp, CurriedFunction):
            return replace(exp, parameters=[resolve_exp(p) for p in exp.parameters])
        elif isinstance(exp, BooleanCondition):
            return replace(exp, conditions=[resolve_exp(c) for c in exp.conditions])
        elif isinstance(exp, Condition):
            return replace(exp, lhs=resolve_exp(exp.lhs))
        return exp

    new_filters = [resolve_exp(exp) for exp in filters]
    return new_filters


def get_projects(project_ids: Sequence[int]) -> Sequence[Project]:
    try:
        projects = list(Project.objects.filter(id__in=project_ids))
        return projects
    except Project.DoesNotExist:
        raise Exception("Requested project does not exist")

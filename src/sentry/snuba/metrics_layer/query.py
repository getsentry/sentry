from typing import Sequence

from snuba_sdk import Request
from snuba_sdk.metrics_query import MetricsQuery

from sentry.models import Project
from sentry.sentry_metrics.utils import resolve_weak, string_to_use_case_id
from sentry.snuba.metrics.fields.base import _get_entity_of_metric_mri, org_id_from_projects
from sentry.snuba.metrics.naming_layer.mapping import get_mri, get_public_name_from_mri
from sentry.snuba.metrics.utils import to_intervals


def run_query(request: Request) -> None:
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
    if "use_case_id" not in tenant_ids:
        tenant_ids["use_case_id"] = metrics_query.scope.use_case_id
    request.tenant_ids = tenant_ids

    # Process intervals
    assert metrics_query.rollup is not None
    if metrics_query.rollup.interval:
        start, end, _num_intervals = to_intervals(
            metrics_query.start, metrics_query.end, metrics_query.rollup.interval
        )
        metrics_query = metrics_query.set_start(start)
        metrics_query = metrics_query.set_end(end)

    # Resolves MRI or public name in metrics_query
    resolved_metrics_query = resolve_metrics_query(metrics_query)
    request.query = resolved_metrics_query

    # TODO: executing MetricQuery validation and serialization, result formatting, etc.


def resolve_metrics_query(metrics_query: MetricsQuery) -> MetricsQuery:
    assert metrics_query.query is not None
    metric = metrics_query.query.metric
    scope = metrics_query.scope

    if not metric.public_name and metric.mri:
        public_name = get_public_name_from_mri(metric.mri)
        metrics_query = metrics_query.set_query(
            metrics_query.query.set_metric(metrics_query.query.metric.set_public_name(public_name))
        )
    if not metric.mri and metric.public_name:
        mri = get_mri(metric.public_name)
        metrics_query = metrics_query.set_query(
            metrics_query.query.set_metric(metrics_query.query.metric.set_mri(mri))
        )

    projects = get_projects(scope.project_ids)
    use_case_id = string_to_use_case_id(scope.use_case_id)
    metric_id = resolve_weak(
        use_case_id, org_id_from_projects(projects), metrics_query.query.metric.mri
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
    return metrics_query


def get_projects(project_ids: Sequence[int]) -> Sequence[Project]:
    try:
        projects = list(Project.objects.filter(id__in=project_ids))
        return projects
    except Project.DoesNotExist:
        raise Exception("Requested project does not exist")

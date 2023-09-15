from typing import Any, Dict, Optional

from snuba_sdk import Request
from snuba_sdk.metrics_query import MetricsQuery

from sentry.snuba.metrics.fields.base import RawMetric, metric_object_factory
from sentry.snuba.metrics.naming_layer.mapping import get_mri, get_public_name_from_mri

# from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.utils import to_intervals


def run_query(request: Request, tenant_ids: Optional[Dict[str, Any]] = None):
    """TODO: write doc string"""
    metrics_query = request.query
    assert isinstance(metrics_query, MetricsQuery)

    assert len(metrics_query.scope.org_ids) == 1  # Initially only allow 1 org id
    organization_id = metrics_query.scope.org_ids[0]
    tenant_ids = tenant_ids or {"organization_id": organization_id}
    if "use_case_id" not in tenant_ids:
        tenant_ids["use_case_id"] = metrics_query.scope.use_case_id

    # process intervals
    if metrics_query.rollup.interval:
        start, end, _num_intervals = to_intervals(
            metrics_query.start, metrics_query.end, metrics_query.rollup.interval
        )
        metrics_query.set_start(start)
        metrics_query.set_end(end)

    # Resolve all MRIs in metrics_query
    metric = metrics_query.query.metric
    op = metrics_query.query.aggregate
    scope = metrics_query.scope
    if not metric.public_name and metric.mri:
        public_name = get_public_name_from_mri(metric.mri)
        metric.public_name = public_name
    if not metric.mri and metric.public_name:
        mri = get_mri(metric.public_name)
        metric.mri = mri

    metrics_object = metric_object_factory(op, metric.public_name)
    assert isinstance(metrics_object, RawMetric)  # only support raw metrics for now
    metrics_object.generate_metric_ids(scope.project_ids, scope.use_case_id)

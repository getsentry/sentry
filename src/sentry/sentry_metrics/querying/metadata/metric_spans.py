from typing import Sequence, Optional, Any
from datetime import datetime

from snuba_sdk import Query, Condition, Request, Entity, Op, Column

from sentry.models import Organization, Project
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


def _get_metrics_summaries(
    metric_mris: Sequence[str],
    start: datetime,
    end: datetime,
    min_value: Optional[float],
    max_value: Optional[float],
    organization: Organization,
    projects: Sequence[Project],
) -> Any:
    project_ids = [project.id for project in projects]

    where = []
    if min_value is not None:
        where.append(
            Condition(Column("min"), Op.GTE, min_value)
        )

    if max_value is not None:
        where.append(
            Condition(Column("max"), Op.LTE, max_value)
        )

    query = Query(
        match=Entity(EntityKey.MetricsSummaries.value),
        select=[],
        groupby=[],
        where=[
            Condition(Column("org_id"), Op.EQ, organization.id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("end_timestamp"), Op.GTE, start),
            Condition(Column("end_timestamp"), Op.LT, end),
            Condition(Column("metric_mri"), Op.IN, metric_mris)
        ] + where,
    )

    request = Request(
        dataset=Dataset.SpansIndexed.value,
        app_id="metrics",
        query=query,
        tenant_ids={"organization_id": organization.id},
    )

    data = raw_snql_query(request, Referrer.API_DDM_METRICS_SUMMARIES, use_cache=True)["data"]
    return data

def get_metric_spans(
    metric_mris: Sequence[str],
    start: datetime,
    end: datetime,
    min_value: Optional[float],
    max_value: Optional[float],
    organization: Organization,
    projects: Sequence[Project],
) -> Sequence[Any]:
    return []
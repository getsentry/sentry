from dataclasses import dataclass
from datetime import datetime
from typing import Mapping, Optional, Sequence, Set

from snuba_sdk import Column, Condition, Entity, Op, Query, Request

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba import spans_indexed
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

# Maximum number of unique spans returned by the database.
MAX_NUMBER_OF_SPANS = 10


@dataclass(frozen=True)
class Span:
    project_id: int
    span_id: str
    trace_id: str
    transaction_id: Optional[str]
    profile_id: Optional[str]
    duration: int


@dataclass(frozen=True)
class MetricSpans:
    metric_mri: str
    spans: Sequence[Span]

    def __hash__(self):
        # For the serializer we need to implement a hashing function that uniquely identifies a metric.
        return hash(self.metric_mri)


def _get_spans_by_ids(
    span_ids: Set[str],
    start: datetime,
    end: datetime,
    organization: Organization,
    projects: Sequence[Project],
) -> Sequence[Span]:
    data = spans_indexed.query(
        selected_columns=[
            "project_id",
            "span_id",
            "trace_id",
            "transaction_id",
            "profile_id",
            "duration",
        ],
        params={
            "organization_id": organization.id,
            "project_objects": projects,
            "start": start,
            "end": end,
        },
        query=f"span_id:[{','.join(span_ids)}]",
        limit=MAX_NUMBER_OF_SPANS,
        referrer=Referrer.API_DDM_METRICS_SUMMARIES.value,
    )["data"]

    return [Span(**value) for value in data]


def _get_metrics_summaries(
    metric_mris: Sequence[str],
    start: datetime,
    end: datetime,
    min_value: Optional[float],
    max_value: Optional[float],
    organization: Organization,
    projects: Sequence[Project],
) -> Mapping[str, Set[str]]:
    project_ids = [project.id for project in projects]

    where = []
    if min_value is not None:
        where.append(Condition(Column("min"), Op.GTE, min_value))

    if max_value is not None:
        where.append(Condition(Column("max"), Op.LTE, max_value))

    query = Query(
        match=Entity(EntityKey.MetricsSummaries.value),
        select=[Column("span_id"), Column("metric_mri")],
        where=[
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("end_timestamp"), Op.GTE, start),
            Condition(Column("end_timestamp"), Op.LT, end),
            Condition(Column("metric_mri"), Op.IN, metric_mris),
        ]
        + where,
    )

    request = Request(
        dataset=Dataset.SpansIndexed.value,
        app_id="metrics",
        query=query,
        tenant_ids={"organization_id": organization.id},
    )

    data = raw_snql_query(request, Referrer.API_DDM_METRICS_SUMMARIES.value, use_cache=True)["data"]

    metrics_span_ids = {}
    for value in data:
        metrics_span_ids.setdefault(value["metric_mri"], set()).add(value["span_id"])

    return metrics_span_ids


def get_spans_of_metrics(
    metric_mris: Sequence[str],
    start: datetime,
    end: datetime,
    min_value: Optional[float],
    max_value: Optional[float],
    organization: Organization,
    projects: Sequence[Project],
) -> Sequence[MetricSpans]:
    metrics_span_ids = _get_metrics_summaries(
        metric_mris, start, end, min_value, max_value, organization, projects
    )

    metrics_spans = []
    # TODO: for now we simply issue a query per mri, but in the future we might want to batch queries.
    for metric_mri, span_ids in metrics_span_ids.items():
        spans = _get_spans_by_ids(span_ids, start, end, organization, projects)
        metrics_spans.append(MetricSpans(metric_mri=metric_mri, spans=spans))

    return metrics_spans

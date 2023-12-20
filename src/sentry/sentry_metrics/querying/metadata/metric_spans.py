from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Sequence, Set

from snuba_sdk import Column, Condition, Entity, Op, Query, Request, Timeseries
from snuba_sdk.conditions import BooleanCondition, ConditionGroup
from snuba_sdk.mql.mql import parse_mql

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.api import InvalidMetricsQueryError
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
            "timestamp",
        ],
        # We are interested in the most recent spans for now.
        orderby=["-timestamp"],
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

    return [
        Span(
            project_id=value["project_id"],
            span_id=value["span_id"],
            trace_id=value["trace_id"],
            transaction_id=value["transaction_id"],
            profile_id=value["profile_id"],
            duration=value["duration"],
        )
        for value in data
    ]


def _convert_to_tags(conditions: Optional[ConditionGroup]) -> Optional[ConditionGroup]:
    if conditions is None:
        return None

    new_conditions = []
    for condition in conditions:
        if isinstance(condition, BooleanCondition):
            new_conditions.append(
                BooleanCondition(op=condition.op, conditions=_convert_to_tags(condition.conditions))
            )
        elif isinstance(condition, Condition) and isinstance(condition.lhs, Column):
            # We assume that all incoming conditions are on tags, since we do not allow filtering by project in the
            # query filters.
            tag_column = f"tags[{condition.lhs.name}]"
            new_conditions.append(
                Condition(lhs=Column(name=tag_column), op=condition.op, rhs=condition.rhs)
            )

    return new_conditions


def _get_snuba_conditions_from_query(query: str) -> Optional[ConditionGroup]:
    # We want to create a phantom query to feed into the parser in order to be able to extract the conditions from the
    # returned timeseries.
    phantom_query = f"count(phantom){{{query}}}"

    parsed_phantom_query = parse_mql(phantom_query).query
    if not isinstance(parsed_phantom_query, Timeseries):
        # For now, we reuse data from `api` but we will soon lift out common components from that file.
        raise InvalidMetricsQueryError("The supplied query is not valid")

    return _convert_to_tags(parsed_phantom_query.filters)


def _get_metrics_summaries(
    metric_mri: str,
    query: str,
    start: datetime,
    end: datetime,
    min_value: Optional[float],
    max_value: Optional[float],
    organization: Organization,
    projects: Sequence[Project],
) -> Set[str]:
    project_ids = [project.id for project in projects]

    where = []
    if min_value is not None:
        where.append(Condition(Column("min"), Op.GTE, min_value))

    if max_value is not None:
        where.append(Condition(Column("max"), Op.LTE, max_value))

    if query is not None:
        snuba_conditions = _get_snuba_conditions_from_query(query)
        if snuba_conditions:
            where += snuba_conditions

    query = Query(
        match=Entity(EntityKey.MetricsSummaries.value),
        select=[Column("span_id"), Column("metric_mri")],
        where=[
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("end_timestamp"), Op.GTE, start),
            Condition(Column("end_timestamp"), Op.LT, end),
            Condition(Column("metric_mri"), Op.EQ, metric_mri),
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

    return {value["span_id"] for value in data}


def get_spans_of_metric(
    metric_mri: str,
    query: Optional[str],
    start: datetime,
    end: datetime,
    min_value: Optional[float],
    max_value: Optional[float],
    organization: Organization,
    projects: Sequence[Project],
) -> MetricSpans:
    span_ids = _get_metrics_summaries(
        metric_mri, query, start, end, min_value, max_value, organization, projects
    )

    spans = _get_spans_by_ids(span_ids, start, end, organization, projects)

    return MetricSpans(metric_mri=metric_mri, spans=spans)

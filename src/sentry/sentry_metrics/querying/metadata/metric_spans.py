from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Sequence, Set

from snuba_sdk import Column, Condition, Entity, Limit, Op, Query, Request, Timeseries
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
    """
    Returns multiple `Span`s given a set of `span_ids`.

    The rationale behind this query is that we want to query the main `spans` entity to get more information about the
    span. Since this query is relatively inefficient due to the use of the `IN` operator, we might want to change the
    data representation in the future.
    """
    if not span_ids:
        return []

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
        referrer=Referrer.API_DDM_FETCH_SPANS.value,
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
    """
    Converts all the conditions to work on tags, by wrapping each `Column` name with 'tags[x]'.

    This function assumes that the query of a metric only refers to tags.
    """
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
    """
    Returns a set of Snuba conditions from a query string which is assumed to contain filters in the MQL grammar.

    Since MQL does not support parsing only filters, we have to create a phantom query to feed the parser, in order for
    it to correctly resolve a `Timeseries` out of which we extract the `filters`.
    """
    # We want to create a phantom query to feed into the parser in order to be able to extract the conditions from the
    # returned timeseries.
    phantom_query = f"count(phantom){{{query}}}"

    # TODO: find a way to directly use only filters grammar to avoid making a phantom query.
    parsed_phantom_query = parse_mql(phantom_query).query
    if not isinstance(parsed_phantom_query, Timeseries):
        # For now, we reuse data from `api` but we will soon lift out common components from that file.
        raise InvalidMetricsQueryError("The supplied query is not valid")

    return _convert_to_tags(parsed_phantom_query.filters)


def _get_metrics_summaries(
    metric_mri: str,
    query: Optional[str],
    start: datetime,
    end: datetime,
    min_value: Optional[float],
    max_value: Optional[float],
    organization: Organization,
    projects: Sequence[Project],
) -> Set[str]:
    """
    Returns a set of cardinality at most `MAX_NUMBER_OF_SPANS` containing the ids of the spans in which `metric_mri`
    was emitted.

    In order to honor the filters that the user has in a widget, we take the `query` and parse it to extract a
    series of Snuba conditions that we apply on the tags of the metric summary. For example, if you are filtering by
    tag device:iPhone, we will only show you the spans in which the metric with tag device:iPhone was emitted.
    """
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
        select=[Column("span_id")],
        where=[
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("end_timestamp"), Op.GTE, start),
            Condition(Column("end_timestamp"), Op.LT, end),
            Condition(Column("metric_mri"), Op.EQ, metric_mri),
        ]
        + where,
        # We group by to deduplicate the span id and apply the limit.
        groupby=[Column("span_id")],
        limit=Limit(MAX_NUMBER_OF_SPANS),
    )

    request = Request(
        dataset=Dataset.SpansIndexed.value,
        app_id="metrics",
        query=query,
        tenant_ids={"organization_id": organization.id},
    )

    data = raw_snql_query(request, Referrer.API_DDM_FETCH_METRICS_SUMMARIES.value, use_cache=True)[
        "data"
    ]

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
    """
    Returns the spans in which the metric with `metric_mri` was emitted.

    The metric can be emitted within a span with different tag values. These are uniquely stored in the
    metrics_summaries entity.
    """
    span_ids = _get_metrics_summaries(
        metric_mri, query, start, end, min_value, max_value, organization, projects
    )

    spans = _get_spans_by_ids(span_ids, start, end, organization, projects)

    return MetricSpans(metric_mri=metric_mri, spans=spans)

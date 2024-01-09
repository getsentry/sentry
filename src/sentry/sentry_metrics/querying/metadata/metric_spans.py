from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Sequence, Set

from snuba_sdk import Column, Condition, Direction, Entity, Limit, Op, OrderBy, Query, Request
from snuba_sdk.conditions import ConditionGroup

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.api import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.metadata.utils import (
    get_snuba_conditions_from_query,
    transform_conditions_with,
    transform_to_tags,
)
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI, is_mri
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

# Maximum number of unique spans returned by the database.
MAX_NUMBER_OF_SPANS = 10
# Sentry tag values that are converted to columns in Snuba. The conversion happens here:
# https://github.com/getsentry/snuba/blob/master/snuba/datasets/processors/spans_processor.py
SENTRY_TAG_TO_COLUMN_NAME = {
    "module": "module",
    "action": "action",
    "domain": "domain",
    "group": "group",
    "system": "platform",
    "transaction": "segment_name",
    "op": "op",
    "transaction.op": "transaction_op",
}


@dataclass(frozen=True)
class Span:
    project_id: int
    span_id: str
    trace_id: str
    transaction_id: Optional[str]
    profile_id: Optional[str]
    duration: int
    segment_name: str
    timestamp: datetime


@dataclass(frozen=True)
class MetricSpans:
    metric_mri: str
    spans: Sequence[Span]

    def __hash__(self):
        # For the serializer we need to implement a hashing function that uniquely identifies a metric.
        return hash(self.metric_mri)


class SpansSource(ABC):
    def __init__(
        self,
        organization: Organization,
        projects: Sequence[Project],
    ):
        self.organization = organization
        self.projects = projects

    def get_spans(
        self,
        metric_mri: str,
        query: Optional[str],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Sequence[Span]:
        return self._get_spans(
            metric_mri=metric_mri,
            # TODO: when the environment support is added, inject here the environment condition after the AST is
            #   generated.
            conditions=get_snuba_conditions_from_query(query) if query else None,
            start=start,
            end=end,
            min_value=min_value,
            max_value=max_value,
        )

    @classmethod
    @abstractmethod
    def supports(cls, metric_mri: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def _get_spans(
        self,
        metric_mri: str,
        conditions: Optional[ConditionGroup],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Sequence[Span]:
        raise NotImplementedError


class MetricsSummariesSpansSource(SpansSource):
    def _get_span_ids_from_metrics_summaries(
        self,
        metric_mri: str,
        conditions: Optional[ConditionGroup],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Set[str]:
        """
        Returns a set of cardinality at most `MAX_NUMBER_OF_SPANS` containing the ids of the spans in which `metric_mri`
        was emitted.

        In order to honor the filters that the user has in a widget, we take the `query` and parse it to extract a
        series of Snuba conditions that we apply on the tags of the metric summary. For example, if you are filtering by
        tag device:iPhone, we will only show you the spans in which the metric with tag device:iPhone was emitted.
        """
        where = []

        if min_value is not None:
            where.append(Condition(Column("min"), Op.GTE, min_value))
        if max_value is not None:
            where.append(Condition(Column("max"), Op.LTE, max_value))
        if conditions:
            where += conditions

        query = Query(
            match=Entity(EntityKey.MetricsSummaries.value),
            select=[Column("span_id")],
            where=[
                Condition(Column("project_id"), Op.IN, [project.id for project in self.projects]),
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
            tenant_ids={"organization_id": self.organization.id},
        )

        data = raw_snql_query(
            request, Referrer.API_DDM_FETCH_METRICS_SUMMARIES.value, use_cache=True
        )["data"]

        return {value["span_id"] for value in data}

    @classmethod
    def supports(cls, metric_mri: str) -> bool:
        return is_mri(metric_mri)

    def _get_spans(
        self,
        metric_mri: str,
        conditions: Optional[ConditionGroup],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Sequence[Span]:
        span_ids = self._get_span_ids_from_metrics_summaries(
            metric_mri=metric_mri,
            conditions=transform_to_tags(conditions),
            start=start,
            end=end,
            min_value=min_value,
            max_value=max_value,
        )
        if not span_ids:
            return []

        return get_indexed_spans(
            where=[Condition(Column("span_id"), Op.IN, list(span_ids))],
            start=start,
            end=end,
            organization=self.organization,
            projects=self.projects,
        )


class TransactionDurationSpansSource(SpansSource):
    @classmethod
    def supports(cls, metric_mri: str) -> bool:
        return metric_mri == TransactionMRI.DURATION.value

    def _get_spans(
        self,
        metric_mri: str,
        conditions: Optional[ConditionGroup],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Sequence[Span]:
        where = []

        transformed_conditions = transform_to_tags(conditions=conditions, check_sentry_tags=True)
        transformed_conditions = transform_conditions_with(
            conditions=transformed_conditions, mappings=SENTRY_TAG_TO_COLUMN_NAME
        )

        if transformed_conditions:
            where += transformed_conditions
        if min_value:
            where += [Condition(Column("duration"), Op.GTE, min_value)]
        if max_value:
            where += [Condition(Column("duration"), Op.LTE, max_value)]

        return get_indexed_spans(
            where=[
                Condition(Column("is_segment"), Op.GTE, 1),
            ]
            + where,
            start=start,
            end=end,
            organization=self.organization,
            projects=self.projects,
        )


def get_indexed_spans(
    where: Optional[ConditionGroup],
    start: datetime,
    end: datetime,
    organization: Organization,
    projects: Sequence[Project],
):
    """
    Fetches top N most recent indexed spans.

    The choice of not using query builders was deliberate, since we have to access columns that are not exposed via
    the query builders because they are meant to be internal.
    """
    query = Query(
        match=Entity(EntityKey.Spans.value),
        select=[
            Column("project_id"),
            Column("span_id"),
            Column("trace_id"),
            Column("transaction_id"),
            Column("profile_id"),
            Column("duration"),
            Column("segment_name"),
            Column("timestamp"),
        ],
        where=[
            Condition(Column("project_id"), Op.IN, [project.id for project in projects]),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
        ]
        + (where or []),
        # We want to get the newest spans.
        orderby=[OrderBy(Column("timestamp"), Direction.DESC)],
        limit=Limit(MAX_NUMBER_OF_SPANS),
    )

    request = Request(
        dataset=Dataset.SpansIndexed.value,
        app_id="metrics",
        query=query,
        tenant_ids={"organization_id": organization.id},
    )

    data = raw_snql_query(request, Referrer.API_DDM_FETCH_SPANS.value, use_cache=True)["data"]

    return [
        Span(
            project_id=value["project_id"],
            span_id=value["span_id"],
            trace_id=value["trace_id"],
            transaction_id=value["transaction_id"],
            profile_id=value["profile_id"],
            duration=value["duration"],
            segment_name=value["segment_name"],
            timestamp=value["timestamp"],
        )
        for value in data
    ]


def get_spans_source(
    metric_mri: str, organization: Organization, projects: Sequence[Project]
) -> Optional[SpansSource]:
    """
    Finds the first spans source that supports the `metric_mri`.

    In case multiple sources would apply to a `metric_mri` the first one is chosen.
    """
    for source_clazz in [TransactionDurationSpansSource, MetricsSummariesSpansSource]:
        if source_clazz.supports(metric_mri):
            return source_clazz(organization=organization, projects=projects)

    return None


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
    spans_source = get_spans_source(metric_mri, organization, projects)
    if not spans_source:
        raise InvalidMetricsQueryError(
            f"The supplied metric {metric_mri} does not support fetching correlated spans"
        )

    spans = spans_source.get_spans(metric_mri, query, start, end, min_value, max_value)
    return MetricSpans(
        metric_mri=metric_mri,
        spans=spans,
    )

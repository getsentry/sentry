from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime
from typing import cast

import sentry_sdk
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Op,
    OrderBy,
    Query,
    Request,
)
from snuba_sdk.conditions import ConditionGroup
from snuba_sdk.mql.mql import parse_mql
from snuba_sdk.timeseries import Timeseries

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.common import SNUBA_QUERY_LIMIT
from sentry.sentry_metrics.querying.errors import (
    CorrelationsQueryExecutionError,
    InvalidMetricsQueryError,
)
from sentry.sentry_metrics.querying.types import QueryCondition
from sentry.sentry_metrics.querying.visitors import (
    EnvironmentsInjectionVisitor,
    LatestReleaseTransformationVisitor,
    MappingTransformationVisitor,
    QueryConditionVisitor,
    TagsTransformationVisitor,
)
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import (
    ParsedMRI,
    SpanMRI,
    TransactionMRI,
    is_measurement,
    is_mri,
    parse_mri,
)
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import SnubaError, bulk_snuba_queries, raw_snql_query

# Maximum number of unique results returned by the database.
MAX_NUMBER_OF_RESULTS = 10
# Sentry tag values that are converted to columns in Snuba. The conversion happens here:
# https://github.com/getsentry/snuba/blob/master/rust_snuba/src/processors/spans.rs#L239
SENTRY_TAG_TO_COLUMN_NAME = {
    "module": "module",
    "action": "action",
    "domain": "domain",
    "group": "group",
    "system": "platform",
    "transaction": "segment_name",
    "op": "op",
    "transaction.op": "transaction_op",
    "user": "user",
    "status": "status",
}


@dataclass(frozen=True)
class MetricSummary:
    """
    Summary of a metric inside a span.
    """

    span_id: str
    min: float
    max: float
    sum: float
    count: float


@dataclass(frozen=True)
class SpanDetail:
    """
    Details of an individual span which is inside a segment.
    """

    span_id: str
    span_duration: int
    span_timestamp: datetime


@dataclass(frozen=True)
class SpanSummary:
    """
    Summary of the durations of the spans grouped by op.
    """

    span_op: str
    total_duration: int


@dataclass(frozen=True)
class Segment:
    """
    Segment which is correlated to a certain metric.
    """

    project_id: int
    trace_id: str
    segment_id: str
    segment_span_id: str
    segment_name: str
    profile_id: str | None
    spans_number: int
    metric_summaries: Sequence[MetricSummary]
    spans_details: Sequence[SpanDetail]
    spans_summary: Sequence[SpanSummary]
    duration: int
    timestamp: datetime

    def add_metric_summaries(self, metric_summaries: Sequence[MetricSummary]) -> "Segment":
        return replace(self, metric_summaries=metric_summaries)

    def add_spans_details(self, spans_details: Sequence[SpanDetail]) -> "Segment":
        return replace(self, spans_details=spans_details)


@dataclass(frozen=True)
class MetricCorrelations:
    metric_mri: str
    segments: Sequence[Segment]

    def __hash__(self):
        # For the serializer we need to implement a hashing function that uniquely identifies a metric.
        return hash(self.metric_mri)


class QueryConditions:
    def __init__(self, conditions: list[QueryCondition]):
        self._conditions = conditions
        self._visitors: list[QueryConditionVisitor[QueryCondition]] = []

    @classmethod
    def build(cls, query: str | None, environments: Sequence[Environment]) -> "QueryConditions":
        """
        Returns a set of Snuba conditions from a query string which is assumed to contain filters in the MQL grammar.

        Since MQL does not support parsing only filters, we have to create a phantom query to feed the parser,
        in order for it to correctly resolve a `Timeseries` out of which we extract the `filters`.
        """
        # We want to create a phantom query to feed into the parser in order to be able to extract the conditions
        # from the returned timeseries.
        phantom_query = f"count(phantom){{{query or ''}}}"

        parsed_phantom_query = parse_mql(phantom_query)
        if not isinstance(parsed_phantom_query, Timeseries):
            # For now, we reuse data from `api` but we will soon lift out common components from that file.
            raise InvalidMetricsQueryError("The supplied query is not valid")

        if parsed_phantom_query.filters is None:
            parsed_phantom_query = parsed_phantom_query.set_filters([])

        # We inject the environments in the phantom query.
        parsed_phantom_query = EnvironmentsInjectionVisitor(environments).visit(
            parsed_phantom_query
        )
        return QueryConditions(cast(list[QueryCondition], parsed_phantom_query.filters))

    def add_visitor(self, visitor: QueryConditionVisitor[QueryCondition]) -> "QueryConditions":
        self._visitors.append(visitor)
        return self

    def get(self) -> list[QueryCondition]:
        conditions = self._conditions
        for visitor in self._visitors:
            conditions = visitor.visit_group(conditions)

        return conditions


class CorrelationsSource(ABC):
    def __init__(
        self,
        organization: Organization,
        projects: Sequence[Project],
    ):
        self.organization = organization
        self.projects = projects

    def get_segments(
        self,
        metric_mri: str,
        query: str | None,
        start: datetime,
        end: datetime,
        min_value: float | None,
        max_value: float | None,
        environments: Sequence[Environment],
    ) -> Sequence[Segment]:
        conditions = QueryConditions.build(query, environments).add_visitor(
            LatestReleaseTransformationVisitor(self.projects)
        )

        return self._get_segments(
            metric_mri=metric_mri,
            conditions=conditions,
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
    def _get_segments(
        self,
        metric_mri: str,
        conditions: QueryConditions,
        start: datetime,
        end: datetime,
        min_value: float | None,
        max_value: float | None,
    ) -> Sequence[Segment]:
        raise NotImplementedError


class MetricsSummariesCorrelationsSource(CorrelationsSource):
    def _get_metrics_summaries_by_span(
        self,
        metric_mri: str,
        conditions: QueryConditions,
        start: datetime,
        end: datetime,
        min_value: float | None,
        max_value: float | None,
    ) -> Mapping[str, tuple[float, float, float, float]]:
        """
        Returns a mapping between a span ids and the metrics summary for that span.

        In order to honor the filters that the user has in a widget, we take the `query` and parse it to extract a
        series of Snuba conditions that we apply on the tags of the metric summary. For example, if you are filtering by
        tag device:iPhone, we will only show you the spans in which the metric with tag device:iPhone was emitted.
        """
        having = []
        if min_value is not None:
            having.append(Condition(Column("min"), Op.GTE, min_value))
        if max_value is not None:
            having.append(Condition(Column("max"), Op.LTE, max_value))

        query = Query(
            match=Entity(EntityKey.MetricsSummaries.value),
            select=[
                Column("span_id"),
                # In case a span has multiple summaries with the same conditions, we will merge them.
                Function("min", [Column("min")], alias="min"),
                Function("max", [Column("max")], alias="max"),
                Function("sum", [Column("sum")], alias="sum"),
                Function("sum", [Column("count")], alias="count"),
            ],
            where=[
                Condition(Column("project_id"), Op.IN, [project.id for project in self.projects]),
                Condition(Column("end_timestamp"), Op.GTE, start),
                Condition(Column("end_timestamp"), Op.LT, end),
                Condition(Column("metric_mri"), Op.EQ, metric_mri),
            ]
            + conditions.get(),
            having=having,
            groupby=[Column("span_id")],
            limit=Limit(SNUBA_QUERY_LIMIT),
        )

        request = Request(
            dataset=Dataset.SpansIndexed.value,
            app_id="metrics",
            query=query,
            tenant_ids={"organization_id": self.organization.id},
        )

        data = raw_snql_query(
            request,
            Referrer.API_ORGANIZATION_METRICS_METADATA_FETCH_METRICS_SUMMARIES.value,
            use_cache=True,
        )["data"]

        # For now, we assume that each span will have an aggregated metric summary for simplicity.
        return {
            value["span_id"]: (value["min"], value["max"], value["sum"], value["count"])
            for value in data
        }

    def _get_segments_spans(
        self,
        span_ids: set[str],
        start: datetime,
        end: datetime,
    ) -> Mapping[str, Sequence[tuple[str, int, datetime]]]:
        """
        Returns a mapping of the transaction id and all the correlated spans inside that segment.
        """
        if not span_ids:
            return {}

        query = Query(
            match=Entity(EntityKey.Spans.value),
            select=[
                Column("transaction_id"),
                Column("span_id"),
                Column("duration"),
                Column("timestamp"),
            ],
            where=[
                Condition(Column("project_id"), Op.IN, [project.id for project in self.projects]),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("span_id"), Op.IN, list(span_ids)),
            ],
            limit=Limit(SNUBA_QUERY_LIMIT),
        )

        request = Request(
            dataset=Dataset.SpansIndexed.value,
            app_id="metrics",
            query=query,
            tenant_ids={"organization_id": self.organization.id},
        )

        data = raw_snql_query(
            request, Referrer.API_ORGANIZATION_METRICS_METADATA_FETCH_SPANS.value, use_cache=True
        )["data"]

        segments_spans: dict[str, list[tuple[str, int, datetime]]] = {}
        for value in data:
            segments_spans.setdefault(value["transaction_id"], []).append(
                (value["span_id"], value["duration"], value["timestamp"])
            )

        return segments_spans

    @classmethod
    def supports(cls, metric_mri: str) -> bool:
        return is_mri(metric_mri)

    def _get_segments(
        self,
        metric_mri: str,
        conditions: QueryConditions,
        start: datetime,
        end: datetime,
        min_value: float | None,
        max_value: float | None,
    ) -> Sequence[Segment]:
        if conditions:
            conditions.add_visitor(TagsTransformationVisitor(check_sentry_tags=False))

        # First, we fetch the spans we are interested in given the metric and the bounds.
        metric_summaries_by_span = self._get_metrics_summaries_by_span(
            metric_mri=metric_mri,
            conditions=conditions,
            start=start,
            end=end,
            min_value=min_value,
            max_value=max_value,
        )

        # Second, we fetch all the segments which contain the span ids.
        segments_spans = self._get_segments_spans(
            span_ids=set(metric_summaries_by_span.keys()),
            start=start,
            end=end,
        )

        # Third, we fetch the segments details together with aggregates
        if segments_spans:
            segments = _get_segments(
                where=[Condition(Column("transaction_id"), Op.IN, list(segments_spans.keys()))],
                start=start,
                end=end,
                organization=self.organization,
                projects=self.projects,
            )
        else:
            # If there are no segment spans, we can safely skip fetching segment details
            segments = []

        # Fourth, we merge span details with the fetched segments.
        extended_segments = []
        for segment in segments:
            metric_summaries = []
            spans_details = []
            for span_id, duration, timestamp in segments_spans.get(segment.segment_id, []):
                if (metric_summary := metric_summaries_by_span.get(span_id)) is not None:
                    metric_summaries.append(
                        MetricSummary(
                            span_id=span_id,
                            min=metric_summary[0],
                            max=metric_summary[1],
                            sum=metric_summary[2],
                            count=metric_summary[3],
                        )
                    )

                spans_details.append(
                    SpanDetail(span_id=span_id, span_duration=duration, span_timestamp=timestamp)
                )

            extended_segments.append(
                segment.add_metric_summaries(metric_summaries).add_spans_details(spans_details)
            )

        return extended_segments


class TransactionDurationCorrelationsSource(CorrelationsSource):
    @classmethod
    def supports(cls, metric_mri: str) -> bool:
        return metric_mri == TransactionMRI.DURATION.value

    def _get_segments(
        self,
        metric_mri: str,
        conditions: QueryConditions,
        start: datetime,
        end: datetime,
        min_value: float | None,
        max_value: float | None,
    ) -> Sequence[Segment]:
        where: list[QueryCondition] = []

        conditions.add_visitor(TagsTransformationVisitor(check_sentry_tags=True))
        conditions.add_visitor(MappingTransformationVisitor(mappings=SENTRY_TAG_TO_COLUMN_NAME))
        where += conditions.get()

        if min_value:
            where += [Condition(Column("duration"), Op.GTE, min_value)]
        if max_value:
            where += [Condition(Column("duration"), Op.LTE, max_value)]

        # TODO: there might be the need to first obtain a set of transaction ids that have specific measurements and
        #  then filter all spans with that transaction id.
        return _get_segments(
            where=where,
            start=start,
            end=end,
            organization=self.organization,
            projects=self.projects,
        )


class MeasurementsCorrelationsSource(CorrelationsSource):
    def _extract_measurement_name(self, metric_mri: str) -> str:
        # We assume the `parse_mri` to never fail, since we have the guarantee that `supports` is called first.
        return cast(ParsedMRI, parse_mri(metric_mri)).name[13:]

    @classmethod
    def supports(cls, metric_mri: str) -> bool:
        parsed_mri = parse_mri(metric_mri)
        if parsed_mri:
            return is_measurement(parsed_mri)

        return False

    def _get_segments(
        self,
        metric_mri: str,
        conditions: QueryConditions,
        start: datetime,
        end: datetime,
        min_value: float | None,
        max_value: float | None,
    ) -> Sequence[Segment]:
        where: list[QueryCondition] = []

        conditions.add_visitor(TagsTransformationVisitor(check_sentry_tags=True))
        conditions.add_visitor(MappingTransformationVisitor(mappings=SENTRY_TAG_TO_COLUMN_NAME))
        where += conditions.get()

        measurement_name = self._extract_measurement_name(metric_mri)
        # We add this condition every time, since if a measurement is not set, Snuba will return 0, but it could also
        # return 0 if the measurement value is 0, thus we need a way to discriminate between the two cases.
        where += [
            Condition(Function("has", [Column("measurements.key"), measurement_name]), Op.EQ, 1)
        ]

        if min_value:
            where += [Condition(Column(f"measurements[{measurement_name}]"), Op.GTE, min_value)]
        if max_value:
            where += [Condition(Column(f"measurements[{measurement_name}]"), Op.LTE, max_value)]

        # TODO: there might be the need to first obtain a set of transaction ids that have specific measurements and
        #  then filter all spans with that transaction id.
        return _get_segments(
            where=where,
            start=start,
            end=end,
            organization=self.organization,
            projects=self.projects,
        )


class SpansDurationCorrelationsSource(CorrelationsSource):
    @classmethod
    def supports(cls, metric_mri: str) -> bool:
        return cls.get_span_column(metric_mri) is not None

    @classmethod
    def get_span_column(cls, metric_mri: str) -> Column | None:
        if metric_mri == SpanMRI.SELF_TIME.value:
            return Column("exclusive_time")

        if metric_mri == SpanMRI.DURATION.value:
            return Column("duration")

        return None

    def _get_segments(
        self,
        metric_mri: str,
        conditions: QueryConditions,
        start: datetime,
        end: datetime,
        min_value: float | None,
        max_value: float | None,
    ) -> Sequence[Segment]:
        segments_spans = self._get_segments_spans(
            metric_mri, conditions, start, end, min_value, max_value
        )

        if segments_spans:
            segments = _get_segments(
                where=[Condition(Column("transaction_id"), Op.IN, list(segments_spans.keys()))],
                start=start,
                end=end,
                organization=self.organization,
                projects=self.projects,
            )
        else:
            segments = []

        extended_segments = []
        for segment in segments:
            metric_summaries = []
            spans_details = []
            for span_id, duration, timestamp in segments_spans.get(segment.segment_id, []):
                # the span duration and self time metric happens once per span, so we can
                # hard code what the metric summary object here
                metric_summaries.append(
                    MetricSummary(
                        span_id=span_id,
                        min=duration,
                        max=duration,
                        sum=duration,
                        count=1,
                    )
                )

                spans_details.append(
                    SpanDetail(span_id=span_id, span_duration=duration, span_timestamp=timestamp)
                )

            extended_segments.append(
                segment.add_metric_summaries(metric_summaries).add_spans_details(spans_details)
            )

        return extended_segments

    def _get_segments_spans(
        self,
        metric_mri,
        conditions: QueryConditions,
        start: datetime,
        end: datetime,
        min_value: float | None,
        max_value: float | None,
    ) -> Mapping[str, Sequence[tuple[str, int, datetime]]]:
        column = self.get_span_column(metric_mri)
        assert column is not None

        where: list[QueryCondition] = [
            Condition(Column("project_id"), Op.IN, [project.id for project in self.projects]),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
        ]

        where.extend(conditions.get())

        if min_value:
            where += [Condition(column, Op.GTE, min_value)]
        if max_value:
            where += [Condition(column, Op.LTE, max_value)]

        query = Query(
            match=Entity(EntityKey.Spans.value),
            select=[
                Column("transaction_id"),
                Column("span_id"),
                column,
                Column("timestamp"),
            ],
            where=where,
            limit=Limit(SNUBA_QUERY_LIMIT),
        )

        request = Request(
            dataset=Dataset.SpansIndexed.value,
            app_id="metrics",
            query=query,
            tenant_ids={"organization_id": self.organization.id},
        )

        data = raw_snql_query(
            request, Referrer.API_ORGANIZATION_METRICS_METADATA_FETCH_SPANS.value, use_cache=True
        )["data"]

        segments_spans: dict[str, list[tuple[str, int, datetime]]] = {}
        for value in data:
            segments_spans.setdefault(value["transaction_id"], []).append(
                (value["span_id"], value[column.name], value["timestamp"])
            )

        return segments_spans


def _get_segments_aggregates_query(
    where: ConditionGroup | None,
    start: datetime,
    end: datetime,
    projects: Sequence[Project],
) -> Query:
    return Query(
        match=Entity(EntityKey.Spans.value),
        select=[
            Column("project_id"),
            Column("trace_id"),
            Column("transaction_id"),
            Column("segment_name"),
            Column("profile_id"),
            # Counts the number of spans inside a transaction.
            Function(
                "countIf",
                [Column("span_id"), Function("equals", [Column("is_segment"), 0])],
                alias="spans_number",
            ),
            # Returns the span id of the transaction.
            Function(
                "anyIf",
                [Column("span_id"), Function("equals", [Column("is_segment"), 1])],
                alias="transaction_span_id",
            ),
            # Returns the duration of the transaction.
            Function(
                "sumIf",
                [Column("duration"), Function("equals", [Column("is_segment"), 1])],
                alias="segment_duration",
            ),
            # Returns the timestamp of the transaction.
            Function(
                "anyIf",
                [Column("timestamp"), Function("equals", [Column("is_segment"), 1])],
                alias="any_timestamp",
            ),
        ],
        where=[
            Condition(Column("project_id"), Op.IN, [project.id for project in projects]),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
        ]
        + (where or []),
        groupby=[
            Column("project_id"),
            Column("trace_id"),
            Column("transaction_id"),
            Column("segment_name"),
            Column("profile_id"),
        ],
        # For now, we order by descending segment duration.
        orderby=[OrderBy(Column("segment_duration"), Direction.DESC)],
        limit=Limit(MAX_NUMBER_OF_RESULTS),
    )


def _get_segments_spans_summaries_query(
    where: ConditionGroup | None,
    start: datetime,
    end: datetime,
    projects: Sequence[Project],
) -> Query:
    return Query(
        match=Entity(EntityKey.Spans.value),
        select=[
            Column("transaction_id"),
            Column("op"),
            Function(
                "sum",
                [Column("duration")],
                alias="duration",
            ),
        ],
        where=[
            Condition(Column("project_id"), Op.IN, [project.id for project in projects]),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("is_segment"), Op.EQ, 0),
        ]
        + (where or []),
        groupby=[Column("transaction_id"), Column("op")],
    )


def _get_segments(
    where: ConditionGroup | None,
    start: datetime,
    end: datetime,
    organization: Organization,
    projects: Sequence[Project],
) -> Sequence[Segment]:
    requests = []
    # TODO: the time bounds are the same across queries and this can lead to issues since the span can have a specific
    #  time which is within the supplied bounds but the transaction might have different time bounds, which will result
    #  in data not being returned in specific cases.
    #  E.g., say you are querying from 10:10 to 10:15 and you get a span with timestamp 10:15. The transaction of that
    #  span has a timestamp of 10:16, in that case, we won't be able to fetch that transaction since we will apply
    #  the [10:10, 10:15) filter. The solution to this problem is to perform the queries below without timebounds but
    #  this is not allowed by Snuba.
    for query in [
        _get_segments_aggregates_query(where, start, end, projects),
        _get_segments_spans_summaries_query(where, start, end, projects),
    ]:
        request = Request(
            dataset=Dataset.SpansIndexed.value,
            app_id="metrics",
            query=query,
            tenant_ids={"organization_id": organization.id},
        )
        requests.append(request)

    results = bulk_snuba_queries(
        requests, Referrer.API_ORGANIZATION_METRICS_METADATA_FETCH_SPANS.value, use_cache=True
    )
    if len(results) != 2:
        raise Exception("Error while fetching segments for the metric")

    # First, we build a reverse index on the span ops.
    segment_ops: dict[str, list[tuple[str, int]]] = {}
    for row in results[1]["data"]:
        segment_ops.setdefault(row["transaction_id"], []).append((row["op"], row["duration"]))

    # Second, we build the segment objects to return.
    segments: list[Segment] = []
    for row in results[0]["data"]:
        spans_summary = [
            SpanSummary(span_op=op, total_duration=total_duration)
            for op, total_duration in segment_ops.get(row["transaction_id"], [])
        ]

        segment = Segment(
            project_id=row["project_id"],
            # For now, we still use the old transaction_id.
            segment_id=row["transaction_id"],
            segment_span_id=row["transaction_span_id"],
            trace_id=row["trace_id"],
            profile_id=row["profile_id"],
            segment_name=row["segment_name"],
            spans_number=row["spans_number"],
            # By default, we don't have metric summaries, since they can be optionally added only if the queried
            # metric is a custom metric.
            metric_summaries=[],
            # By default, we don't have span details, since they can be optionally added only if the queried metric
            # is a custom metric.
            spans_details=[],
            spans_summary=spans_summary,
            duration=row["segment_duration"],
            timestamp=row["any_timestamp"],
        )

        segments.append(segment)

    return segments


# Ordered list (by priority) of correlations sources that will be used to get the correlations of a specific metric.
CORRELATIONS_SOURCES = [
    MeasurementsCorrelationsSource,
    TransactionDurationCorrelationsSource,
    SpansDurationCorrelationsSource,
    MetricsSummariesCorrelationsSource,
]


def get_correlations_source(
    metric_mri: str, organization: Organization, projects: Sequence[Project]
) -> CorrelationsSource | None:
    """
    Finds the first spans source that supports the `metric_mri`.

    In case multiple sources would apply to a `metric_mri` the first one is chosen.
    """
    for correlation_clazz in CORRELATIONS_SOURCES:
        if correlation_clazz.supports(metric_mri):
            return correlation_clazz(organization=organization, projects=projects)  # type:ignore

    return None


def get_metric_correlations(
    metric_mri: str,
    query: str | None,
    start: datetime,
    end: datetime,
    min_value: float | None,
    max_value: float | None,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
) -> MetricCorrelations:
    """
    Returns the spans in which the metric with `metric_mri` was emitted.

    The metric can be emitted within a span with different tag values. These are uniquely stored in the
    metrics_summaries entity.
    """
    correlations_source = get_correlations_source(metric_mri, organization, projects)
    if not correlations_source:
        raise CorrelationsQueryExecutionError(
            f"The supplied metric {metric_mri} does not support fetching correlated spans"
        )

    try:
        segments = correlations_source.get_segments(
            metric_mri, query, start, end, min_value, max_value, environments
        )
        return MetricCorrelations(
            metric_mri=metric_mri,
            segments=segments,
        )
    except SnubaError as e:
        sentry_sdk.capture_exception(e)
        raise CorrelationsQueryExecutionError(
            f"A database error occurred while fetching correlations for {metric_mri}: {type(e).__name__}"
        )

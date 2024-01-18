from abc import ABC, abstractmethod
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Dict, List, Mapping, Optional, Sequence, Set, Tuple, cast

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

from sentry.exceptions import InvalidParams
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.metadata.utils import (
    add_environments_condition,
    get_snuba_conditions_from_query,
    transform_conditions_to_tags,
    transform_conditions_with,
)
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import (
    ParsedMRI,
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


class CorrelationsQueryExecutionError(Exception):
    pass


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
    segment_name: str
    profile_id: Optional[str]
    spans_number: int
    spans_details: Sequence[SpanDetail]
    spans_summary: Sequence[SpanSummary]
    duration: int
    timestamp: datetime

    def add_spans_details(self, spans_details: Sequence[SpanDetail]) -> "Segment":
        return replace(self, spans_details=spans_details)


@dataclass(frozen=True)
class MetricCorrelations:
    metric_mri: str
    segments: Sequence[Segment]

    def __hash__(self):
        # For the serializer we need to implement a hashing function that uniquely identifies a metric.
        return hash(self.metric_mri)


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
        query: Optional[str],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
        environments: Sequence[Environment],
    ) -> Sequence[Segment]:
        conditions = get_snuba_conditions_from_query(query)
        conditions = add_environments_condition(conditions, environments)

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
        conditions: Optional[ConditionGroup],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Sequence[Segment]:
        raise NotImplementedError


class MetricsSummariesCorrelationsSource(CorrelationsSource):
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
        Returns a set containing the ids of the spans in which `metric_mri` was emitted.

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
            groupby=[Column("span_id")],
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

    def _get_segments_spans(
        self,
        span_ids: Set[str],
        start: datetime,
        end: datetime,
    ) -> Mapping[str, Sequence[Tuple[str, int, datetime]]]:
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
        )

        request = Request(
            dataset=Dataset.SpansIndexed.value,
            app_id="metrics",
            query=query,
            tenant_ids={"organization_id": self.organization.id},
        )

        data = raw_snql_query(request, Referrer.API_DDM_FETCH_SPANS.value, use_cache=True)["data"]

        segments_spans: Dict[str, List[Tuple[str, int, datetime]]] = {}
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
        conditions: Optional[ConditionGroup],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Sequence[Segment]:
        transformed_conditions = transform_conditions_to_tags(conditions)

        # First, we fetch the spans we are interested in given the metric and the bounds.
        span_ids = self._get_span_ids_from_metrics_summaries(
            metric_mri=metric_mri,
            conditions=transformed_conditions,
            start=start,
            end=end,
            min_value=min_value,
            max_value=max_value,
        )

        # Second, we fetch all the segments which contain the span ids.
        segments_spans = self._get_segments_spans(
            span_ids=span_ids,
            start=start,
            end=end,
        )

        # Third, we fetch the segments details together with aggregates
        segments = _get_segments(
            where=[Condition(Column("transaction_id"), Op.IN, list(segments_spans.keys()))],
            start=start,
            end=end,
            organization=self.organization,
            projects=self.projects,
        )

        # Fourth, we merge span details with the fetched segments.
        extended_segments = []
        for segment in segments:
            segment_spans_details = [
                SpanDetail(span_id=span_id, span_duration=duration, span_timestamp=timestamp)
                for span_id, duration, timestamp in segments_spans.get(segment.segment_id, [])
            ]
            extended_segments.append(segment.add_spans_details(segment_spans_details))

        return extended_segments


class TransactionDurationCorrelationsSource(CorrelationsSource):
    @classmethod
    def supports(cls, metric_mri: str) -> bool:
        return metric_mri == TransactionMRI.DURATION.value

    def _get_segments(
        self,
        metric_mri: str,
        conditions: Optional[ConditionGroup],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Sequence[Segment]:
        where = []

        transformed_conditions = transform_conditions_to_tags(
            conditions=conditions, check_sentry_tags=True
        )
        transformed_conditions = transform_conditions_with(
            conditions=transformed_conditions, mappings=SENTRY_TAG_TO_COLUMN_NAME
        )
        if transformed_conditions:
            where += transformed_conditions

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
        conditions: Optional[ConditionGroup],
        start: datetime,
        end: datetime,
        min_value: Optional[float],
        max_value: Optional[float],
    ) -> Sequence[Segment]:
        where = []

        transformed_conditions = transform_conditions_to_tags(
            conditions=conditions, check_sentry_tags=True
        )
        transformed_conditions = transform_conditions_with(
            conditions=transformed_conditions, mappings=SENTRY_TAG_TO_COLUMN_NAME
        )
        if transformed_conditions:
            where += transformed_conditions

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


def _get_segments_aggregates_query(
    where: Optional[ConditionGroup],
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
            # Returns the duration of the transaction.
            Function(
                "sumIf",
                [Column("duration"), Function("equals", [Column("is_segment"), 1])],
                alias="duration",
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
        # For now, we order by descending duration.
        orderby=[OrderBy(Column("duration"), Direction.DESC)],
        limit=Limit(MAX_NUMBER_OF_RESULTS),
    )


def _get_segments_spans_summaries_query(
    where: Optional[ConditionGroup],
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
    where: Optional[ConditionGroup],
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

    results = bulk_snuba_queries(requests, Referrer.API_DDM_FETCH_SPANS.value, use_cache=True)
    if len(results) != 2:
        raise Exception("Error while fetching segments for the metric")

    # First, we build a reverse index on the span ops.
    segment_ops: Dict[str, List[Tuple[str, int]]] = {}
    for row in results[1]["data"]:
        segment_ops.setdefault(row["transaction_id"], []).append((row["op"], row["duration"]))

    # Second, we build the segment objects to return.
    segments: List[Segment] = []
    for row in results[0]["data"]:
        spans_summary = [
            SpanSummary(span_op=op, total_duration=total_duration)
            for op, total_duration in segment_ops.get(row["transaction_id"], [])
        ]

        segment = Segment(
            project_id=row["project_id"],
            # For now, we still use the old transaction_id.
            segment_id=row["transaction_id"],
            trace_id=row["trace_id"],
            profile_id=row["profile_id"],
            segment_name=row["segment_name"],
            spans_number=row["spans_number"],
            # By default, we don't have span details, since they can be optionally injected only if the queried metric
            # is a custom metric.
            spans_details=[],
            spans_summary=spans_summary,
            duration=row["duration"],
            timestamp=row["any_timestamp"],
        )

        segments.append(segment)

    return segments


# Ordered list (by priority) of correlations sources that will be used to get the correlations of a specific metric.
CORRELATIONS_SOURCES = [
    MeasurementsCorrelationsSource,
    TransactionDurationCorrelationsSource,
    MetricsSummariesCorrelationsSource,
]


def get_correlations_source(
    metric_mri: str, organization: Organization, projects: Sequence[Project]
) -> Optional[CorrelationsSource]:
    """
    Finds the first spans source that supports the `metric_mri`.

    In case multiple sources would apply to a `metric_mri` the first one is chosen.
    """
    for correlation_clazz in CORRELATIONS_SOURCES:
        if correlation_clazz.supports(metric_mri):
            return correlation_clazz(organization=organization, projects=projects)  # type:ignore

    return None


def get_correlations_of_metric(
    metric_mri: str,
    query: Optional[str],
    start: datetime,
    end: datetime,
    min_value: Optional[float],
    max_value: Optional[float],
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
        raise InvalidParams(
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

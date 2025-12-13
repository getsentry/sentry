import logging
from collections import defaultdict
from datetime import datetime
from typing import TypedDict

import sentry_sdk
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function as EAPFunction
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import StrArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)
from snuba_sdk import Column, Condition, Entity, Function, Limit, Op, Query, Request

from sentry.search.eap.occurrences.rollout_utils import should_double_read_from_eap, validate_read
from sentry.seer.workflows.compare import KeyedValueCount, keyed_rrf_score_with_filter
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


class Distribution(TypedDict):
    baseline: dict[str, float]
    outliers: dict[str, float]


class Score(TypedDict):
    flag: str
    score: float
    baseline_percent: float
    distribution: Distribution
    is_filtered: bool


@sentry_sdk.trace
def get_suspect_flag_scores(
    org_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    envs: list[str],
    group_id: int,
) -> list[Score]:
    """
    Queries the baseline and outliers sets. Computes the KL scores of each and returns a sorted
    list of key, score, baseline_percent tuples.
    """
    outliers = query_selection_set(org_id, project_id, start, end, envs, group_id=group_id)
    baseline = query_baseline_set(
        org_id, project_id, start, end, envs, flag_keys=[o[0] for o in outliers]
    )

    outliers_count = query_error_counts(org_id, project_id, start, end, envs, group_id=group_id)
    baseline_count = query_error_counts(org_id, project_id, start, end, envs, group_id=None)

    keyed_scores = keyed_rrf_score_with_filter(
        baseline,
        outliers,
        total_baseline=baseline_count,
        total_outliers=outliers_count,
    )

    baseline_percent_dict: defaultdict[str, float] = defaultdict(int)
    if baseline_count:
        for key, value, count in baseline:
            if value == "true":
                baseline_percent_dict[key] = count / baseline_count

    distributions: dict[str, Distribution] = defaultdict(lambda: {"baseline": {}, "outliers": {}})
    for key, value, count in baseline:
        distributions[key]["baseline"][value] = count
    for key, value, count in outliers:
        distributions[key]["outliers"][value] = count

    return [
        {
            "flag": key,
            "score": score,
            "baseline_percent": baseline_percent_dict[key],
            "distribution": distributions[key],
            "is_filtered": is_filtered,
        }
        for key, score, is_filtered in keyed_scores
    ]


@sentry_sdk.trace
def query_baseline_set(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    environments: list[str],
    flag_keys: list[str],
) -> list[KeyedValueCount]:
    """
    Query for the count of unique flag-key, flag-value pairings for a set of flag keys.

    SQL:
        SELECT arrayJoin(arrayZip(flags.key, flags.value)) as variants, count()
        FROM errors_dist
        WHERE (
            project_id = {project_id} AND
            timestamp >= {start} AND
            timestamp < {end} AND
            environment IN environments AND
            has({flag_keys}, tupleElement(variants, 1)) = 1
        )
        GROUP BY variants
    """
    where = []
    if environments:
        where.append(Condition(Column("environment"), Op.IN, environments))

    query = Query(
        match=Entity("events"),
        select=[
            Function(
                "arrayJoin",
                parameters=[
                    Function(
                        "arrayZip",
                        parameters=[
                            Column("flags.key"),
                            Column("flags.value"),
                        ],
                    ),
                ],
                alias="variants",
            ),
            Function("count", parameters=[], alias="count"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(
                Function(
                    "has",
                    parameters=[
                        flag_keys,
                        Function("tupleElement", parameters=[Column("variants"), 1]),
                    ],
                ),
                Op.EQ,
                1,
            ),
            *where,
        ],
        groupby=[Column("variants")],
        limit=Limit(1000),  # Arbitrary upper-bound.
    )

    snuba_request = Request(
        dataset="events",
        app_id="issues-backend-web",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )

    response = raw_snql_query(
        snuba_request,
        referrer="issues.suspect_flags.query_baseline_set",
        use_cache=True,
    )

    return [
        (result["variants"][0], result["variants"][1], result["count"])
        for result in response["data"]
    ]


@sentry_sdk.trace
def query_selection_set(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    environments: list[str],
    group_id: int,
) -> list[KeyedValueCount]:
    """
    Query for the count of unique flag-key, flag-value pairings for a given group_id.

    SQL:
        SELECT arrayJoin(arrayZip(flags.key, flags.value)) as variants, count()
        FROM errors_dist
        WHERE (
            project_id = {project_id} AND
            timestamp >= {start} AND
            timestamp < {end} AND
            environment IN environments AND
            group_id = {group_id}
        )
        GROUP BY variants
    """
    where = []
    if environments:
        where.append(Condition(Column("environment"), Op.IN, environments))

    query = Query(
        match=Entity("events"),
        select=[
            Function(
                "arrayJoin",
                parameters=[
                    Function(
                        "arrayZip",
                        parameters=[
                            Column("flags.key"),
                            Column("flags.value"),
                        ],
                    ),
                ],
                alias="variants",
            ),
            Function("count", parameters=[], alias="count"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("group_id"), Op.EQ, group_id),
            *where,
        ],
        groupby=[Column("variants")],
        limit=Limit(1000),  # Arbitrary upper-bound.
    )

    snuba_request = Request(
        dataset="events",
        app_id="issues-backend-web",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )

    response = raw_snql_query(
        snuba_request,
        referrer="issues.suspect_flags.query_selection_set",
        use_cache=True,
    )

    return [
        (result["variants"][0], result["variants"][1], result["count"])
        for result in response["data"]
    ]


def _query_error_counts_snuba(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    environments: list[str],
    group_id: int | None,
) -> int:
    """Snuba implementation of query_error_counts."""
    where = []
    if group_id is not None:
        where.append(Condition(Column("group_id"), Op.EQ, group_id))
    if environments:
        where.append(Condition(Column("environment"), Op.IN, environments))

    query = Query(
        match=Entity("events"),
        select=[
            Function("count", parameters=[], alias="count"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            *where,
        ],
        limit=Limit(1),
    )

    snuba_request = Request(
        dataset="events",
        app_id="issues-backend-web",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )

    response = raw_snql_query(
        snuba_request,
        referrer=Referrer.ISSUES_SUSPECT_FLAGS_QUERY_ERROR_COUNTS.value,
        use_cache=True,
    )

    return int(response["data"][0]["count"])


def _query_error_counts_eap(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    environments: list[str],
    group_id: int | None,
) -> int:
    """EAP implementation of query_error_counts."""
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)
    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)

    count_column = EAPColumn(
        aggregation=AttributeAggregation(
            aggregate=EAPFunction.FUNCTION_COUNT,
            key=AttributeKey(name="group_id", type=AttributeKey.TYPE_INT),
        ),
        label="count",
    )

    filters: list[TraceItemFilter] = []

    if group_id is not None:
        group_id_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="group_id", type=AttributeKey.TYPE_INT),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_int=group_id),
            )
        )
        filters.append(group_id_filter)

    if environments:
        environment_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="environment", type=AttributeKey.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=environments)),
            )
        )
        filters.append(environment_filter)

    item_filter = None
    if len(filters) == 1:
        item_filter = filters[0]
    elif len(filters) > 1:
        item_filter = TraceItemFilter(and_filter=AndFilter(filters=filters))

    request = TraceItemTableRequest(
        meta=RequestMeta(
            organization_id=organization_id,
            project_ids=[project_id],
            cogs_category="issues",
            referrer=Referrer.ISSUES_SUSPECT_FLAGS_QUERY_ERROR_COUNTS.value,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE,
        ),
        columns=[count_column],
        filter=item_filter,
        limit=1,
    )

    try:
        count = 0
        responses = snuba_rpc.table_rpc([request])
        if responses and responses[0].column_values:
            results = responses[0].column_values[0].results
            if results:
                count = int(results[0].val_double)
    except Exception:
        logger.exception(
            "Fetching error counts from EAP failed",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "group_id": group_id,
            },
        )
        count = 0

    return count


@sentry_sdk.trace
def query_error_counts(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    environments: list[str],
    group_id: int | None,
) -> int:
    """
    Query for the number of errors for a given project optionally associated with a group_id.

    SQL:
        SELECT count()
        FROM errors_dist
        WHERE (
            project_id = {project_id} AND
            timestamp >= {start} AND
            timestamp < {end} AND
            environment IN environments AND
            group_id = {group_id}
        )
    """
    snuba_count = _query_error_counts_snuba(
        organization_id, project_id, start, end, environments, group_id
    )

    if should_double_read_from_eap():
        eap_count = _query_error_counts_eap(
            organization_id, project_id, start, end, environments, group_id
        )
        validate_read(snuba_count, eap_count, "issues.suspect_flags.query_error_counts")

    return snuba_count

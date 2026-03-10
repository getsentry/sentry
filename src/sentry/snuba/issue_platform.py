import logging
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any

import sentry_sdk

from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.occurrences.query_utils import (
    keyed_counts_subset_match,
    normalize_eap_results_to_snuba_aliases,
    translate_issue_platform_column_from_eap,
    translate_issue_platform_column_to_eap,
    translate_issue_platform_orderby_to_eap,
)
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.issue_platform import IssuePlatformTimeseriesQueryBuilder
from sentry.search.events.types import EventsResponse, QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import transform_tips, zerofill
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.occurrences_rpc import OccurrenceCategory, Occurrences
from sentry.snuba.query_sources import QuerySource
from sentry.utils.snuba import SnubaTSResult, bulk_snuba_queries

logger = logging.getLogger(__name__)


def query(
    selected_columns,
    query,
    snuba_params,
    equations=None,
    orderby=None,
    offset=None,
    limit=50,
    auto_fields=False,
    auto_aggregations=False,
    include_equation_fields=False,
    allow_metric_aggregates=False,
    use_aggregate_conditions=False,
    conditions=None,
    functions_acl=None,
    transform_alias_to_input_format=False,
    sample=None,
    has_metrics=False,
    skip_tag_resolution=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type: MetricSpecType | None = None,
    fallback_to_transactions=False,
    query_source: QuerySource | None = None,
    *,
    referrer: str,
) -> EventsResponse:
    """
    High-level API for doing arbitrary user queries against events.

    This function operates on the Discover public event schema and
    virtual fields/aggregate functions for selected columns and
    conditions are supported through this function.

    The resulting list will have all internal field names mapped
    back into their public schema names.

    selected_columns (Sequence[str]) List of public aliases to fetch.
    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment
    equations (Sequence[str]) List of equations to calculate for the query
    orderby (None|str|Sequence[str]) The field to order results by.
    offset (None|int) The record offset to read.
    limit (int) The number of records to fetch.
    referrer (str|None) A referrer string to help locate the origin of this query.
    auto_fields (bool) Set to true to have project + eventid fields automatically added.
    auto_aggregations (bool) Whether aggregates should be added automatically if they're used
                    in conditions, and there's at least one aggregate already.
    include_equation_fields (bool) Whether fields should be added automatically if they're used in
                    equations
    allow_metric_aggregates (bool) Ignored here, only used in metric enhanced performance
    use_aggregate_conditions (bool) Set to true if aggregates conditions should be used at all.
    conditions (Sequence[Condition]) List of conditions that are passed directly to snuba without
                    any additional processing.
    transform_alias_to_input_format (bool) Whether aggregate columns should be returned in the originally
                                requested function format.
    sample (float) The sample rate to run the query with
    """
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = DiscoverQueryBuilder(
        Dataset.IssuePlatform,
        {},
        snuba_params=snuba_params,
        query=query,
        selected_columns=selected_columns,
        equations=equations,
        orderby=orderby,
        limit=limit,
        offset=offset,
        sample_rate=sample,
        config=QueryBuilderConfig(
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            functions_acl=functions_acl,
            equation_config={"auto_add": include_equation_fields},
            has_metrics=has_metrics,
            transform_alias_to_input_format=transform_alias_to_input_format,
            skip_tag_resolution=skip_tag_resolution,
        ),
    )
    if conditions is not None:
        builder.add_conditions(conditions)
    result = builder.process_results(builder.run_query(referrer, query_source=query_source))

    callsite = "snuba.issue_platform.query"
    snuba_data = result.get("data", [])
    if EAPOccurrencesComparator.should_check_experiment(callsite):
        eap_data: list[dict[str, object]] = []
        try:
            translated_columns = [
                translate_issue_platform_column_to_eap(column) for column in selected_columns
            ]
            translated_orderby = translate_issue_platform_orderby_to_eap(orderby)
            eap_result = Occurrences.run_table_query(
                params=snuba_params,
                query_string=query,
                selected_columns=translated_columns,
                equations=equations,
                orderby=translated_orderby,
                offset=offset or 0,
                limit=limit,
                referrer=referrer,
                config=SearchResolverConfig(),
                occurrence_category=OccurrenceCategory.GENERIC,
            )
            eap_data = normalize_eap_results_to_snuba_aliases(
                [
                    {
                        translate_issue_platform_column_from_eap(key): value
                        for key, value in row.items()
                    }
                    for row in eap_result.get("data", [])
                ]
            )
        except Exception:
            eap_data = []

        result["data"] = EAPOccurrencesComparator.check_and_choose(
            snuba_data,
            eap_data,
            callsite,
            is_experimental_data_a_null_result=len(eap_data) == 0,
            reasonable_match_comparator=_table_subset_match,
            debug_context={
                "referrer": referrer,
                "selected_columns": list(selected_columns),
                "equations": equations,
                "query": query,
                "orderby": orderby,
                "offset": offset,
                "limit": limit,
                "project_ids": [project.id for project in snuba_params.projects],
                "organization_id": (
                    snuba_params.organization.id if snuba_params.organization is not None else None
                ),
                "start": snuba_params.start.isoformat() if snuba_params.start else None,
                "end": snuba_params.end.isoformat() if snuba_params.end else None,
            },
        )

    if snuba_params.debug:
        result["meta"]["debug_info"] = {"query": str(builder.get_snql_query().query)}
    result["meta"]["tips"] = transform_tips(builder.tips)
    return result


def timeseries_query(
    selected_columns: Sequence[str],
    query: str,
    snuba_params: SnubaParams,
    rollup: int,
    zerofill_results: bool = True,
    comparison_delta: timedelta | None = None,
    functions_acl: list[str] | None = None,
    allow_metric_aggregates=False,
    has_metrics=False,
    on_demand_metrics_enabled=False,
    on_demand_metrics_type: MetricSpecType | None = None,
    query_source: QuerySource | None = None,
    fallback_to_transactions: bool = False,
    transform_alias_to_input_format: bool = False,
    *,
    referrer: str,
):
    """
    High-level API for doing arbitrary user timeseries queries against events.

    This function operates on the public event schema and
    virtual fields/aggregate functions for selected columns and
    conditions are supported through this function.

    This function is intended to only get timeseries based
    results and thus requires the `rollup` parameter.

    Returns a SnubaTSResult object that has been zerofilled in
    case of gaps.

    selected_columns (Sequence[str]) List of public aliases to fetch.
    query (str) Filter query string to create conditions from.
    params (Dict[str, str]) Filtering parameters with start, end, project_id, environment,
    rollup (int) The bucket width in seconds
    referrer (str|None) A referrer string to help locate the origin of this query.
    comparison_delta: A timedelta used to convert this into a comparison query. We make a second
    query time-shifted back by comparison_delta, and compare the results to get the % change for each
    time bucket. Requires that we only pass
    allow_metric_aggregates (bool) Ignored here, only used in metric enhanced performance
    """

    with sentry_sdk.start_span(op="issueplatform", name="timeseries.filter_transform"):
        equations, columns = categorize_columns(selected_columns)
        base_builder = IssuePlatformTimeseriesQueryBuilder(
            Dataset.IssuePlatform,
            {},
            rollup,
            snuba_params=snuba_params,
            query=query,
            selected_columns=columns,
            equations=equations,
            config=QueryBuilderConfig(
                functions_acl=functions_acl,
                has_metrics=has_metrics,
                transform_alias_to_input_format=transform_alias_to_input_format,
            ),
        )
        query_list = [base_builder]
        if comparison_delta:
            if len(base_builder.aggregates) != 1:
                raise InvalidSearchQuery("Only one column can be selected for comparison queries")
            comp_query_params = snuba_params.copy()
            assert comp_query_params.start is not None
            assert comp_query_params.end is not None
            comp_query_params.start -= comparison_delta
            comp_query_params.end -= comparison_delta
            comparison_builder = IssuePlatformTimeseriesQueryBuilder(
                Dataset.IssuePlatform,
                {},
                rollup,
                snuba_params=comp_query_params,
                query=query,
                selected_columns=columns,
                equations=equations,
            )
            query_list.append(comparison_builder)

        query_results = bulk_snuba_queries(
            [query.get_snql_query() for query in query_list], referrer, query_source=query_source
        )

    with sentry_sdk.start_span(op="issueplatform", name="timeseries.transform_results"):
        results = []
        for snql_query, result in zip(query_list, query_results):
            assert snql_query.params.start is not None
            assert snql_query.params.end is not None
            results.append(
                {
                    "data": (
                        zerofill(
                            result["data"],
                            snql_query.params.start,
                            snql_query.params.end,
                            rollup,
                            ["time"],
                        )
                        if zerofill_results
                        else result["data"]
                    ),
                    "meta": result["meta"],
                }
            )

    if len(results) == 2 and comparison_delta:
        col_name = base_builder.aggregates[0].alias
        # If we have two sets of results then we're doing a comparison queries. Divide the primary
        # results by the comparison results.
        for ret_result, cmp_result in zip(results[0]["data"], results[1]["data"]):
            cmp_result_val = cmp_result.get(col_name, 0)
            ret_result["comparisonCount"] = cmp_result_val

    result = base_builder.process_results(results[0])

    callsite = "snuba.issue_platform.timeseries_query"
    control_data = result.get("data", [])
    # TODO: EAP RPC doesn't support equations - need to investigate this
    if EAPOccurrencesComparator.should_check_experiment(callsite):
        eap_data: list[dict[str, Any]] = []
        try:
            eap_data = _run_eap_timeseries(
                snuba_params=snuba_params,
                query_string=query,
                y_axes=list(columns),
                referrer=referrer,
                rollup=rollup,
                zerofill_results=zerofill_results,
                comparison_delta=comparison_delta,
            )
        except Exception:
            eap_data = []

        result["data"] = EAPOccurrencesComparator.check_and_choose(
            control_data,
            eap_data,
            callsite,
            is_experimental_data_a_null_result=len(eap_data) == 0,
            reasonable_match_comparator=_timeseries_subset_match,
            debug_context={
                "referrer": referrer,
                "selected_columns": list(selected_columns),
                "query": query,
                "rollup": rollup,
                "comparison_delta": str(comparison_delta) if comparison_delta else None,
                "zerofill_results": zerofill_results,
                "project_ids": [project.id for project in snuba_params.projects],
                "organization_id": (
                    snuba_params.organization.id if snuba_params.organization is not None else None
                ),
                "start": snuba_params.start.isoformat() if snuba_params.start else None,
                "end": snuba_params.end.isoformat() if snuba_params.end else None,
            },
        )

    return SnubaTSResult(
        {
            "data": result["data"],
            "meta": result["meta"],
        },
        snuba_params.start_date,
        snuba_params.end_date,
        rollup,
    )


def _table_subset_match(
    control_rows: Sequence[Mapping[str, Any]],
    experimental_rows: Sequence[Mapping[str, Any]],
) -> bool:
    if not experimental_rows:
        return True

    # Event-like rows: experimental event IDs must be a subset of control IDs
    if all(row.get("id") is not None for row in experimental_rows):
        control_ids = {row["id"] for row in control_rows if "id" in row}
        return {row["id"] for row in experimental_rows}.issubset(control_ids)

    # Aggregated rows with count(): enforce experimental_count <= control_count per group key.
    # After normalization, both control and EAP use the Snuba alias "count" (not "count()").
    count_alias = "count"
    if all(count_alias in row for row in experimental_rows):
        return keyed_counts_subset_match(
            control_rows,
            experimental_rows,
            key_fn=lambda row: tuple(
                sorted((k, str(v)) for k, v in row.items() if k != count_alias)
            ),
            count_field=count_alias,
        )

    # Fallback: verify experimental didn't return more rows than control
    return len(experimental_rows) <= len(control_rows)


def _timeseries_subset_match(
    control_data: list[dict[str, Any]],
    experimental_data: list[dict[str, Any]],
) -> bool:
    if not experimental_data:
        return True

    control_by_time: dict[int, dict[str, Any]] = {}
    for row in control_data:
        time_val = row.get("time")
        if time_val is not None:
            control_by_time[int(time_val)] = row

    for row in experimental_data:
        time_val = row.get("time")
        if time_val is None:
            continue
        control_row = control_by_time.get(int(time_val))
        if control_row is None:
            return False
        for key, eap_val in row.items():
            if key == "time":
                continue
            if not isinstance(eap_val, (int, float)):
                continue
            control_val = control_row.get(key)
            if control_val is None:
                return False
            if eap_val > control_val:
                return False

    return True


def _run_eap_timeseries(
    snuba_params: SnubaParams,
    query_string: str,
    y_axes: list[str],
    referrer: str,
    rollup: int,
    zerofill_results: bool,
    comparison_delta: timedelta | None = None,
) -> list[dict[str, Any]]:
    eap_rows = Occurrences.run_grouped_timeseries_query(
        params=snuba_params,
        query_string=query_string,
        y_axes=y_axes,
        groupby=[],
        referrer=referrer,
        config=SearchResolverConfig(),
        occurrence_category=OccurrenceCategory.GENERIC,
    )

    # EAP returns time as epoch seconds; zerofill expects and outputs epoch seconds too,
    # so no conversion needed — just apply zerofill for bucket parity.
    if zerofill_results and snuba_params.start and snuba_params.end:
        eap_rows = zerofill(
            eap_rows,
            snuba_params.start,
            snuba_params.end,
            rollup,
            ["time"],
        )

    if comparison_delta and len(y_axes) == 1:
        comp_params = snuba_params.copy()
        assert comp_params.start is not None
        assert comp_params.end is not None
        comp_params.start -= comparison_delta
        comp_params.end -= comparison_delta
        comp_rows = Occurrences.run_grouped_timeseries_query(
            params=comp_params,
            query_string=query_string,
            y_axes=y_axes,
            groupby=[],
            referrer=referrer,
            config=SearchResolverConfig(),
            occurrence_category=OccurrenceCategory.GENERIC,
        )
        if zerofill_results:
            comp_rows = zerofill(
                comp_rows,
                comp_params.start,
                comp_params.end,
                rollup,
                ["time"],
            )
        # Align positionally, matching the control path's zip-based approach.
        col_name = y_axes[0]
        for base_row, comp_row in zip(eap_rows, comp_rows):
            base_row["comparisonCount"] = comp_row.get(col_name, 0)
        # Handle any remaining base rows without a comparison counterpart.
        for row in eap_rows[len(comp_rows) :]:
            row["comparisonCount"] = 0

    return normalize_eap_results_to_snuba_aliases(eap_rows)

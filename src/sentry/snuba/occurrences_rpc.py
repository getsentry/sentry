import logging
from datetime import timedelta
from typing import Any

import sentry_sdk
from sentry_protos.snuba.v1.request_common_pb2 import PageToken

from sentry.search.eap.columns import ColumnDefinitions, ResolvedAttribute
from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.sampling import events_meta_from_rpc_request_meta
from sentry.search.eap.types import AdditionalQueries, EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, EventsMeta, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.snuba.discover import zerofill
from sentry.utils.snuba import SnubaTSResult, process_value

logger = logging.getLogger(__name__)


class Occurrences(rpc_dataset_common.RPCBase):
    DEFINITIONS = OCCURRENCE_DEFINITIONS

    @classmethod
    @sentry_sdk.trace
    def run_table_query(
        cls,
        *,
        params: SnubaParams,
        query_string: str,
        selected_columns: list[str],
        orderby: list[str] | None,
        offset: int,
        limit: int,
        referrer: str,
        config: SearchResolverConfig,
        sampling_mode: SAMPLING_MODES | None = None,
        equations: list[str] | None = None,
        search_resolver: SearchResolver | None = None,
        page_token: PageToken | None = None,
        additional_queries: AdditionalQueries | None = None,
    ) -> EAPResponse:
        return cls._run_table_query(
            rpc_dataset_common.TableQuery(
                query_string=query_string,
                selected_columns=selected_columns,
                equations=equations,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer=referrer,
                sampling_mode=sampling_mode,
                resolver=search_resolver or cls.get_resolver(params, config),
                page_token=page_token,
                additional_queries=additional_queries,
            ),
            params.debug,
        )

    @classmethod
    @sentry_sdk.trace
    def run_table_query_with_tags(
        cls,
        tag_names: set[str],
        *,
        params: SnubaParams,
        query_string: str,
        selected_columns: list[str],
        orderby: list[str] | None,
        offset: int,
        limit: int,
        referrer: str,
        config: SearchResolverConfig,
        sampling_mode: SAMPLING_MODES | None = None,
        equations: list[str] | None = None,
        page_token: PageToken | None = None,
        additional_queries: AdditionalQueries | None = None,
    ) -> EAPResponse:
        """
        Runs a query with additional selected_columns of all tags in tags.
        tags should be formatted appropriately - e.g. {tags[foo], tags[bar]}
        """

        columns = cls.DEFINITIONS.columns.copy()
        for tag_name in tag_names:
            columns[tag_name] = ResolvedAttribute(
                public_alias=tag_name,
                internal_name=tag_name,
                search_type="string",
            )

        definitions = ColumnDefinitions(
            aggregates=cls.DEFINITIONS.aggregates,
            formulas=cls.DEFINITIONS.formulas,
            columns=columns,
            contexts=cls.DEFINITIONS.contexts,
            trace_item_type=cls.DEFINITIONS.trace_item_type,
            filter_aliases=cls.DEFINITIONS.filter_aliases,
            alias_to_column=cls.DEFINITIONS.alias_to_column,
            column_to_alias=cls.DEFINITIONS.column_to_alias,
        )

        return cls._run_table_query(
            rpc_dataset_common.TableQuery(
                query_string=query_string,
                selected_columns=selected_columns,
                equations=equations,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer=referrer,
                sampling_mode=sampling_mode,
                resolver=SearchResolver(params=params, config=config, definitions=definitions),
                page_token=page_token,
                additional_queries=additional_queries,
            ),
            params.debug,
        )

    @classmethod
    @sentry_sdk.trace
    def run_timeseries_query(
        cls,
        *,
        params: SnubaParams,
        query_string: str,
        y_axes: list[str],
        referrer: str,
        config: SearchResolverConfig,
        sampling_mode: SAMPLING_MODES | None,
        comparison_delta: timedelta | None = None,
        additional_queries: AdditionalQueries | None = None,
    ) -> SnubaTSResult:
        """Run a simple timeseries query (no groupby)."""
        cls.validate_granularity(params)
        search_resolver = cls.get_resolver(params, config)
        rpc_request, aggregates, groupbys = cls.get_timeseries_query(
            search_resolver=search_resolver,
            params=params,
            query_string=query_string,
            y_axes=y_axes,
            groupby=[],
            referrer=referrer,
            sampling_mode=sampling_mode,
            additional_queries=additional_queries,
        )

        """Run the query"""
        rpc_response = cls._run_timeseries_rpc(params.debug, rpc_request)

        """Process the results"""
        result = rpc_dataset_common.ProcessedTimeseries()
        final_meta: EventsMeta = events_meta_from_rpc_request_meta(rpc_response.meta)
        for resolved_field in aggregates + groupbys:
            final_meta["fields"][resolved_field.public_alias] = resolved_field.search_type

        for timeseries in rpc_response.result_timeseries:
            processed = cls.process_timeseries_list([timeseries])
            if len(result.timeseries) == 0:
                result = processed
            else:
                for attr in ["timeseries", "confidence", "sample_count", "sampling_rate"]:
                    for existing, new in zip(getattr(result, attr), getattr(processed, attr)):
                        existing.update(new)
        if len(result.timeseries) == 0:
            # The rpc only zerofills for us when there are results, if there aren't any we have to do it ourselves
            result.timeseries = zerofill(
                [],
                params.start_date,
                params.end_date,
                params.timeseries_granularity_secs,
                ["time"],
            )

        return SnubaTSResult(
            {"data": result.timeseries, "processed_timeseries": result, "meta": final_meta},
            params.start,
            params.end,
            params.granularity_secs,
        )

    @classmethod
    @sentry_sdk.trace
    def run_grouped_timeseries_query(
        cls,
        *,
        params: SnubaParams,
        query_string: str,
        y_axes: list[str],
        groupby: list[str],
        referrer: str,
        config: SearchResolverConfig,
        sampling_mode: SAMPLING_MODES | None = None,
    ) -> list[dict[str, Any]]:
        """
        Run a timeseries query grouped by the specified columns.

        Returns a flat list of dicts, each containing:
        - The groupby column values (using public aliases)
        - 'time': The bucket timestamp (as epoch seconds)
        - The y_axes aggregate values for that bucket

        This is similar to run_top_events_timeseries_query but without the
        "top N" filtering - it returns all groups matching the query.

        Example:
            result = Occurrences.run_grouped_timeseries_query(
                params=snuba_params,
                query_string="group_id:123 OR group_id:456",
                y_axes=["count()"],
                groupby=["project_id", "group_id"],
                referrer="my_referrer",
                config=SearchResolverConfig(),
            )
            # Returns:
            # [
            #     {"project_id": 1, "group_id": 123, "time": 1734220800, "count()": 5},
            #     {"project_id": 1, "group_id": 123, "time": 1734224400, "count()": 3},
            #     {"project_id": 1, "group_id": 456, "time": 1734220800, "count()": 10},
            #     ...
            # ]
        """
        cls.validate_granularity(params)
        search_resolver = cls.get_resolver(params, config)

        # Build and run the timeseries query with groupby
        rpc_request, _aggregates, groupbys_resolved = cls.get_timeseries_query(
            search_resolver=search_resolver,
            params=params,
            query_string=query_string,
            y_axes=y_axes,
            groupby=groupby,
            referrer=referrer,
            sampling_mode=sampling_mode,
        )

        rpc_response = cls._run_timeseries_rpc(params.debug, rpc_request)

        # Build a mapping from internal names to public aliases for groupby columns
        groupby_internal_to_public: dict[str, str] = {
            col.internal_name: col.public_alias for col in groupbys_resolved
        }

        # Process results into flat list format
        results: list[dict[str, Any]] = []

        for timeseries in rpc_response.result_timeseries:
            # Extract groupby values using public aliases
            groupby_values: dict[str, Any] = {}
            for internal_name, value in timeseries.group_by_attributes.items():
                public_alias = groupby_internal_to_public.get(internal_name)
                if public_alias:
                    # Process the value (handle type conversions)
                    groupby_values[public_alias] = process_value(value)

            # Convert each bucket to a flat row
            for i, bucket in enumerate(timeseries.buckets):
                row: dict[str, Any] = {
                    **groupby_values,
                    "time": bucket.seconds,
                }

                # Add aggregate values
                if i < len(timeseries.data_points):
                    data_point = timeseries.data_points[i]
                    row[timeseries.label] = process_value(data_point.data)
                else:
                    row[timeseries.label] = 0

                results.append(row)

        return results

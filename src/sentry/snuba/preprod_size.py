import logging
from datetime import timedelta

import sentry_sdk
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.search.eap.preprod_size.definitions import PREPROD_SIZE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.sampling import events_meta_from_rpc_request_meta
from sentry.search.eap.types import AdditionalQueries, EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, EventsMeta, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.snuba.discover import zerofill
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger("sentry.snuba.preprod_size")


class PreprodSize(rpc_dataset_common.RPCBase):
    """
    Dataset for preprod app size metrics.

    This dataset automatically filters to sub_item_type="size_metric" to only include
    size metric data. Future datasets like PreprodSnapshots will follow the same pattern
    with different sub_item_type values.
    """

    DEFINITIONS = PREPROD_SIZE_DEFINITIONS

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
        debug: bool = False,
        additional_queries: AdditionalQueries | None = None,
    ) -> EAPResponse:
        return cls._run_table_query(
            rpc_dataset_common.TableQuery(
                query_string=query_string,
                selected_columns=selected_columns,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer=referrer,
                sampling_mode=sampling_mode,
                resolver=search_resolver or cls.get_resolver(params=params, config=config),
                page_token=page_token,
                additional_queries=additional_queries,
                extra_conditions=cls._get_sub_item_type_filter(),
            ),
            debug=debug,
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
        cls.validate_granularity(params)
        search_resolver = cls.get_resolver(params, config)
        sub_item_type_filter = cls._get_sub_item_type_filter()

        rpc_request, aggregates, groupbys = cls.get_timeseries_query(
            search_resolver=search_resolver,
            params=params,
            query_string=query_string,
            y_axes=y_axes,
            groupby=[],
            referrer=referrer,
            sampling_mode=sampling_mode,
            extra_conditions=sub_item_type_filter,
            additional_queries=additional_queries,
        )

        rpc_response = cls._run_timeseries_rpc(params.debug, rpc_request)
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
            # The RPC only zerofills for us when there are results; if there aren't any we have to do it ourselves
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
    def _get_sub_item_type_filter(cls) -> TraceItemFilter:
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sub_item_type", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="size_metric"),
            )
        )

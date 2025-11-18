import logging
from datetime import timedelta

import sentry_sdk
from sentry_protos.snuba.v1.request_common_pb2 import PageToken

from sentry.search.eap import constants
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.sampling import events_meta_from_rpc_request_meta
from sentry.search.eap.types import AdditionalQueries, EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, EventsMeta, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.snuba.discover import zerofill
from sentry.utils import snuba_rpc
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger("sentry.snuba.ourlogs")


class OurLogs(rpc_dataset_common.RPCBase):
    DEFINITIONS = OURLOG_DEFINITIONS

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
        """timestamp_precise is always displayed in the UI in lieu of timestamp but since the TraceItem table isn't a DateTime64
        so we need to always order by it regardless of what is actually passed to the orderby.
        Additionally, to ensure a strict order in the flex time sampling mode, we also order
        by the item id."""
        if (
            orderby is not None
            and len(orderby) == 1
            and orderby[0].lstrip("-") == constants.TIMESTAMP_ALIAS
        ):
            direction = "-" if orderby[0][0] == "-" else ""
            orderby.append(direction + constants.TIMESTAMP_PRECISE_ALIAS)
            if constants.TIMESTAMP_PRECISE_ALIAS not in selected_columns:
                selected_columns.append(constants.TIMESTAMP_PRECISE_ALIAS)

            # When using highest accuracy flex time sampling, we make sure we sort by
            # the item id as well to ensure we have a strict ordering.
            if sampling_mode == "HIGHEST_ACCURACY_FLEX_TIME":
                orderby.append(direction + "id")
                if "id" not in selected_columns:
                    selected_columns.append("id")

        return cls._run_table_query(
            rpc_dataset_common.TableQuery(
                query_string=query_string,
                selected_columns=selected_columns,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer=referrer,
                sampling_mode=sampling_mode,
                resolver=search_resolver
                or cls.get_resolver(
                    params=params,
                    config=config,
                ),
                page_token=page_token,
                additional_queries=additional_queries,
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
    ) -> SnubaTSResult:
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
        )

        """Run the query"""
        rpc_response = snuba_rpc.timeseries_rpc([rpc_request])[0]

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

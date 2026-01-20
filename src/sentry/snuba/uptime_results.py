import logging
from datetime import timedelta
from typing import Any

import sentry_sdk
from sentry_protos.snuba.v1.request_common_pb2 import PageToken

from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import AdditionalQueries, EAPResponse, SearchResolverConfig
from sentry.search.eap.uptime_results.definitions import UPTIME_RESULT_DEFINITIONS
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger("sentry.snuba.uptime_results")


class UptimeResults(rpc_dataset_common.RPCBase):
    DEFINITIONS = UPTIME_RESULT_DEFINITIONS

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
                equations=equations,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer=referrer,
                sampling_mode=sampling_mode,
                resolver=search_resolver or cls.get_resolver(params, config),
                page_token=page_token,
            ),
            debug,
        )

    @classmethod
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
        """Wasn't implemented before a refactor to move the timeseries code into RPCBase, but can just delete this
        function entirely if we want timeseries"""
        raise NotImplementedError()

    @classmethod
    @sentry_sdk.trace
    def run_top_events_timeseries_query(
        cls,
        *,
        params: SnubaParams,
        query_string: str,
        y_axes: list[str],
        raw_groupby: list[str],
        orderby: list[str] | None,
        limit: int,
        include_other: bool,
        referrer: str,
        config: SearchResolverConfig,
        sampling_mode: SAMPLING_MODES | None,
        equations: list[str] | None = None,
        additional_queries: AdditionalQueries | None = None,
    ) -> Any:
        """Since run_timeseries_query isn't implemented, this is also being marked as not implemented, should be able to
        just delete this if top_events are wanted on this dataset"""
        raise NotImplementedError()

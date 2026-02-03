import logging

import sentry_sdk
from sentry_protos.snuba.v1.request_common_pb2 import PageToken

from sentry.api.serializers.models.project import get_has_trace_metrics
from sentry.models.project import Project
from sentry.search.eap import constants
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.types import AdditionalQueries, EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba import rpc_dataset_common

logger = logging.getLogger("sentry.snuba.trace_metrics")


class TraceMetrics(rpc_dataset_common.RPCBase):

    DEFINITIONS = TRACE_METRICS_DEFINITIONS

    @classmethod
    def filter_project(cls, project: Project) -> bool:
        return get_has_trace_metrics(project)

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
        """timestamp_precise is always displayed in the UI in lieu of timestamp but since the TraceItem table isn't a DateTime64
        so we need to always order by it regardless of what is actually passed to the orderby."""
        if (
            orderby is not None
            and len(orderby) == 1
            and orderby[0].lstrip("-") == constants.TIMESTAMP_ALIAS
        ):
            direction = "-" if orderby[0][0] == "-" else ""
            orderby.append(direction + constants.TIMESTAMP_PRECISE_ALIAS)
            if constants.TIMESTAMP_PRECISE_ALIAS not in selected_columns:
                selected_columns.append(constants.TIMESTAMP_PRECISE_ALIAS)

        search_resolver = search_resolver or cls.get_resolver(params=params, config=config)

        return cls._run_table_query(
            rpc_dataset_common.TableQuery(
                query_string=query_string,
                selected_columns=selected_columns,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer=referrer,
                sampling_mode=sampling_mode,
                resolver=search_resolver,
                page_token=page_token,
                additional_queries=additional_queries,
            ),
            debug=params.debug,
        )

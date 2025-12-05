import logging

import sentry_sdk
from sentry_protos.snuba.v1.request_common_pb2 import PageToken

from sentry.search.eap.replays.definitions import REPLAY_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import AdditionalQueries, EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba import rpc_dataset_common

logger = logging.getLogger(__name__)


class Replays(rpc_dataset_common.RPCBase):
    DEFINITIONS = REPLAY_DEFINITIONS

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
                page_token=page_token,
                resolver=search_resolver or cls.get_resolver(params, config),
                additional_queries=additional_queries,
            ),
            params.debug,
        )

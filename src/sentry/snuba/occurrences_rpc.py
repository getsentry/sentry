import logging

import sentry_sdk
from sentry_protos.snuba.v1.request_common_pb2 import PageToken

from sentry.search.eap.columns import ColumnDefinitions, ResolvedAttribute
from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import AdditionalQueries, EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba import rpc_dataset_common

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

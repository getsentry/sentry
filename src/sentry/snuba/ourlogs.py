import logging

from sentry_protos.snuba.v1.request_common_pb2 import PageToken

from sentry.api.serializers.models.project import get_has_logs
from sentry.models.project import Project
from sentry.search.eap import constants
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import AdditionalQueries, EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.utils.tracing import trace

logger = logging.getLogger("sentry.snuba.ourlogs")


def _leading_timestamp_direction(orderby: list[str] | None) -> str | None:
    """Returns the sort direction ('' or '-') when the orderby leads with a timestamp column,
    otherwise None. Only a leading timestamp sort earns the precise-timestamp/id tiebreakers;
    other sorts are left untouched."""
    if not orderby:
        return None
    leading = orderby[0]
    if leading.lstrip("-") in (constants.TIMESTAMP_ALIAS, constants.TIMESTAMP_PRECISE_ALIAS):
        return "-" if leading.startswith("-") else ""
    return None


class OurLogs(rpc_dataset_common.RPCBase):
    DEFINITIONS = OURLOG_DEFINITIONS

    @classmethod
    def filter_project(cls, project: Project) -> bool:
        return get_has_logs(project)

    @classmethod
    @trace
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
        max_string_length: int | None = None,
    ) -> EAPResponse:
        """The TraceItem table stores logs with a coarse `timestamp` (not a DateTime64, so no
        sub-millisecond precision), which makes ordering by `timestamp` alone ambiguous for logs
        sharing a millisecond. Whenever a timestamp sort leads the orderby we resolve ties on the
        nanosecond `timestamp_precise`, then on the item `id`, giving a strict total order that is
        stable across pages in every sampling mode."""
        direction = _leading_timestamp_direction(orderby)
        if orderby is not None and direction is not None:
            ordered_aliases = {column.lstrip("-") for column in orderby}
            for tiebreaker in (constants.TIMESTAMP_PRECISE_ALIAS, "id"):
                if tiebreaker not in ordered_aliases:
                    orderby.append(direction + tiebreaker)
                    if tiebreaker not in selected_columns:
                        selected_columns.append(tiebreaker)

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
                max_string_length=max_string_length,
            ),
            debug=params.debug,
        )

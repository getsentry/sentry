from typing import int
from snuba_sdk import Query

from sentry.replays.lib.eap.snuba_transpiler import (
    QueryResult,
    RequestMeta,
    Settings,
    VirtualColumn,
    as_eap_request,
    execute_query,
    translate_response,
)


def query(
    query: Query,
    settings: Settings,
    request_meta: RequestMeta,
    virtual_columns: list[VirtualColumn],
) -> QueryResult:
    """Query EAP returning a result in a simplified format."""
    return translate_response(
        query,
        settings,
        query_result=execute_query(
            request=as_eap_request(query, request_meta, settings, virtual_columns),
            referrer=request_meta["referrer"],
        ),
    )

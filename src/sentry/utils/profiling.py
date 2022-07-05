from typing import Any, Dict, Optional

from django.conf import settings
from django.http import StreamingHttpResponse
from parsimonious.exceptions import ParseError
from requests import Response

from sentry.api.event_search import SearchFilter, parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.http import safe_urlopen


def get_from_profiling_service(
    method: str,
    path: str,
    params: Optional[Dict[Any, Any]] = None,
    headers: Optional[Dict[Any, Any]] = None,
) -> Response:
    kwargs: Dict[str, Any] = {"method": method, "headers": {}, "stream": True}
    if params:
        kwargs["params"] = params
    if headers:
        kwargs["headers"].update(headers)
    return safe_urlopen(
        f"{settings.SENTRY_PROFILING_SERVICE_URL}{path}",
        **kwargs,
    )


def proxy_profiling_service(
    method: str,
    path: str,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> StreamingHttpResponse:
    profiling_response = get_from_profiling_service(method, path, params=params, headers=headers)

    def stream():
        yield from profiling_response.raw.stream(decode_content=False)

    response = StreamingHttpResponse(
        streaming_content=stream(),
        status=profiling_response.status_code,
        content_type=profiling_response.headers.get("Content_type", "application/json"),
    )

    for h in ["Content-Encoding", "Vary"]:
        if h in profiling_response.headers:
            response[h] = profiling_response.headers[h]

    return response


PROFILE_FILTERS = {
    "android_api_level",
    "device_classification",
    "device_locale",
    "device_manufacturer",
    "device_model",
    "device_os_build_number",
    "device_os_name",
    "device_os_version",
    "platform",
    "transaction_name",
    "version",
}


def parse_profile_filters(query: str) -> Dict[str, str]:
    try:
        parsed_terms = parse_search_query(query)
    except ParseError as e:
        raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")

    profile_filters: Dict[str, str] = {}

    for term in parsed_terms:
        if not isinstance(term, SearchFilter):
            raise InvalidSearchQuery("Invalid query: Unknown filter")
        if term.operator != "=":  # only support equality filters
            raise InvalidSearchQuery("Invalid query: Illegal operator")
        if term.key.name not in PROFILE_FILTERS:
            raise InvalidSearchQuery(f"Invalid query: {term.key.name} is not supported")
        if term.key.name in profile_filters and term.value.value != profile_filters[term.key.name]:
            raise InvalidSearchQuery(f"Invalid query: Multiple filters for {term.key.name}")
        profile_filters[term.key.name] = term.value.value

    return profile_filters

from typing import Any, Dict, List, Optional

import google.auth.transport.requests
import google.oauth2.id_token
from django.conf import settings
from django.http import HttpResponse
from parsimonious.exceptions import ParseError  # type: ignore
from requests import Response

from sentry.api.event_search import SearchFilter, parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.http import safe_urlopen


def get_from_profiling_service(
    method: str, path: str, params: Optional[Dict[Any, Any]] = None
) -> Response:
    kwargs: Dict[str, Any] = {"method": method}
    if params:
        kwargs["params"] = params
    if settings.ENVIRONMENT == "production":
        id_token = fetch_id_token_for_service(settings.SENTRY_PROFILING_SERVICE_URL)
        kwargs["headers"] = {"Authorization": f"Bearer {id_token}"}
    return safe_urlopen(
        f"{settings.SENTRY_PROFILING_SERVICE_URL}{path}",
        **kwargs,
    )


def proxy_profiling_service(
    method: str, path: str, params: Optional[Dict[Any, Any]] = None
) -> HttpResponse:
    profiling_response = get_from_profiling_service(method, path, params=params)
    response = HttpResponse(
        content=profiling_response.content, status=profiling_response.status_code
    )
    if "Content-Type" in profiling_response.headers:
        response["Content-Type"] = profiling_response.headers["Content-Type"]
    return response


def fetch_id_token_for_service(service_url: str) -> str:
    auth_req = google.auth.transport.requests.Request()
    return google.oauth2.id_token.fetch_id_token(auth_req, service_url)


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


def parse_profile_filters(query: str) -> Dict[str, List[str]]:
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

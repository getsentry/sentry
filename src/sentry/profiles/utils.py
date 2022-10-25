from datetime import datetime
from typing import Any, Dict, Optional
from urllib.parse import urlencode, urlparse

import brotli
import urllib3
from django.conf import settings
from django.http import HttpResponse
from parsimonious.exceptions import ParseError
from urllib3.response import HTTPResponse

from sentry.api.event_search import SearchFilter, parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.net.http import connection_from_url
from sentry.utils import json, metrics


class RetrySkipTimeout(urllib3.Retry):
    """
    urllib3 Retry class does not allow us to retry on read errors but to exclude
    read timeout. Retrying after a timeout adds useless load to Snuba.
    """

    def increment(  # type: ignore
        self, method=None, url=None, response=None, error=None, _pool=None, _stacktrace=None
    ):
        """
        Just rely on the parent class unless we have a read timeout. In that case,
        immediately give up. Except when we're inserting a profile to vroom which
        can timeout due to GCS where we want to retry.
        """
        if url:
            # The url is high cardinality because of the ids in it, so strip it
            # from the path before using it in the metric tags.
            path = urlparse(url).path
            parts = path.split("/")
            if len(parts) > 2:
                parts[2] = ":orgId"
            if len(parts) > 4:
                parts[4] = ":projId"
            if len(parts) > 6:
                parts[6] = ":uuid"
            path = "/".join(parts)
        else:
            path = None

        if path != "/profile" and error and isinstance(error, urllib3.exceptions.ReadTimeoutError):
            raise error.with_traceback(_stacktrace)

        metrics.incr("profiling.client.retry", tags={"method": method, "path": path})

        return super().increment(
            method=method,
            url=url,
            response=response,
            error=error,
            _pool=_pool,
            _stacktrace=_stacktrace,
        )


_profiling_pool = connection_from_url(
    settings.SENTRY_PROFILING_SERVICE_URL,
    retries=RetrySkipTimeout(
        total=3,
        status_forcelist={502},
        allowed_methods={"GET", "POST"},
    ),
    timeout=10,
    maxsize=10,
    headers={"Accept-Encoding": "br, gzip"},
)


def get_from_profiling_service(
    method: str,
    path: str,
    params: Optional[Dict[Any, Any]] = None,
    headers: Optional[Dict[Any, Any]] = None,
    json_data: Any = None,
) -> HTTPResponse:
    kwargs: Dict[str, Any] = {"headers": {}}
    if params:
        params = {
            key: value.isoformat() if isinstance(value, datetime) else value
            for key, value in params.items()
            # do not want to proxy the project_objects to the profiling service
            # this make the query param unnecessarily large
            if key != "project_objects"
        }
        path = f"{path}?{urlencode(params, doseq=True)}"
    if headers:
        kwargs["headers"].update(headers)
    if json_data:
        kwargs["headers"].update(
            {
                "Content-Encoding": "br",
                "Content-Type": "application/json",
            }
        )
        kwargs["body"] = brotli.compress(
            json.dumps(json_data).encode("utf-8"), quality=6, mode=brotli.MODE_TEXT
        )
    return _profiling_pool.urlopen(  # type: ignore
        method,
        path,
        **kwargs,
    )


def proxy_profiling_service(
    method: str,
    path: str,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> HttpResponse:
    profiling_response = get_from_profiling_service(method, path, params=params, headers=headers)
    return HttpResponse(
        content=profiling_response.data,
        status=profiling_response.status,
        content_type=profiling_response.headers.get("Content-Type", "application/json"),
    )


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

from collections.abc import Mapping, MutableMapping
from datetime import datetime
from types import TracebackType
from typing import Any, Self
from urllib.parse import urlencode, urlparse

import brotli
import sentry_sdk
import urllib3
from django.conf import settings
from django.http import HttpResponse as SentryResponse
from urllib3.connectionpool import ConnectionPool
from urllib3.response import HTTPResponse as VroomResponse

from sentry.grouping.enhancer import Enhancements, keep_profiling_rules
from sentry.net.http import connection_from_url
from sentry.utils import json, metrics
from sentry.utils.sdk import set_measurement

Profile = MutableMapping[str, Any]
CallTrees = Mapping[str, list[Any]]


class RetrySkipTimeout(urllib3.Retry):
    """
    urllib3 Retry class does not allow us to retry on read errors but to exclude
    read timeout. Retrying after a timeout adds useless load to Snuba.
    """

    def increment(
        self,
        method: str | None = None,
        url: str | None = None,
        response: urllib3.BaseHTTPResponse | None = None,
        error: Exception | None = None,
        _pool: ConnectionPool | None = None,
        _stacktrace: TracebackType | None = None,
    ) -> Self:
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
    settings.SENTRY_VROOM,
    retries=RetrySkipTimeout(
        total=3,
        status_forcelist={502},
        allowed_methods={"GET", "POST"},
    ),
    timeout=15,
    maxsize=10,
    headers={"Accept-Encoding": "br, gzip"},
)


def get_from_profiling_service(
    method: str,
    path: str,
    params: dict[Any, Any] | None = None,
    headers: dict[Any, Any] | None = None,
    json_data: Any = None,
) -> VroomResponse:
    kwargs: dict[str, Any] = {"headers": {}}
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
        with sentry_sdk.start_span(op="json.dumps"):
            data = json.dumps(json_data).encode("utf-8")
        set_measurement("payload.size", len(data), unit="byte")
        kwargs["body"] = brotli.compress(data, quality=6, mode=brotli.MODE_TEXT)
    return _profiling_pool.urlopen(
        method,
        path,
        **kwargs,
    )


def proxy_profiling_service(
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    json_data: Any = None,
) -> SentryResponse:
    profiling_response = get_from_profiling_service(
        method, path, params=params, headers=headers, json_data=json_data
    )
    return SentryResponse(
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


# This support applying a subset of stack trace rules to the profile (matchers and actions).
#
# Matchers allowed:
#
#     stack.abs_path
#     stack.module
#     stack.function
#     stack.package
#
# Actions allowed:
#
#     +app
#     -app
def apply_stack_trace_rules_to_profile(profile: Profile, rules_config: str) -> None:
    profiling_rules = keep_profiling_rules(rules_config)
    if profiling_rules == "":
        return
    enhancements = Enhancements.from_config_string(profiling_rules)
    if "version" in profile:
        enhancements.apply_category_and_updated_in_app_to_frames(
            profile["profile"]["frames"], profile["platform"], {}
        )
    elif profile["platform"] == "android":
        # Set the fields that Enhancements expect
        # with the right names.
        # Sample format already has the right fields,
        # for android we need to create aliases.
        for method in profile["profile"]["methods"]:
            method["function"] = method.get("name", "")
            method["abs_path"] = method.get("source_file", "")
            method["module"] = method.get("class_name", "")
        enhancements.apply_category_and_updated_in_app_to_frames(
            profile["profile"]["methods"], profile["platform"], {}
        )

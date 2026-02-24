import hashlib
import hmac
import logging
from typing import Any
from urllib.parse import urlparse

import sentry_sdk
from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool, Retry

from sentry.net.http import connection_from_url
from sentry.utils import metrics

logger = logging.getLogger(__name__)


seer_summarization_default_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
)


@sentry_sdk.tracing.trace
def make_signed_seer_api_request(
    connection_pool: HTTPConnectionPool,
    path: str,
    body: bytes,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    metric_tags: dict[str, Any] | None = None,
    method: str = "POST",
) -> BaseHTTPResponse:
    host = connection_pool.host
    if connection_pool.port:
        host += ":" + str(connection_pool.port)

    url = f"{connection_pool.scheme}://{host}{path}"
    parsed = urlparse(url)

    auth_headers = sign_with_seer_secret(body)

    options: dict[str, Any] = {}
    if timeout:
        options["timeout"] = timeout
    if retries is not None:
        options["retries"] = retries

    with metrics.timer(
        "seer.request_to_seer",
        sample_rate=1.0,
        tags={"endpoint": parsed.path, **(metric_tags or {})},
    ):
        return connection_pool.urlopen(
            method,
            parsed.path,
            body=body,
            headers={"content-type": "application/json;charset=utf-8", **auth_headers},
            **options,
        )


def sign_with_seer_secret(body: bytes) -> dict[str, str]:
    auth_headers: dict[str, str] = {}
    if settings.SEER_API_SHARED_SECRET:
        signature = hmac.new(
            settings.SEER_API_SHARED_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        auth_headers["Authorization"] = f"Rpcsignature rpc0:{signature}"
    else:
        # TODO(jstanley): remove this once the shared secret is confirmed to always be set
        logger.warning(
            "settings.SEER_API_SHARED_SECRET is not set. Unable to add auth headers for call to Seer."
        )
    return auth_headers

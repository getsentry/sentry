import hashlib
import hmac
import logging
from collections.abc import Mapping
from random import random
from typing import Any
from urllib.parse import urlparse

import orjson
import requests
import sentry_sdk
from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool, Retry

from sentry import options
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@sentry_sdk.tracing.trace
def make_signed_seer_api_request(
    connection_pool: HTTPConnectionPool,
    path: str,
    body: bytes,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    metric_tags: dict[str, Any] | None = None,
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
            "POST",
            parsed.path,
            body=body,
            headers={"content-type": "application/json;charset=utf-8", **auth_headers},
            **options,
        )


@sentry_sdk.tracing.trace
def post_to_seer(
    path: str,
    payload: Mapping[str, Any],
    timeout: int | float = 5,
    base_url: str | None = None,
) -> requests.Response:
    """
    Simple wrapper to POST data to Seer with automatic signing.

    This is a simpler alternative to make_signed_seer_api_request for one-off requests.
    Use this for webhook forwarding and simple API calls. Use make_signed_seer_api_request
    if you need connection pooling for high-volume requests.

    Args:
        path: The API path (e.g., "/v1/automation/codegen/pr-review/github")
        payload: The data to send (will be JSON-serialized)
        timeout: Request timeout in seconds (default: 5)
        base_url: Base URL override (defaults to settings.SEER_AUTOFIX_URL)

    Returns:
        requests.Response object

    Raises:
        requests.HTTPError: If the response status indicates an error
    """
    base_url = base_url or settings.SEER_AUTOFIX_URL
    body = orjson.dumps(payload)

    with metrics.timer(
        "seer.request_to_seer",
        sample_rate=1.0,
        tags={"endpoint": path},
    ):
        response = requests.post(
            f"{base_url}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
            timeout=timeout,
        )
        response.raise_for_status()
        return response


def sign_with_seer_secret(body: bytes) -> dict[str, str]:
    auth_headers: dict[str, str] = {}
    if random() < options.get("seer.api.use-shared-secret"):
        if settings.SEER_API_SHARED_SECRET:
            signature = hmac.new(
                settings.SEER_API_SHARED_SECRET.encode("utf-8"),
                body,
                hashlib.sha256,
            ).hexdigest()
            auth_headers["Authorization"] = f"Rpcsignature rpc0:{signature}"
        else:
            logger.warning(
                "Seer.api.use-shared-secret is set but secret is not set. Unable to add auth headers for call to Seer."
            )
    return auth_headers

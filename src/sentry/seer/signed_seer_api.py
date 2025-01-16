import hashlib
import hmac
import logging
from random import random
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool

from sentry import options
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_signed_seer_api_request(
    connection_pool: HTTPConnectionPool,
    path: str,
    body: bytes,
    timeout: int | None = None,
) -> BaseHTTPResponse:
    host = connection_pool.host
    if connection_pool.port:
        host += ":" + str(connection_pool.port)

    url = f"{connection_pool.scheme}://{host}{path}"
    parsed = urlparse(url)

    # Generate nonce based on option
    path_with_nonce, nonce = get_seer_url(parsed.path)

    auth_headers = sign_with_seer_secret(body, nonce)

    timeout_options: dict[str, Any] = {}
    if timeout:
        timeout_options["timeout"] = timeout

    with metrics.timer(
        "seer.request_to_seer",
        sample_rate=1.0,
        tags={"endpoint": parsed.path},
    ):
        return connection_pool.urlopen(
            "POST",
            path_with_nonce,
            body=body,
            headers={"content-type": "application/json;charset=utf-8", **auth_headers},
            **timeout_options,
        )


def get_seer_url(url: str) -> tuple[str, str | None]:
    nonce = uuid4().hex if random() < options.get("seer.api.use-nonce-signature") else None

    return f"{url}?nonce={nonce}" if nonce else url, nonce


def sign_with_seer_secret(body: bytes, nonce: str | None = None) -> dict[str, str]:
    auth_headers: dict[str, str] = {}
    if random() < options.get("seer.api.use-shared-secret"):
        if settings.SEER_API_SHARED_SECRET:
            signature = hmac.new(
                settings.SEER_API_SHARED_SECRET.encode("utf-8"),
                b"%s:%s" % (nonce.encode(), body) if nonce else body,
                hashlib.sha256,
            ).hexdigest()
            auth_headers["Authorization"] = f"Rpcsignature rpc0:{signature}"
        else:
            logger.warning(
                "Seer.api.use-shared-secret is set but secret is not set. Unable to add auth headers for call to Seer."
            )
    return auth_headers

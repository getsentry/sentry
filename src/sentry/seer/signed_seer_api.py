import hashlib
import hmac
import logging
from random import random
from typing import Any
from urllib.parse import urlparse

from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool

from sentry import options
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_signed_seer_api_request(
    connection_pool: HTTPConnectionPool, path: str, body: bytes, timeout: int | None = None
) -> BaseHTTPResponse:
    host = connection_pool.host
    if connection_pool.port:
        host += ":" + str(connection_pool.port)
    auth_headers = sign_with_seer_secret(f"{connection_pool.scheme}://{host}{path}", body)

    timeout_options: dict[str, Any] = {}
    if timeout:
        timeout_options["timeout"] = timeout

    with metrics.timer(
        "seer.request_to_seer",
        sample_rate=1.0,
        # Pull off query params, if any
        tags={"endpoint": urlparse(path).path},
    ):
        return connection_pool.urlopen(
            "POST",
            path,
            body=body,
            headers={"content-type": "application/json;charset=utf-8", **auth_headers},
            **timeout_options,
        )


def sign_with_seer_secret(url: str, body: bytes):
    auth_headers: dict[str, str] = {}
    if random() < options.get("seer.api.use-shared-secret"):
        if settings.SEER_API_SHARED_SECRET:
            signature_input = b"%s:%s" % (url.encode("utf8"), body)
            signature = hmac.new(
                settings.SEER_API_SHARED_SECRET.encode("utf-8"), signature_input, hashlib.sha256
            ).hexdigest()
            auth_headers["Authorization"] = f"Rpcsignature rpc0:{signature}"
        else:
            logger.warning(
                "Seer.api.use-shared-secret is set but secret is not set. Unable to add auth headers for call to Seer."
            )
    return auth_headers

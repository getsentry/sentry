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
    connection_pool: HTTPConnectionPool, path: str, body: bytes, timeout: int | None = None
) -> BaseHTTPResponse:
    host = connection_pool.host
    if connection_pool.port:
        host += ":" + str(connection_pool.port)

    url, salt = get_seer_salted_url(f"{connection_pool.scheme}://{host}{path}")
    parsed = urlparse(url)
    auth_headers = sign_with_seer_secret(salt, body)

    timeout_options: dict[str, Any] = {}
    if timeout:
        timeout_options["timeout"] = timeout

    with metrics.timer(
        "seer.request_to_seer",
        sample_rate=1.0,
        # Pull off query params, if any
        tags={"endpoint": parsed.path},
    ):
        return connection_pool.urlopen(
            "POST",
            parsed.path + "?" + parsed.query,
            body=body,
            headers={"content-type": "application/json;charset=utf-8", **auth_headers},
            **timeout_options,
        )


def get_seer_salted_url(url: str) -> tuple[str, str]:
    if random() < options.get("seer.api.use-nonce-signature"):
        salt = uuid4().hex
        url += "?nonce=" + salt
    else:
        salt = url
    return url, salt


def sign_with_seer_secret(salt: str, body: bytes):
    auth_headers: dict[str, str] = {}
    if random() < options.get("seer.api.use-shared-secret"):
        if settings.SEER_API_SHARED_SECRET:
            # if random() < options.get("seer.api.use-nonce-signature"):
            signature_input = b"%s:%s" % (salt.encode("utf8"), body)
            signature = hmac.new(
                settings.SEER_API_SHARED_SECRET.encode("utf-8"), signature_input, hashlib.sha256
            ).hexdigest()
            auth_headers["Authorization"] = f"Rpcsignature rpc0:{signature}"
        else:
            logger.warning(
                "Seer.api.use-shared-secret is set but secret is not set. Unable to add auth headers for call to Seer."
            )
    return auth_headers

import hashlib
import hmac
from random import random
from typing import Any

from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool

from sentry import options


def make_signed_seer_api_request(
    connection_pool: HTTPConnectionPool, path: str, body: bytes, timeout: int | None = None
) -> BaseHTTPResponse:
    auth_headers = sign_with_seer_secret(path, body)

    timeout_options: dict[str, Any] = {}
    if timeout:
        timeout_options["timeout"] = timeout

    return connection_pool.urlopen(
        "POST",
        path,
        body=body,
        headers={"content-type": "application/json;charset=utf-8", **auth_headers},
        **timeout_options,
    )


def sign_with_seer_secret(path: str, body: bytes):
    auth_headers: dict[str, str] = {}
    if random() < options.get("seer.api.use-shared-secret"):
        signature_input = b"%s:%s" % (path.encode("utf8"), body)
        signature = hmac.new(
            settings.SEER_API_SHARED_SECRET, signature_input, hashlib.sha256
        ).hexdigest()
        auth_headers["Authorization"] = f"Rpcsignature rpc0:{signature}"
    return auth_headers

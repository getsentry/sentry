from collections.abc import Mapping
from typing import Any

import orjson
from django.conf import settings
from urllib3.exceptions import HTTPError

from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request


class ClientError(Exception):
    "Non-retryable client error from Seer"

    pass


def make_seer_request(path: str, payload: Mapping[str, Any]) -> bytes:
    """
    Make a request to the Seer API and return the response data.

    Args:
        path: The path to the Seer API
        payload: The payload to send to the Seer API

    Raises:
        HTTPError: If the Seer API returns a retryable status
        ClientError: If the Seer API returns a client error

    Returns:
        The response data from the Seer API
    """
    response = make_signed_seer_api_request(
        connection_pool=connection_from_url(settings.SEER_AUTOFIX_URL),
        path=path,
        body=orjson.dumps(payload),
    )
    # Retry on server errors (5xx) and rate limits (429), but not client errors (4xx)
    if response.status >= 500 or response.status == 429:
        raise HTTPError(f"Seer returned retryable status {response.status}")
    elif response.status >= 400:
        # Client errors are permanent, don't retry
        raise ClientError(f"Seer returned client error {response.status}")
    else:
        return response.data

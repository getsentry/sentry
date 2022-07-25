from typing import Any, Dict, Optional
from urllib.parse import urlencode, urlparse

import urllib3
from django.conf import settings
from django.http import StreamingHttpResponse
from urllib3.response import HTTPResponse

from sentry.net.http import connection_from_url
from sentry.utils import metrics

# XXX(jferg): the following code is copied over from the profiles proxy utils code.
# this will be removed in a future PR, please do not copy this without reason.


class RetrySkipTimeout(urllib3.Retry):
    """
    urllib3 Retry class does not allow us to retry on read errors but to exclude
    read timeout
    """

    def increment(
        self, method=None, url=None, response=None, error=None, _pool=None, _stacktrace=None
    ):
        """
        Just rely on the parent class unless we have a read timeout. In that case
        immediately give up
        """
        if error and isinstance(error, urllib3.exceptions.ReadTimeoutError):
            raise error.with_traceback(_stacktrace)

        metrics.incr(
            "replays.client.retry",
            tags={"method": method, "path": urlparse(url).path if url else None},
        )
        return super().increment(
            method=method,
            url=url,
            response=response,
            error=error,
            _pool=_pool,
            _stacktrace=_stacktrace,
        )


_replays_pool = connection_from_url(
    settings.SENTRY_REPLAYS_SERVICE_URL,
    retries=RetrySkipTimeout(
        total=3,
        allowed_methods={"GET"},
    ),
    timeout=30,
    maxsize=10,
)


def get_from_replays_service(
    method: str,
    path: str,
    params: Optional[Dict[Any, Any]] = None,
    headers: Optional[Dict[Any, Any]] = None,
) -> HTTPResponse:
    kwargs: Dict[str, Any] = {"headers": {}, "preload_content": False}
    if params:
        path = f"{path}?{urlencode(params, doseq=True)}"
    if headers:
        kwargs["headers"].update(headers)
    return _replays_pool.urlopen(
        method,
        path,
        **kwargs,
    )


def proxy_replays_service(
    method: str,
    path: str,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> StreamingHttpResponse:
    replays_response = get_from_replays_service(method, path, params=params, headers=headers)

    def stream():
        yield from replays_response.stream(decode_content=False)

    response = StreamingHttpResponse(
        streaming_content=stream(),
        status=replays_response.status,
        content_type=replays_response.headers.get("Content_type", "application/json"),
    )

    for h in ["Content-Encoding", "Vary"]:
        if h in replays_response.headers:
            response[h] = replays_response.headers[h]

    return response

from __future__ import annotations

from collections.abc import Generator
from urllib.parse import urlparse
from wsgiref.util import is_hop_by_hop

import requests
from django.conf import settings
from django.http import StreamingHttpResponse
from requests import Response as ExternalResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, cell_silo_endpoint
from sentry.objectstore import parse_accept_encoding
from sentry.ratelimits.config import RateLimitConfig
from sentry.utils.http import request_body_stream


@cell_silo_endpoint
class ObjectstoreEndpoint(Endpoint):
    """
    Transparent proxy to Objectstore.

    This endpoint is unauthenticated at the Django level, as authentication is performed by Objectstore via the `Authorization` or the `X-Os-Auth` header.
    The `organization_id_or_slug` parameter in the view path and URL kwarg is needed by the API Gateway for cell routing, even though this endpoint does not validate it.
    """

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FOUNDATIONAL_STORAGE
    authentication_classes = ()
    permission_classes = ()
    rate_limits = RateLimitConfig(group="CLI")
    parser_classes = ()  # don't attempt to parse request data, so we can access the raw body in wsgi.input

    def get(
        self, request: Request, organization_id_or_slug: str, path: str
    ) -> Response | StreamingHttpResponse:
        return self._proxy(request, path)

    def put(
        self, request: Request, organization_id_or_slug: str, path: str
    ) -> Response | StreamingHttpResponse:
        return self._proxy(request, path)

    def post(
        self, request: Request, organization_id_or_slug: str, path: str
    ) -> Response | StreamingHttpResponse:
        return self._proxy(request, path)

    def delete(
        self, request: Request, organization_id_or_slug: str, path: str
    ) -> Response | StreamingHttpResponse:
        return self._proxy(request, path)

    def _proxy(
        self,
        request: Request,
        path: str,
    ) -> Response | StreamingHttpResponse:
        assert request.method
        target_url = get_target_url(path)

        headers = dict(request.headers)
        headers.pop("Host", None)
        headers.pop("Content-Length", None)
        headers.pop("Transfer-Encoding", None)

        query_string = request.META.get("QUERY_STRING") or None
        accepted_encodings = parse_accept_encoding(request.headers.get("Accept-Encoding", ""))

        if request.method == "GET" and "Range" in headers:
            head_headers = headers.copy()
            head_headers.pop("Range")
            head_headers.pop("If-Range", None)

            forward_range = False
            try:
                with requests.request(
                    "HEAD",
                    url=target_url,
                    headers=head_headers,
                    params=query_string,
                    stream=True,
                    allow_redirects=False,
                ) as head_response:
                    content_encoding = (
                        head_response.headers.get("Content-Encoding", "").strip().lower()
                    )
                    forward_range = 200 <= head_response.status_code < 300 and (
                        not content_encoding or content_encoding in accepted_encodings
                    )
            except requests.RequestException:
                # Without reliable metadata, fall back to a decodable full response.
                forward_range = False

            if not forward_range:
                headers.pop("Range")
                headers.pop("If-Range", None)

        response = requests.request(
            request.method,
            url=target_url,
            headers=headers,
            data=(
                request_body_stream(request._request)
                if request.method in ("PUT", "POST", "PATCH")
                else None
            ),
            params=query_string,
            stream=True,
            allow_redirects=False,
        )

        content_encoding = response.headers.get("Content-Encoding", "").strip().lower()
        decode_content = (
            response.status_code != 206
            and bool(content_encoding)
            and content_encoding not in accepted_encodings
        )

        return stream_response(response, decode_content=decode_content)


def get_target_url(path: str) -> str:
    base = settings.SENTRY_OBJECTSTORE_CONFIG["base_url"].rstrip("/")
    # `path` should be a relative path, only grab that part
    path = urlparse(path).path
    # Simply concatenate base and path, without resolving URLs
    # This means that if the user supplies path traversal patterns like "/../", we include them literally rather than resolving them
    # It's responsibility of Objectstore to deal with them correctly
    target = base + "/" + path
    return target


def stream_response(
    external_response: ExternalResponse, decode_content: bool = False
) -> StreamingHttpResponse:
    CHUNK_SIZE = 512 * 1024

    def stream_generator() -> Generator[bytes]:
        with external_response:
            external_response.raw.decode_content = decode_content
            while True:
                chunk = external_response.raw.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk

    response = StreamingHttpResponse(
        streaming_content=stream_generator(),
        status=external_response.status_code,
    )

    for header, value in external_response.headers.items():
        if header.lower() == "server":
            continue
        if decode_content and header.lower() in ("content-encoding", "content-length"):
            continue  # Body was decompressed; length and encoding no longer match
        if not is_hop_by_hop(header):
            response[header] = value

    return response

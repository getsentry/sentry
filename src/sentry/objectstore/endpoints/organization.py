from collections.abc import Callable, Generator
from typing import Literal
from urllib.parse import urljoin, urlparse
from wsgiref.util import is_hop_by_hop

import requests
from django.core.exceptions import SuspiciousOperation
from django.http import StreamingHttpResponse
from requests import Response as ExternalResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.models.organization import Organization

CHUNK_SIZE = 512 * 1024


@region_silo_endpoint
class OrganizationObjectstoreEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FOUNDATIONAL_STORAGE
    parser_classes = ()  # don't attempt to parse request data, so we can access the raw wsgi.input

    def get(
        self, request: Request, organization: Organization, path: str
    ) -> Response | StreamingHttpResponse:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(status=404)
        return self._proxy("GET", path, request)

    def put(
        self, request: Request, organization: Organization, path: str
    ) -> Response | StreamingHttpResponse:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(status=404)
        return self._proxy("PUT", path, request)

    def post(
        self, request: Request, organization: Organization, path: str
    ) -> Response | StreamingHttpResponse:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(status=404)
        return self._proxy("POST", path, request)

    def delete(
        self, request: Request, organization: Organization, path: str
    ) -> Response | StreamingHttpResponse:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(status=404)
        return self._proxy("DELETE", path, request)

    def _proxy(
        self,
        method: Literal["GET", "PUT", "POST", "DELETE"],
        path: str,
        request: Request,
    ) -> Response | StreamingHttpResponse:

        target_url = get_target_url(path)

        headers = dict(request.headers)
        if method in ("PUT", "POST") and not headers.get("Transfer-Encoding") == "chunked":
            return Response("Only Transfer-Encoding: chunked is supported", status=400)

        headers.pop("Content-Length", None)
        headers.pop("Transfer-Encoding", None)

        stream = None
        if method in ("PUT", "POST"):
            wsgi_input = request.META.get("wsgi.input")
            if not wsgi_input:
                return Response("Expected a request body", status=400)
            stream = ChunkedEncodingDecoder(wsgi_input._read)

        response = requests.request(
            method,
            url=target_url,
            headers=headers,
            data=stream,
            params=dict(request.GET) if request.GET else None,
            stream=True,
            allow_redirects=False,
        )
        return stream_response(response)


class ChunkedEncodingDecoder:
    """
    Wrapper around a read function returning chunked transfer encoded data.
    Provides a file-like interface to the decoded data stream.
    """

    def __init__(self, read: Callable[[int], bytes]):
        self._read = read
        self._done = False
        self._current_chunk_remaining = 0

    def read(self, size: int = -1) -> bytes:
        if self._done:
            return b""
        if size == -1:
            self._done = True
            return self._read(-1)

        read = 0
        buffer = []
        while read < size:
            if self._current_chunk_remaining == 0:
                # Read next chunk size line
                size_line = b""
                while not size_line.endswith(b"\r\n"):
                    byte = self._read(1)
                    if not byte:
                        self._done = True
                        return b"".join(buffer)
                    size_line += byte

                try:
                    chunk_size = int(size_line.strip(), 16)
                except ValueError:
                    self._done = True
                    return b"".join(buffer)

                if chunk_size == 0:
                    self._read(2)  # Read trailing \r\n
                    self._done = True
                    return b"".join(buffer)

                self._current_chunk_remaining = chunk_size
            else:
                to_read = min(self._current_chunk_remaining, size - read)
                chunk = self._read(to_read)
                if not chunk:
                    self._done = True
                    break
                buffer.append(chunk)
                read += len(chunk)
                self._current_chunk_remaining -= len(chunk)

                if self._current_chunk_remaining == 0:
                    self._read(2)  # Read trailing \r\n

        return b"".join(buffer)


def get_target_url(path: str) -> str:
    base = options.get("objectstore.config")["base_url"].rstrip("/")
    base_parsed = urlparse(base)

    target = urljoin(base, path)
    target_parsed = urlparse(target)

    if target_parsed.scheme != base_parsed.scheme or target_parsed.netloc != base_parsed.netloc:
        raise SuspiciousOperation("Possible SSRF attempt")
    if ".." in path:
        raise SuspiciousOperation("Possible path traversal attempt")

    return target


def stream_response(response: ExternalResponse) -> StreamingHttpResponse:
    def stream() -> Generator[bytes]:
        response.raw.decode_content = False
        while True:
            chunk = response.raw.read(CHUNK_SIZE)
            if not chunk:
                break
            yield chunk

    streamed_response = StreamingHttpResponse(
        streaming_content=stream(),
        status=response.status_code,
    )

    for header, value in response.headers.items():
        if not is_hop_by_hop(header):
            streamed_response[header] = value

    return streamed_response

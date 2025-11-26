from collections.abc import Callable, Generator
from typing import Literal
from urllib.parse import urljoin
from wsgiref.util import is_hop_by_hop

import requests
from django.http import StreamingHttpResponse
from requests import Response as ExternalResponse
from rest_framework.parsers import BaseParser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationObjectstoreEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FOUNDATIONAL_STORAGE
    parser_classes = []  # accept arbitrary data and don't attempt to parse it

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
    ) -> StreamingHttpResponse:
        target_base_url = options.get("objectstore.config")["base_url"].rstrip("/")
        target_url = urljoin(target_base_url, path)

        headers = dict(request.headers)
        is_chunked = headers.get("Transfer-Encoding") == "chunked"

        headers.pop("Content-Length", None)
        headers.pop("Transfer-Encoding", None)

        body_stream: StreamReader | ChunkedStreamDecoder | None = None
        if method in ("PUT", "POST"):
            wsgi_input = request._request.META.get("wsgi.input")
            if wsgi_input and hasattr(wsgi_input, "_read"):
                stream_func = wsgi_input._read
                content_length = request._request.META.get("CONTENT_LENGTH")

                if is_chunked:
                    print("chunked")
                    body_stream = ChunkedStreamDecoder(stream_func)
                elif content_length:
                    print("reader with content length")
                    body_stream = StreamReader(stream_func, int(content_length))
                    headers["Content-Length"] = content_length
                else:
                    print("reader without content length")
                    body_stream = StreamReader(stream_func)

        response = requests.request(
            method,
            url=target_url,
            headers=headers,
            params=dict(request.GET) if request.GET else None,
            data=body_stream,
            stream=True,
            allow_redirects=False,
        )
        response.raise_for_status()

        return parse_objectstore_response(response)


class StreamReader:
    """
    Wraps a stream function to provide a file-like interface for requests library.
    Streams data without buffering the entire body in memory.
    """

    def __init__(self, read_func: Callable[[int], bytes], content_length: int | None = None):
        self._read = read_func
        self._content_length = content_length

    def read(self, size: int = -1) -> bytes:
        if size == -1 and self._content_length:
            size = self._content_length
        return self._read(size)

    def __len__(self) -> int:
        if self._content_length is None:
            raise AttributeError("Content length unknown")
        return self._content_length


class ChunkedStreamDecoder:
    """
    Decodes HTTP chunked transfer encoding on-the-fly without buffering.
    Implements file-like interface for streaming to requests library.
    """

    def __init__(self, read_func: Callable[[int], bytes]):
        self._read = read_func
        self._done = False
        self._current_chunk_remaining = 0

    def read(self, size: int = -1) -> bytes:
        if self._done:
            return b""

        result = []
        bytes_read = 0
        target_size = size if size > 0 else 8192

        while bytes_read < target_size:
            if self._current_chunk_remaining > 0:
                to_read = min(self._current_chunk_remaining, target_size - bytes_read)
                chunk = self._read(to_read)
                if not chunk:
                    self._done = True
                    break
                result.append(chunk)
                bytes_read += len(chunk)
                self._current_chunk_remaining -= len(chunk)

                if self._current_chunk_remaining == 0:
                    self._read(2)  # Read trailing \r\n
            else:
                # Read next chunk size line
                size_line = b""
                while not size_line.endswith(b"\r\n"):
                    byte = self._read(1)
                    if not byte:
                        self._done = True
                        return b"".join(result)
                    size_line += byte

                try:
                    chunk_size = int(size_line.strip(), 16)
                except ValueError:
                    self._done = True
                    return b"".join(result)

                if chunk_size == 0:
                    self._read(2)  # Read trailing \r\n
                    self._done = True
                    return b"".join(result)

                self._current_chunk_remaining = chunk_size

        return b"".join(result)


def parse_objectstore_response(response: ExternalResponse) -> StreamingHttpResponse:
    """
    Converts requests Response to StreamingHttpResponse, preserving Content-Encoding
    by disabling automatic decompression.
    """
    CHUNK_SIZE = 512 * 1024

    def stream_response() -> Generator[bytes]:
        response.raw.decode_content = False
        while True:
            chunk = response.raw.read(CHUNK_SIZE)
            if not chunk:
                break
            yield chunk

    streamed_response = StreamingHttpResponse(
        streaming_content=stream_response(),
        status=response.status_code,
        content_type=response.headers.pop("Content-Type", None),
    )

    for header, value in response.headers.items():
        if not is_hop_by_hop(header):
            streamed_response[header] = value

    return streamed_response


def get_target_url(path: str) -> str:

    return url

import logging
from collections.abc import Callable, Generator
from typing import Any
from urllib.parse import urlparse
from wsgiref.util import is_hop_by_hop

import requests
from django.http import StreamingHttpResponse
from requests import Response as ExternalResponse
from rest_framework.request import Request
from rest_framework.response import Response

# TODO(granian): Remove this and related code paths when we fully switch from uwsgi to granian
uwsgi: Any = None
try:
    import uwsgi
except ImportError:
    pass

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationObjectstoreEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FOUNDATIONAL_STORAGE
    parser_classes = ()  # don't attempt to parse request data, so we can access the raw body in wsgi.input

    def _check_flag(self, request: Request, organization: Organization) -> Response | None:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(
                {
                    "error": "This endpoint requires the organizations:objectstore-endpoint feature flag."
                },
                status=403,
            )
        return None

    def get(
        self, request: Request, organization: Organization, path: str
    ) -> Response | StreamingHttpResponse:
        if response := self._check_flag(request, organization):
            return response
        return self._proxy(request, path)

    def put(
        self, request: Request, organization: Organization, path: str
    ) -> Response | StreamingHttpResponse:
        if response := self._check_flag(request, organization):
            return response
        return self._proxy(request, path)

    def post(
        self, request: Request, organization: Organization, path: str
    ) -> Response | StreamingHttpResponse:
        if response := self._check_flag(request, organization):
            return response
        return self._proxy(request, path)

    def delete(
        self, request: Request, organization: Organization, path: str
    ) -> Response | StreamingHttpResponse:
        if response := self._check_flag(request, organization):
            return response
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

        stream: Generator[bytes] | ChunkedEncodingDecoder | None = None
        wsgi_input = request.META.get("wsgi.input")

        logger.info(
            "objectstore proxy request",
            extra={
                "method": request.method,
                "path": path,
                "request_id": request.META.get("HTTP_X_REQUEST_ID"),
                "content_type": request.META.get("CONTENT_TYPE"),
                "content_length": request.META.get("CONTENT_LENGTH"),
                "transfer_encoding": request.META.get("HTTP_TRANSFER_ENCODING"),
                "server_software": request.META.get("SERVER_SOFTWARE"),
                "has_wsgi_input": wsgi_input is not None,
                "x_forwarded_for": request.META.get("HTTP_X_FORWARDED_FOR"),
                "x_forwarded_proto": request.META.get("HTTP_X_FORWARDED_PROTO"),
                "x_forwarded_host": request.META.get("HTTP_X_FORWARDED_HOST"),
            },
        )

        if "granian" in request.META.get("SERVER_SOFTWARE", "").lower():
            stream = wsgi_input
        # uwsgi and wsgiref will respectively raise an exception and hang when attempting to read wsgi.input while there's no body.
        # For now, support bodies only on PUT and POST requests.
        elif request.method in ("PUT", "POST"):
            if uwsgi:
                if headers.pop("Transfer-Encoding", "").lower() == "chunked":

                    def stream_generator():
                        while True:
                            chunk = uwsgi.chunked_read()
                            if not chunk:
                                break
                            yield chunk

                    stream = stream_generator()
                else:
                    stream = wsgi_input

            else:
                # This code path assumes wsgiref, used in dev/test mode.
                # Note that we don't handle non-chunked transfer encoding here as our client (which we use for tests) always uses chunked encoding.
                stream = ChunkedEncodingDecoder(wsgi_input._read)  # type: ignore[union-attr]

        # This is also for wsgiref only
        if "WSGIServer" in request.META.get("SERVER_SOFTWARE", ""):
            headers.pop("Content-Length", None)

        response = requests.request(
            request.method,
            url=target_url,
            headers=headers,
            data=stream,
            params=dict(request.GET) if request.GET else None,
            stream=True,
            allow_redirects=False,
        )
        return stream_response(response)


def get_target_url(path: str) -> str:
    base = options.get("objectstore.config")["base_url"].rstrip("/")
    # `path` should be a relative path, only grab that part
    path = urlparse(path).path
    # Simply concatenate base and path, without resolving URLs
    # This means that if the user supplies path traversal patterns like "/../", we include them literally rather than resolving them
    # It's responsibility of Objectstore to deal with them correctly
    target = base + "/" + path
    return target


def stream_response(external_response: ExternalResponse) -> StreamingHttpResponse:
    CHUNK_SIZE = 512 * 1024

    def stream_generator() -> Generator[bytes]:
        external_response.raw.decode_content = False
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
        if not is_hop_by_hop(header):
            response[header] = value

    return response


class ChunkedEncodingDecoder:
    """
    Wrapper around a read function that returns chunked transfer encoded data.
    Provides a file-like interface to the decoded data stream.
    This should only be needed in dev/test mode, when we need to manually decode wsgi.input.
    """

    def __init__(self, read: Callable[[int], bytes]):
        self._read = read
        self._done = False
        self._current_chunk_remaining = 0

    def read(self, size: int = -1) -> bytes:
        if self._done:
            return b""

        read = 0
        buffer: list[bytes] = []
        while size == -1 or read < size:
            if self._current_chunk_remaining == 0:
                # Read next chunk size line
                size_line = b""
                while not size_line.endswith(b"\r\n"):
                    byte = self._read(1)
                    if not byte:
                        self._done = True
                        return b"".join(buffer)
                    size_line += byte

                chunk_size = int(size_line.strip(), 16)
                if chunk_size == 0:
                    trail = self._read(2)
                    if trail != b"\r\n":
                        raise ValueError("Malformed chunk encoded stream")
                    self._done = True
                    return b"".join(buffer)

                self._current_chunk_remaining = chunk_size
            else:
                # Read (part of) next chunk
                to_read = (
                    min(self._current_chunk_remaining, size - read)
                    if size != -1
                    else self._current_chunk_remaining
                )
                chunk = self._read(to_read)
                if not chunk:
                    raise ValueError("Unexpected end of stream")
                buffer.append(chunk)
                read += len(chunk)
                self._current_chunk_remaining -= len(chunk)

                if self._current_chunk_remaining == 0:
                    trail = self._read(2)
                    if trail != b"\r\n":
                        raise ValueError("Malformed chunk encoded stream")

        return b"".join(buffer)

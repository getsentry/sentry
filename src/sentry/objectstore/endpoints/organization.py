from collections.abc import Callable, Generator
from typing import Any
from urllib.parse import urljoin, urlparse
from wsgiref.util import is_hop_by_hop

import requests
from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from django.http import StreamingHttpResponse
from requests import Response as ExternalResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils.env import in_test_environment

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

    def _check_flag(self, request: Request, organization: Organization) -> Response | None:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(
                "This endpoint requires the organizations:objectstore-endpoint feature flag.",
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
        if request.method in ("PUT", "POST") and not headers.get("Transfer-Encoding") == "chunked":
            return Response("Only Transfer-Encoding: chunked is supported", status=400)

        headers.pop("Host", None)
        headers.pop("Content-Length", None)
        headers.pop("Transfer-Encoding", None)

        stream: Generator[bytes] | ChunkedEncodingDecoder | None = None
        if request.method in ("PUT", "POST"):
            wsgi_input = request.META.get("wsgi.input")
            assert wsgi_input

            if uwsgi:

                def stream_generator():
                    while True:
                        chunk = uwsgi.chunked_read()
                        if not chunk:
                            break
                        yield chunk

                stream = stream_generator()

            else:
                # This code path should be hit only in test/dev mode, where the wsgi implementation is wsgiref, not uwsgi.
                # wsgiref doesn't handle chunked encoding automatically, and exposes different functions on the class it uses to represent the input stream.
                # Therefore, we need to decode the chunked encoding ourselves using ChunkedEncodingDecoder.
                if not (settings.IS_DEV or in_test_environment()):
                    raise RuntimeError(
                        "This module assumes that uWSGI is used in production, and it seems that this is not true anymore. Adapt the module to the new server."
                    )
                stream = ChunkedEncodingDecoder(wsgi_input._read)

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
    base_parsed = urlparse(base)

    target = urljoin(base, path)
    target_parsed = urlparse(target)

    if (
        target_parsed.scheme != base_parsed.scheme
        or target_parsed.netloc != base_parsed.netloc
        or not target.startswith(base)
    ):
        raise SuspiciousOperation("Possible SSRF attempt")
    if ".." in path:
        raise SuspiciousOperation("Possible path traversal attempt")

    return target


def stream_response(external_response: ExternalResponse) -> StreamingHttpResponse:
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
        if header == "server":
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

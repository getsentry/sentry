from __future__ import annotations

from django.http.response import HttpResponseBase, StreamingHttpResponse


def close_streaming_response(response: HttpResponseBase) -> bytes:
    """Exhausts the streamed file in a response.

    When the file is exahusted, this underlying file descriptor is closed
    avoiding a `ResourceWarning`.
    """
    assert isinstance(response, StreamingHttpResponse)
    return response.getvalue()

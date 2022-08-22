from django.http.response import StreamingHttpResponse


def close_streaming_response(response: StreamingHttpResponse) -> None:
    """Exhausts the streamed file in a response.

    When the file is exahusted, this underlying file descriptor is closed
    avoiding a `ResourceWarning`.
    """
    for _ in response.streaming_content:
        pass

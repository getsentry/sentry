import json

from requests import Response


def create_mock_response(status_code: int, body: dict = None, is_json: bool = True) -> Response:
    """
    Creates a mock Response object for testing.

    Args:
        status_code: HTTP status code to return
        body: Response body (dict for JSON responses)
        is_json: Whether the response should be treated as JSON
    """
    response = Response()
    response.status_code = status_code

    if body is None:
        body = {}

    if is_json:
        response._content = json.dumps(body).encode()
    else:
        response._content = str(body).encode()

    return response

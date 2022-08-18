from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response


def proxy_request_if_needed(request: Request) -> Response | None:
    """
    Main execution flow for the API Gateway
    returns None if proxying is not required
    """
    return None

from typing import Callable

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_500_INTERNAL_SERVER_ERROR


def error_handler_middleware(
    get_response: Callable[[Request], Response]
) -> Callable[[Request], Response]:
    def middleware(request: Request) -> Response:

        try:
            return get_response(request)
        except Exception:
            return Response(
                {"message": "An unexpected error occured. A report has been filed."},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )

    return middleware

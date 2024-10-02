from __future__ import annotations

import logging

# TODO: We should make the API a class, and UDP/HTTP just inherit from it
#       This will make it so we can more easily control logging with various
#       metadata (rather than generic log messages which aren't useful).


logger = logging.getLogger("sentry.api")


class APIError(Exception):
    http_status = 400
    msg = "Invalid request"

    def __init__(self, msg: str | None = None) -> None:
        if msg:
            self.msg = msg

    def __str__(self) -> str:
        return self.msg or ""


class APIUnauthorized(APIError):
    http_status = 401
    msg = "Unauthorized"


class APIForbidden(APIError):
    http_status = 403

"""The `SentryAPIException` error body as an OpenAPI component.

The schema is built from the exception classes, so the published codes, statuses and
`extra` keys follow the ones the API sends. Operations don't reference it: any of them
can return these errors, and listing them per operation would not be accurate.
"""

from __future__ import annotations

from typing import Any

from sentry.api.exceptions import SentryAPIException
from sentry.apidocs.utils import SentryApiBuildError

SENTRY_API_ERROR_COMPONENT = "SentryApiErrorBody"


def sentry_api_exceptions() -> list[type[SentryAPIException]]:
    """Every imported `SentryAPIException` subclass with a code, sorted by code.

    Only imported classes are found; the schema build imports every endpoint first.
    """
    found: dict[str, type[SentryAPIException]] = {}
    pending: list[type[SentryAPIException]] = [SentryAPIException]
    while pending:
        cls = pending.pop()
        pending.extend(cls.__subclasses__())
        if not cls.code:
            continue
        other = found.setdefault(cls.code, cls)
        if other is not cls and other.status_code != cls.status_code:
            raise SentryApiBuildError(
                f"{other.__qualname__} and {cls.__qualname__} share the code {cls.code!r} "
                "with different statuses."
            )
    return [found[code] for code in sorted(found)]


def _detail_schema(cls: type[SentryAPIException]) -> dict[str, Any]:
    return {
        "type": "object",
        "title": cls.code,
        "required": ["code", "message", "extra"],
        "properties": {
            "code": {"type": "string", "enum": [cls.code]},
            "message": {"type": "string"},
            "extra": {
                "type": "object",
                "properties": {key: {"type": "string"} for key in cls.extra_keys},
            },
        },
        "x-sentry-status": cls.status_code,
    }


def sentry_api_error_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "description": (
            "The body of an error with a machine-readable code. Each `detail` variant "
            "names its HTTP status in `x-sentry-status`."
        ),
        "required": ["detail"],
        "properties": {
            "detail": {"oneOf": [_detail_schema(cls) for cls in sentry_api_exceptions()]}
        },
    }

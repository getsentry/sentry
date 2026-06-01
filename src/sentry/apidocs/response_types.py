"""Static types for endpoint Response annotations.

Currently houses `DetailResponse`, the canonical name for DRF's standard
error-body shape (`{"detail": "..."}`). Endpoint methods that mix typed
success returns with inline `Response({"detail": "..."}, status=4xx)` error
returns annotate as `Response[T] | Response[DetailResponse]` so mypy can
verify both arms.

The structural linter at `sentry.apidocs._check_response_annotation_matches_schema`
recognizes `DetailResponse` by name and excludes it from the
decorator/annotation set-equality comparison (the error arm has no
comparable decorator entry — error statuses are typically declared as
opaque `RESPONSE_*` constants which the linter already skips).

Named `response_types` rather than `types` to avoid shadowing Python's
stdlib `types` module when subprocess tooling (e.g. some prek hooks)
puts `apidocs/` on `sys.path`.
"""

from __future__ import annotations

from typing import TypedDict


class DetailResponse(TypedDict):
    """DRF's standard error-body shape, rendered by its exception handler.

    Every `APIException` subclass (`ParseError`, `NotFound`, `PermissionDenied`,
    etc.) ultimately produces a JSON body matching this shape with the
    exception's status code. Inline `Response({"detail": "..."}, status=4xx)`
    construction mirrors the same shape.
    """

    detail: str

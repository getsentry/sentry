"""Shared TypedDicts for endpoint Response annotations.

This module holds TypedDict shapes that recur across multiple endpoints.
It is *not* authoritative — endpoints whose error/response shapes don't
match anything here are expected to declare local TypedDicts in their
own files. The structural linter at
`sentry.apidocs._check_response_annotation_matches_schema` is name-agnostic;
it does not special-case any TypedDict name in this module.

`DetailResponse` is included because DRF's exception handler renders every
uncaught `APIException` subclass as `{"detail": "..."}` and a non-trivial
number of endpoints return that shape inline. Other shapes can graduate
into this module as they emerge from real usage.

The module is named `response_types` rather than `types` to avoid shadowing
Python's stdlib `types` module under subprocess tooling (e.g. some prek hooks).
"""

from __future__ import annotations

from typing import TypedDict


class DetailResponse(TypedDict):
    """DRF's standard error-body shape: `{"detail": str}`.

    Use in `Response[T] | Response[DetailResponse]` annotations on endpoints
    whose inline error returns are exactly `Response({"detail": "..."}, status=4xx)`.
    Endpoints whose error bodies have richer or different shapes should
    declare their own local TypedDicts instead.
    """

    detail: str

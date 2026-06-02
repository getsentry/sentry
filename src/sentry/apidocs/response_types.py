"""Shared response shapes and helpers for endpoint Response annotations.

This module holds TypedDicts, type aliases, and small helpers that recur
across multiple endpoints in the Response[T] typing rollout. It is *not*
authoritative — endpoints whose error/response shapes don't match anything
here are expected to declare local types in their own files. The structural
linter at `sentry.apidocs._check_response_annotation_matches_schema` is
name-agnostic; it does not special-case any name in this module.

`DetailResponse` is included because DRF's exception handler renders every
uncaught `APIException` subclass as `{"detail": "..."}` and a non-trivial
number of endpoints return that shape inline.

`ValidationErrorResponse` + `as_validation_errors()` cover the parallel
case for DRF `Response(serializer.errors, status=400)` paths.

The module is named `response_types` rather than `types` to avoid shadowing
Python's stdlib `types` module under subprocess tooling (e.g. some prek hooks).
"""

from __future__ import annotations

from typing import Any, TypeAlias, TypedDict

from rest_framework import serializers


class DetailResponse(TypedDict):
    """DRF's standard error-body shape: `{"detail": str}`.

    Use in `Response[T] | Response[DetailResponse]` annotations on endpoints
    whose inline error returns are exactly `Response({"detail": "..."}, status=4xx)`.
    Endpoints whose error bodies have richer or different shapes should
    declare their own local TypedDicts instead.
    """

    detail: str


ValidationErrorResponse: TypeAlias = dict[str, list[str]]
"""DRF's flat validation-error body shape: `{field_name: [error_message, ...]}`.

The runtime value of `serializer.errors` is a `ReturnDict[Any, Any]` that
mypy can't structurally match against any typed `Response[T]` union arm.
Use this alias as the validation-error arm:

    def post(...) -> Response[FooResponse] | Response[ValidationErrorResponse]:

and produce the body via `as_validation_errors(serializer)` below.

Limitation: this alias is for *flat* serializers (field names → list of
error strings). Nested serializers whose `.errors` produce
`{field: {nested_field: [...]}}` shapes need a richer local type.
"""


def as_validation_errors(
    serializer: serializers.Serializer[Any],
) -> ValidationErrorResponse:
    """Project a DRF `Serializer.errors` ReturnDict into a structurally typed
    `dict[str, list[str]]` so a `Response[ValidationErrorResponse]` union arm
    is satisfied without `cast()`. Use immediately after `not serializer.is_valid()`:

        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)
    """
    return {k: list(v) for k, v in serializer.errors.items()}

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from sentry.apidocs._check_response_annotation_matches_schema import (
    Mismatch,
    check_file,
    main,
)


def _run(source: str) -> list[Mismatch]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(source)
        path = Path(f.name)
    try:
        return check_file(path)
    finally:
        path.unlink()


def test_matching_decorator_and_annotation_passes() -> None:
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_decorator_annotation_mismatch_fires() -> None:
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class BarResponse(TypedDict):
    y: int

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response[BarResponse]:
        return Response({"y": 1})
"""
    mismatches = _run(source)
    assert len(mismatches) == 1
    m = mismatches[0]
    assert m.cls == "FooEndpoint"
    assert m.method == "get"
    assert m.decl == frozenset({"FooResponse"})
    assert m.annot == frozenset({"BarResponse"})


def test_unmigrated_endpoint_skipped() -> None:
    """Plain `-> Response` (no [T]) is the unmigrated state — must not error."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_method_without_extend_schema_skipped() -> None:
    source = """
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    def get(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_canned_response_constant_skipped() -> None:
    """Non-`inline_sentry_response_serializer` entries (e.g. RESPONSE_BAD_REQUEST)
    are not comparable and must not produce false positives."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    @extend_schema(
        responses={
            200: inline_sentry_response_serializer("Foo", FooResponse),
            400: RESPONSE_BAD_REQUEST,
        },
    )
    def get(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_union_annotation_matches_multi_status_decorator() -> None:
    """Union return type matching a decorator with multiple typed responses."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class ErrorBody(TypedDict):
    detail: str

class FooEndpoint:
    @extend_schema(
        responses={
            200: inline_sentry_response_serializer("Foo", FooResponse),
            400: inline_sentry_response_serializer("Err", ErrorBody),
        },
    )
    def get(self) -> Response[FooResponse] | Response[ErrorBody]:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_union_annotation_missing_decorator_T_fires() -> None:
    """If the decorator declares two typed responses but the annotation only
    covers one, the set-equality check must fail."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class ErrorBody(TypedDict):
    detail: str

class FooEndpoint:
    @extend_schema(
        responses={
            200: inline_sentry_response_serializer("Foo", FooResponse),
            400: inline_sentry_response_serializer("Err", ErrorBody),
        },
    )
    def get(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    mismatches = _run(source)
    assert len(mismatches) == 1
    assert mismatches[0].decl == frozenset({"FooResponse", "ErrorBody"})
    assert mismatches[0].annot == frozenset({"FooResponse"})


def test_annotation_has_extra_T_not_in_decorator_passes() -> None:
    """Under the subset linter, the annotation MAY declare arms the decorator
    doesn't. These are internal-only type contracts (e.g. local error
    TypedDicts not exposed in OpenAPI via inline_sentry_response_serializer).
    The decorator's typed-T set still has to be a subset of the annotation's,
    but the annotation is free to declare more."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class LocalErrorBody(TypedDict):
    error: str

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response[FooResponse] | Response[LocalErrorBody]:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_multi_2xx_decorator_with_union_annotation() -> None:
    """Multiple 2xx schemas (e.g. 200 + 201) with a union annotation covering both."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class GetResponse(TypedDict):
    x: int

class CreatedResponse(TypedDict):
    id: str

class FooEndpoint:
    @extend_schema(
        responses={
            200: inline_sentry_response_serializer("Foo", GetResponse),
            201: inline_sentry_response_serializer("FooCreated", CreatedResponse),
        },
    )
    def post(self) -> Response[GetResponse] | Response[CreatedResponse]:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_union_with_non_response_arm_skipped() -> None:
    """If the union contains an arm that isn't `Response[T]` (e.g. a bare
    `HttpResponse`), the method is treated as unmigrated and skipped — there's
    no clean comparison to make."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from django.http import HttpResponse
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response[FooResponse] | HttpResponse:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_async_method_works() -> None:
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class BarResponse(TypedDict):
    y: int

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    async def get(self) -> Response[BarResponse]:
        return Response({"y": 1})
"""
    mismatches = _run(source)
    assert len(mismatches) == 1
    assert mismatches[0].decl == frozenset({"FooResponse"})
    assert mismatches[0].annot == frozenset({"BarResponse"})


def test_dotted_response_annotation_handled() -> None:
    """Some files write the annotation as `rest_framework.response.Response[T]`."""
    source = """
from typing import TypedDict
import rest_framework.response
from drf_spectacular.utils import extend_schema
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class BarResponse(TypedDict):
    y: int

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> rest_framework.response.Response[BarResponse]:
        return rest_framework.response.Response({"y": 1})
"""
    mismatches = _run(source)
    assert len(mismatches) == 1
    assert mismatches[0].decl == frozenset({"FooResponse"})
    assert mismatches[0].annot == frozenset({"BarResponse"})


def test_main_returns_zero_on_clean(tmp_path: Path) -> None:
    (tmp_path / "ok.py").write_text(
        """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    )
    assert main(["prog", str(tmp_path)]) == 0


def test_main_returns_nonzero_on_mismatch(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    (tmp_path / "drift.py").write_text(
        """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class BarResponse(TypedDict):
    y: int

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response[BarResponse]:
        return Response({"y": 1})
"""
    )
    assert main(["prog", str(tmp_path)]) == 1
    captured = capsys.readouterr()
    assert "FooResponse" in captured.out
    assert "BarResponse" in captured.out
    assert "mismatch" in captured.err


def test_direct_serializer_class_reference_skipped() -> None:
    """Decorator entries that are bare class references (e.g. `MonitorSerializer`)
    carry a typed output by sentry convention but no statically-resolvable link
    to a TypedDict. The linter skips them silently — neither false-positives nor
    false-negatives. Resolving these waits on the generic-`Serializer[T]`
    refactor, or on migrating the entry to `inline_sentry_response_serializer`.
    """
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

class MonitorSerializer: ...

class MonitorSerializerResponse(TypedDict):
    id: str

class MonitorEndpoint:
    @extend_schema(responses={200: MonitorSerializer})
    def get(self) -> Response[MonitorSerializerResponse]:
        return Response({"id": "x"})
"""
    assert _run(source) == []


def test_openapi_response_wrapper_skipped() -> None:
    """`OpenApiResponse(...)` and similar wrappers don't carry a comparable T —
    skip silently."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    @extend_schema(
        responses={200: OpenApiResponse(description="ok")},
    )
    def get(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_decorator_opaque_RESPONSE_constants_with_annotation_error_arm_passes() -> None:
    """API-as-today scenario: decorator declares only the 200 schema via
    `inline_sentry_response_serializer` and uses opaque `RESPONSE_*` constants
    for errors. Annotation declares the full union including a local error
    TypedDict. Under subset semantics this passes — the annotation is
    internal-only enrichment that doesn't change the published OpenAPI."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

RESPONSE_BAD_REQUEST = OpenApiResponse(description="Bad Request")

class FooResponse(TypedDict):
    x: int

class FooErrorBody(TypedDict):
    detail: str

class FooEndpoint:
    @extend_schema(
        responses={
            200: inline_sentry_response_serializer("Foo", FooResponse),
            400: RESPONSE_BAD_REQUEST,
        },
    )
    def get(self) -> Response[FooResponse] | Response[FooErrorBody]:
        return Response({"x": 1})
"""
    assert _run(source) == []


def test_decorator_typed_error_must_appear_in_annotation() -> None:
    """If the decorator declares a typed error arm via
    `inline_sentry_response_serializer`, the annotation MUST include that T.
    Drift in this direction is still caught."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class TypedErrorBody(TypedDict):
    detail: str

class FooEndpoint:
    @extend_schema(
        responses={
            200: inline_sentry_response_serializer("Foo", FooResponse),
            400: inline_sentry_response_serializer("Err", TypedErrorBody),
        },
    )
    def get(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    mismatches = _run(source)
    assert len(mismatches) == 1
    assert mismatches[0].decl == frozenset({"FooResponse", "TypedErrorBody"})
    assert mismatches[0].annot == frozenset({"FooResponse"})


def test_linter_is_name_agnostic_about_typeddicts() -> None:
    """The linter must not special-case any TypedDict name (no DetailResponse
    skip, no shape-based heuristics). It compares the sets of names as-is."""
    source = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class DetailResponse(TypedDict):
    detail: str

class FooEndpoint:
    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response[FooResponse] | Response[DetailResponse]:
        return Response({"x": 1})
"""
    # decorator set = {FooResponse}, annotation set = {FooResponse, DetailResponse}
    # {FooResponse} ⊆ {FooResponse, DetailResponse} → passes
    # Critically: the linter passes NOT because it special-cases DetailResponse,
    # but because the subset rule accepts any extra annotation arm.
    assert _run(source) == []

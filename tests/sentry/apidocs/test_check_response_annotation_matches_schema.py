from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from sentry.apidocs._check_response_annotation_matches_schema import (
    Mismatch,
    PublicUntyped,
    check_file,
    check_file_public_typed,
    main,
)


def _run_public(source: str) -> list[PublicUntyped]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(source)
        path = Path(f.name)
    try:
        return check_file_public_typed(path)
    finally:
        path.unlink()


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


# ---------------------------------------------------------------------------
# PUBLIC-must-be-typed check
# ---------------------------------------------------------------------------


def test_public_bare_response_fires() -> None:
    source = """
from rest_framework.response import Response

class FooEndpoint:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response:
        return Response()
"""
    diags = _run_public(source)
    assert len(diags) == 1
    assert diags[0].method == "get"
    assert diags[0].reason == "bare-Response"
    assert "PUBLIC but annotated with bare `Response`" in str(diags[0])
    assert "Fix by replacing the annotation with one of" in str(diags[0])


def test_public_missing_annotation_fires() -> None:
    source = """
from rest_framework.response import Response

class FooEndpoint:
    publish_status = {"POST": ApiPublishStatus.PUBLIC}
    def post(self):
        return Response()
"""
    diags = _run_public(source)
    assert len(diags) == 1
    assert diags[0].method == "post"
    assert diags[0].reason == "missing"
    assert "PUBLIC but has no return annotation" in str(diags[0])


def test_public_response_t_passes() -> None:
    source = """
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    assert _run_public(source) == []


def test_public_union_with_response_arms_passes() -> None:
    source = """
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class DetailResponse(TypedDict):
    detail: str

class FooEndpoint:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response[FooResponse] | Response[DetailResponse]:
        return Response({"x": 1})
"""
    assert _run_public(source) == []


def test_public_non_drf_response_annotation_passes() -> None:
    """Endpoints that legitimately return a Django HttpResponse subclass
    (e.g. StreamingHttpResponse, FileResponse, or `http_method_not_allowed`)
    don't have a DRF `Response[T]` to type — the explicit non-`Response`
    annotation is the documented return shape."""
    source = """
from django.http.response import HttpResponseBase

class FooEndpoint:
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}
    def put(self) -> HttpResponseBase:
        return self.http_method_not_allowed(None)
"""
    assert _run_public(source) == []


def test_public_response_t_with_streaming_arm_passes() -> None:
    """Mixed unions of Response[T] arms with non-`Response` arms (e.g. the
    `?download` paths that stream a binary body) are accepted — what matters
    is that no bare `Response` arm appears."""
    source = """
from typing import TypedDict
from django.http import StreamingHttpResponse
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response[FooResponse] | StreamingHttpResponse:
        return Response({"x": 1})
"""
    assert _run_public(source) == []


def test_private_bare_response_does_not_fire() -> None:
    """Only PUBLIC methods are linted — PRIVATE/EXPERIMENTAL endpoints stay
    in the unmigrated state without diagnostic."""
    source = """
from rest_framework.response import Response

class FooEndpoint:
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    def get(self) -> Response:
        return Response()
"""
    assert _run_public(source) == []


def test_method_outside_publish_status_does_not_fire() -> None:
    """`publish_status` only declares some methods; ones not in the dict
    (e.g. helper methods that share an HTTP-method name on a non-endpoint
    class) aren't linted."""
    source = """
from rest_framework.response import Response

class FooEndpoint:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response[dict]:
        return Response({})
    def post(self) -> Response:
        return Response()
"""
    # `post` isn't in publish_status — skipped.
    assert _run_public(source) == []


def test_class_without_publish_status_skipped() -> None:
    """Non-endpoint classes (helpers, mixins, validators) don't have a
    `publish_status` dict — they're not checked."""
    source = """
from rest_framework.response import Response

class SomeMixin:
    def get(self) -> Response:
        return Response()
"""
    assert _run_public(source) == []


def test_public_bare_response_under_future_annotations_fires() -> None:
    """`from __future__ import annotations` (PEP 563) defers annotation
    evaluation *at runtime* — `__annotations__` stores strings instead of
    resolved types — but `ast.parse()` still produces full expression nodes
    for them. The bare-`Response` check walks the AST, not runtime
    `__annotations__`, so the future import is a no-op for this linter."""
    source = """
from __future__ import annotations
from rest_framework.response import Response

class FooEndpoint:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response:
        return Response()
"""
    diags = _run_public(source)
    assert len(diags) == 1
    assert diags[0].reason == "bare-Response"


def test_main_emits_both_diagnostics(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """The unified `main` runs both checks and exit-codes non-zero on either."""
    src = """
from typing import TypedDict
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from sentry.apidocs.utils import inline_sentry_response_serializer

class FooResponse(TypedDict):
    x: int

class FooEndpoint:
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "POST": ApiPublishStatus.PUBLIC}

    @extend_schema(
        responses={200: inline_sentry_response_serializer("Foo", FooResponse)},
    )
    def get(self) -> Response:
        return Response({"x": 1})

    def post(self) -> Response[FooResponse]:
        return Response({"x": 1})
"""
    path = tmp_path / "endpoints.py"
    path.write_text(src)
    rc = main(["check", str(path)])
    assert rc == 1
    captured = capsys.readouterr()
    # The PUBLIC-untyped diagnostic for `get` should appear.
    assert "FooEndpoint.get: is PUBLIC but annotated with bare `Response`" in captured.out
    # `post` is correctly typed → no diagnostic for it.
    assert "FooEndpoint.post:" not in captured.out

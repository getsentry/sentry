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
    assert m.status == 200
    assert m.decl == "FooResponse"
    assert m.annot == "BarResponse"


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
    """Non-inline_sentry_response_serializer entries (e.g. RESPONSE_BAD_REQUEST)
    are not comparable and must not produce false positives.
    """
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


def test_only_2xx_entries_compared() -> None:
    """Even if a 4xx/5xx entry used inline_sentry_response_serializer (unusual),
    it should not be compared to the success-path annotation.
    """
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
    assert mismatches[0].decl == "FooResponse"
    assert mismatches[0].annot == "BarResponse"


def test_dotted_response_annotation_handled() -> None:
    """Some files write the annotation as `rest_framework.response.Response[T]`.
    The linter must extract T from both `Name` and `Attribute` forms.
    """
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
    assert mismatches[0].decl == "FooResponse"
    assert mismatches[0].annot == "BarResponse"


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

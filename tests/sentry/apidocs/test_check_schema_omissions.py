from __future__ import annotations

import tempfile
from pathlib import Path

from sentry.apidocs._check_schema_omissions import Diagnostic, check_file


def _run(source: str) -> list[Diagnostic]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(source)
        path = Path(f.name)
    try:
        diagnostics, _ = check_file(path)
        return diagnostics
    finally:
        path.unlink()


def test_bare_exclude_fields_is_rejected() -> None:
    out = _run(
        """
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

@extend_schema_serializer(exclude_fields=["secret"])
class S(serializers.Serializer):
    secret = serializers.CharField()
"""
    )
    assert len(out) == 1
    assert "no recorded reason" in out[0].message
    assert "omit_from_public_schema" in out[0].message


def test_string_valued_exclude_fields_is_rejected() -> None:
    # a bare string only ever "worked" by substring match
    out = _run(
        """
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

@extend_schema_serializer(exclude_fields="secret")
class S(serializers.Serializer):
    secret = serializers.CharField()
"""
    )
    assert len(out) == 1


def test_omission_with_a_reason_passes() -> None:
    out = _run(
        """
from sentry.apidocs.omissions import sentry_schema_serializer
from rest_framework import serializers

@sentry_schema_serializer(omit_from_public_schema={"secret": "Internal, not public surface."})
class S(serializers.Serializer):
    secret = serializers.CharField()
"""
    )
    assert out == []


def test_blank_reason_is_rejected() -> None:
    out = _run(
        """
from sentry.apidocs.omissions import sentry_schema_serializer
from rest_framework import serializers

@sentry_schema_serializer(omit_from_public_schema={"secret": "   "})
class S(serializers.Serializer):
    secret = serializers.CharField()
"""
    )
    assert len(out) == 1
    assert "needs a reason" in out[0].message


def test_entry_naming_a_nonexistent_field_is_reported() -> None:
    out = _run(
        """
from sentry.apidocs.omissions import sentry_schema_serializer
from rest_framework import serializers

@sentry_schema_serializer(omit_from_public_schema={"ghost": "Internal, not public surface."})
class S(serializers.Serializer):
    real = serializers.CharField()
"""
    )
    assert len(out) == 1
    assert "names no field" in out[0].message


def test_field_inherited_from_an_in_file_base_is_found() -> None:
    out = _run(
        """
from sentry.apidocs.omissions import sentry_schema_serializer
from rest_framework import serializers

class Base(serializers.Serializer):
    inherited = serializers.CharField()

@sentry_schema_serializer(omit_from_public_schema={"inherited": "Internal, not public surface."})
class S(Base):
    own = serializers.CharField()
"""
    )
    assert out == []


def test_class_with_an_out_of_file_base_skips_the_existence_check() -> None:
    # we cannot enumerate fields we cannot see, so do not guess
    out = _run(
        """
from sentry.apidocs.omissions import sentry_schema_serializer
from elsewhere import SomeBase

@sentry_schema_serializer(omit_from_public_schema={"unknown": "Internal, not public surface."})
class S(SomeBase):
    pass
"""
    )
    assert out == []


def test_typeddict_response_keys_are_checked() -> None:
    out = _run(
        """
from typing import TypedDict
from sentry.apidocs.omissions import sentry_schema_serializer

@sentry_schema_serializer(omit_from_public_schema={"ghost": "Internal."})
class R(TypedDict):
    real: str
"""
    )
    assert len(out) == 1
    assert "names no field" in out[0].message


def test_meta_fields_all_skips_the_existence_check() -> None:
    # Meta.fields = "__all__" means the field set comes from the model
    out = _run(
        """
from sentry.apidocs.omissions import sentry_schema_serializer
from rest_framework import serializers

@sentry_schema_serializer(omit_from_public_schema={"from_model": "Internal."})
class S(serializers.Serializer):
    class Meta:
        fields = "__all__"
"""
    )
    assert out == []


def test_meta_fields_list_is_enumerated() -> None:
    out = _run(
        """
from sentry.apidocs.omissions import sentry_schema_serializer
from rest_framework import serializers

@sentry_schema_serializer(omit_from_public_schema={"ghost": "Internal."})
class S(serializers.Serializer):
    class Meta:
        fields = ["real", "other"]
"""
    )
    assert len(out) == 1
    assert "names no field" in out[0].message


def test_nested_class_does_not_shadow_a_top_level_one() -> None:
    # `Inner` nested inside Holder must not be mistaken for a base named Inner
    out = _run(
        """
from sentry.apidocs.omissions import sentry_schema_serializer
from rest_framework import serializers

class Inner(serializers.Serializer):
    real = serializers.CharField()

class Holder:
    class Inner(serializers.Serializer):
        decoy = serializers.CharField()

@sentry_schema_serializer(omit_from_public_schema={"real": "Internal."})
class S(Inner):
    pass
"""
    )
    assert out == []

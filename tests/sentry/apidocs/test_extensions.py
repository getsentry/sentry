from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Literal, TypedDict
from unittest import mock

import pytest
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import extend_schema_serializer
from openapi_schema_validator import OAS30Validator
from rest_framework import serializers

from sentry.api.serializers import Serializer
from sentry.apidocs.extensions import (
    RestrictedJsonFieldExtension,
    SentryInlineResponseSerializerExtension,
    SentryResponseSerializerExtension,
)
from sentry.apidocs.utils import inline_sentry_response_serializer


class NestedDict(TypedDict):
    zz: str


class UnionSuccess(TypedDict):
    status: Literal["success"]
    url: str


class UnionFailure(TypedDict):
    status: Literal["failure"]
    reason: str


class BasicSerializerOptional(TypedDict, total=False):
    a: int


@extend_schema_serializer(exclude_fields=["excluded"])
class BasicSerializerResponse(BasicSerializerOptional):
    b: str
    c: bool
    d: list[int]
    e: NestedDict
    f: Literal[3]
    g: str | bool
    h: str | None
    i: int | float | None
    excluded: str


class BasicSerializer(Serializer):
    def serialize(
        self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> BasicSerializerResponse:
        raise NotImplementedError


class FailSerializer(Serializer):
    def serialize(self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any):
        raise NotImplementedError


def test_sentry_response_serializer_extension() -> None:
    seralizer_extension = SentryResponseSerializerExtension(BasicSerializer)
    schema = seralizer_extension.map_serializer(AutoSchema(), "response")
    assert schema == {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "string"},
            "c": {"type": "boolean"},
            "d": {"type": "array", "items": {"type": "integer"}},
            "e": {"type": "object", "properties": {"zz": {"type": "string"}}, "required": ["zz"]},
            "f": {"enum": [3], "type": "integer"},
            # Test that a Union generates an anyOf
            "g": {"anyOf": [{"type": "string"}, {"type": "boolean"}]},
            # Test that including None with a 2 type Union adds nullable: True
            # but does not create an anyOf
            "h": {"type": "string", "nullable": True},
            # Test that including None with a >2 type Union does not add nullable: True
            # but includes {type: "object", nullable: True} in the anyOf
            "i": {
                "anyOf": [
                    {"type": "integer"},
                    {"format": "double", "type": "number"},
                    {"type": "object", "nullable": True},
                ]
            },
        },
        "required": ["b", "c", "d", "e", "f", "g", "h", "i"],
    }


def test_sentry_inline_response_serializer_extension() -> None:
    inline_serializer = inline_sentry_response_serializer(
        "BasicStuff", list[BasicSerializerResponse]
    )
    seralizer_extension = SentryInlineResponseSerializerExtension(inline_serializer)
    schema = seralizer_extension.map_serializer(AutoSchema(), "response")

    assert schema == {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "a": {"type": "integer"},
                "b": {"type": "string"},
                "c": {"type": "boolean"},
                "d": {"type": "array", "items": {"type": "integer"}},
                "e": {
                    "type": "object",
                    "properties": {"zz": {"type": "string"}},
                    "required": ["zz"],
                },
                "f": {"enum": [3], "type": "integer"},
                # Test that a Union generates an anyOf
                "g": {"anyOf": [{"type": "string"}, {"type": "boolean"}]},
                # Test that including None with a 2 type Union adds nullable: True
                # but does not create an anyOf
                "h": {"type": "string", "nullable": True},
                # Test that including None with a >2 type Union does not add nullable: True
                # but includes {type: "object", nullable: True} in the anyOf
                "i": {
                    "anyOf": [
                        {"type": "integer"},
                        {"format": "double", "type": "number"},
                        {"type": "object", "nullable": True},
                    ]
                },
            },
            "required": ["b", "c", "d", "e", "f", "g", "h", "i"],
        },
    }


def test_sentry_fails_when_serializer_not_typed() -> None:
    seralizer_extension = SentryResponseSerializerExtension(FailSerializer)
    with pytest.raises(TypeError):
        seralizer_extension.map_serializer(AutoSchema(), "response")


def test_sentry_restricted_json_field_extension() -> None:
    seralizer_extension = RestrictedJsonFieldExtension(serializers.JSONField)
    schema = seralizer_extension.map_serializer_field(AutoSchema(), "response")
    assert schema == {"type": "object", "additionalProperties": {}}


@pytest.mark.parametrize(
    "value, valid",
    [
        (None, True),
        ({"status": "success", "url": "https://example.com"}, True),
        ({"status": "failure", "reason": "unavailable"}, True),
        ({}, False),
        ({"unexpected": True}, False),
        ({"status": "success", "reason": "unavailable"}, False),
        ({"status": "failure", "reason": "unavailable", "extra": True}, False),
        ("success", False),
    ],
)
@mock.patch.dict(os.environ, SENTRY_OPENAPI_INTERNAL="1")
def test_internal_nullable_union(value: Any, valid: bool) -> None:
    serializer = inline_sentry_response_serializer(
        "NullableUnion", UnionSuccess | UnionFailure | None
    )
    schema = SentryInlineResponseSerializerExtension(serializer).map_serializer(
        AutoSchema(), "response"
    )

    assert schema["anyOf"][-1] == {"type": "object", "nullable": True, "enum": [None]}
    OAS30Validator.check_schema(schema)
    assert OAS30Validator(schema).is_valid(value) is valid


@mock.patch.dict(os.environ, SENTRY_OPENAPI_INTERNAL="1")
def test_internal_nullable_numeric_union() -> None:
    serializer = inline_sentry_response_serializer("NullableNumber", int | float | None)
    schema = SentryInlineResponseSerializerExtension(serializer).map_serializer(
        AutoSchema(), "response"
    )

    OAS30Validator.check_schema(schema)
    validator = OAS30Validator(schema)
    assert validator.is_valid(None)
    assert validator.is_valid(1)
    assert validator.is_valid(1.5)
    assert not validator.is_valid({})


@mock.patch.dict(os.environ, SENTRY_OPENAPI_INTERNAL="1")
def test_internal_nullable_dictionary() -> None:
    serializer = inline_sentry_response_serializer("NullableDictionary", dict[str, Any] | None)
    schema = SentryInlineResponseSerializerExtension(serializer).map_serializer(
        AutoSchema(), "response"
    )

    validator = OAS30Validator(schema)
    assert validator.is_valid(None)
    assert validator.is_valid({"arbitrary": True})
    assert "enum" not in schema

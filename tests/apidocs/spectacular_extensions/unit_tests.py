from __future__ import annotations

from typing import List, Optional, Union

import pytest
from drf_spectacular.utils import extend_schema_serializer
from typing_extensions import Literal, TypedDict

from sentry.api.serializers import Serializer
from sentry.apidocs.extensions import (
    SentryInlineResponseSerializerExtension,
    SentryResponseSerializerExtension,
)
from sentry.apidocs.utils import inline_sentry_response_serializer


class NestedDict(TypedDict):
    zz: str


class BasicSerializerOptional(TypedDict, total=False):
    a: int


@extend_schema_serializer(exclude_fields=["excluded"])
class BasicSerializerResponse(BasicSerializerOptional):
    b: str
    c: bool
    d: List[int]
    e: NestedDict
    f: Literal[3]
    g: Union[str, bool]
    h: Optional[str]
    excluded: str


class BasicSerializer(Serializer):
    def serialize() -> BasicSerializerResponse:
        return {"a": 1, "b": "test", "c": True, "d": [1], "e": {"zz": "test"}}


class FailSerializer(Serializer):
    def serialize():
        return {"a": 1, "b": "test", "c": True, "d": [1], "e": {"zz": "test"}}


def test_sentry_response_serializer_extension():
    seralizer_extension = SentryResponseSerializerExtension(BasicSerializer)
    schema = seralizer_extension.map_serializer(None, None)
    assert schema == {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "string"},
            "c": {"type": "boolean"},
            "d": {"type": "array", "items": {"type": "integer"}},
            "e": {"type": "object", "properties": {"zz": {"type": "string"}}, "required": ["zz"]},
            "f": {"enum": [3], "type": "integer"},
            "g": {"oneOf": [{"type": "string"}, {"type": "boolean"}]},
            "h": {"type": "string", "nullable": True},
        },
        "required": ["b", "c", "d", "e", "f", "g", "h"],
    }


def test_sentry_inline_response_serializer_extension():
    inline_serializer = inline_sentry_response_serializer(
        "BasicStuff", List[BasicSerializerResponse]
    )
    seralizer_extension = SentryInlineResponseSerializerExtension(inline_serializer)
    schema = seralizer_extension.map_serializer(None, None)

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
                "g": {"oneOf": [{"type": "string"}, {"type": "boolean"}]},
                "h": {"type": "string", "nullable": True},
            },
            "required": ["b", "c", "d", "e", "f", "g", "h"],
        },
    }


def test_sentry_fails_when_serializer_not_typed():
    seralizer_extension = SentryResponseSerializerExtension(FailSerializer)
    with pytest.raises(TypeError):
        seralizer_extension.map_serializer(None, None)

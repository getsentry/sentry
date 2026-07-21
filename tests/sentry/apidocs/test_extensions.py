from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, TypedDict
from unittest.mock import patch

import pytest
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.api.serializers import Serializer
from sentry.api.serializers.models.group import GroupDetailsResponse
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnubaResponse
from sentry.apidocs.extensions import (
    RestrictedJsonFieldExtension,
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


@patch.dict("os.environ", {"OPENAPIGENERATE": "1"})
def test_issue_responses_document_feedback_metadata() -> None:
    detail_serializer = inline_sentry_response_serializer("IssueDetail", GroupDetailsResponse)
    detail_schema = SentryInlineResponseSerializerExtension(detail_serializer).map_serializer(
        AutoSchema(), "response"
    )
    list_serializer = inline_sentry_response_serializer(
        "IssueList", list[StreamGroupSerializerSnubaResponse]
    )
    list_schema = SentryInlineResponseSerializerExtension(list_serializer).map_serializer(
        AutoSchema(), "response"
    )
    metadata_schemas = [
        detail_schema["properties"]["metadata"],
        list_schema["items"]["properties"]["metadata"],
    ]

    for metadata_schema in metadata_schemas:
        assert metadata_schema["anyOf"][0] == {
            "type": "object",
            "additionalProperties": {},
        }
        feedback_schema = metadata_schema["anyOf"][1]

        assert set(feedback_schema["properties"]) == {
            "associated_event_id",
            "contact_email",
            "initial_priority",
            "message",
            "name",
            "sdk",
            "source",
            "summary",
            "title",
            "value",
        }
        assert set(feedback_schema["required"]) == {
            "contact_email",
            "message",
            "name",
            "title",
            "value",
        }
        assert feedback_schema["properties"]["initial_priority"] == {"type": "integer"}
        assert feedback_schema["properties"]["contact_email"] == {
            "type": "string",
            "nullable": True,
        }
        assert feedback_schema["properties"]["name"] == {
            "type": "string",
            "nullable": True,
        }
        assert feedback_schema["properties"]["sdk"]["properties"] == {
            "name": {"type": "string"},
            "name_normalized": {"type": "string"},
        }
        assert feedback_schema["properties"]["sdk"]["required"] == [
            "name",
            "name_normalized",
        ]


def test_sentry_fails_when_serializer_not_typed() -> None:
    seralizer_extension = SentryResponseSerializerExtension(FailSerializer)
    with pytest.raises(TypeError):
        seralizer_extension.map_serializer(AutoSchema(), "response")


def test_sentry_restricted_json_field_extension() -> None:
    seralizer_extension = RestrictedJsonFieldExtension(serializers.JSONField)
    schema = seralizer_extension.map_serializer_field(AutoSchema(), "response")
    assert schema == {"type": "object", "additionalProperties": {}}

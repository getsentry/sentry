from __future__ import annotations

from collections.abc import Mapping
from enum import Enum
from typing import Any, Literal, TypedDict

import pytest
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import extend_schema, extend_schema_serializer
from openapi_schema_validator import OAS30Validator
from rest_framework import serializers

from sentry.api.base import Endpoint
from sentry.api.serializers import Serializer
from sentry.apidocs.extensions import (
    RestrictedJsonFieldExtension,
    SentryInlineResponseSerializerExtension,
    SentryResponseSerializerExtension,
)
from sentry.apidocs.spectacular_ports import resolve_type_hint
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.organization_investigation_block_details import (
    OrganizationInvestigationBlockDetailsEndpoint,
)
from sentry.investigations.endpoints.organization_investigation_block_execution_details import (
    OrganizationInvestigationBlockExecutionDetailsEndpoint,
)
from sentry.investigations.endpoints.schema import InvestigationSchema
from sentry.investigations.endpoints.validators.investigation import InvestigationCreateValidator
from sentry.investigations.endpoints.validators.orchestration import (
    InvestigationOrchestrationCommandValidator,
)
from sentry.notebooks.endpoints.validators.block import BlockExecutionResumeValidator
from tests.sentry.apidocs import generate_schema


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


def test_enum_literal_schema() -> None:
    class Status(Enum):
        QUEUED = "queued"
        RUNNING = "running"
        FAILED = "failed"

    assert resolve_type_hint(Literal[Status.QUEUED, Status.RUNNING] | None) == {
        "enum": ["queued", "running"],
        "type": "string",
        "nullable": True,
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
    "payload,valid",
    [
        ({"inputId": "question-1", "responseData": "production"}, True),
        ({"inputId": "question-1", "responseData": None}, True),
        ({"inputId": "question-1", "responseData": [1, {"camelKey": True}]}, True),
        ({"inputId": "question-1"}, False),
        ({"responseData": "production"}, False),
        ({"inputId": "question-1", "responseData": {}, "typo": True}, False),
    ],
)
def test_investigation_resume_schema_matches_validation(
    payload: dict[str, Any], valid: bool
) -> None:
    schema = generate_schema(
        "executions/<execution_id>/", view=OrganizationInvestigationBlockExecutionDetailsEndpoint
    )
    request_schema = schema["paths"]["/executions/{execution_id}/"]["patch"]["requestBody"][
        "content"
    ]["application/json"]["schema"]
    validator = OAS30Validator({**request_schema, "components": schema["components"]})
    assert validator.is_valid(payload) is valid
    assert BlockExecutionResumeValidator(data=payload).is_valid() is valid


def test_investigation_delete_schema_requires_camel_case_versions() -> None:
    schema = generate_schema(
        "blocks/<block_id>/", view=OrganizationInvestigationBlockDetailsEndpoint
    )
    request = schema["paths"]["/blocks/{block_id}/"]["delete"]["requestBody"]
    assert request["required"] is True
    validator = OAS30Validator(
        {**request["content"]["application/json"]["schema"], "components": schema["components"]}
    )
    assert validator.is_valid({"investigationVersion": 1, "version": 1})
    assert not validator.is_valid({"version": 1})
    assert not validator.is_valid({"investigationVersion": 1})
    assert not validator.is_valid({"investigation_version": 1, "version": 1})


@pytest.mark.parametrize(
    "serializer,payload,valid",
    [
        (
            InvestigationCreateValidator,
            {"source": {"type": "manual", "seed": {"nestedKey": 1}}},
            True,
        ),
        (
            InvestigationCreateValidator,
            {"source": {"type": "metric_open_period", "ref": {"groupId": 1, "openPeriodId": 2}}},
            True,
        ),
        (InvestigationCreateValidator, {"source": {"type": "metric_open_period"}}, False),
        (InvestigationCreateValidator, {"source": {"type": "unsupported"}}, False),
        (
            InvestigationOrchestrationCommandValidator,
            {
                "requestId": "00000000-0000-4000-8000-000000000001",
                "expectedWorkflowVersion": 1,
                "command": {
                    "type": "add_hypothesis",
                    "statement": "A deployment increased latency",
                },
            },
            True,
        ),
        (
            InvestigationOrchestrationCommandValidator,
            {
                "requestId": "00000000-0000-4000-8000-000000000001",
                "expectedWorkflowVersion": 1,
                "command": {"type": "add_hypothesis"},
            },
            False,
        ),
    ],
)
def test_investigation_polymorphic_requests_match_validation(serializer, payload, valid) -> None:
    class ExampleEndpoint(Endpoint):
        permission_classes = ()
        schema = InvestigationSchema()

        @extend_schema(request=serializer, responses={204: None})
        def post(self, request):
            pass

    schema = generate_schema("investigations/", view=ExampleEndpoint)
    request_schema = schema["paths"]["/investigations/"]["post"]["requestBody"]["content"][
        "application/json"
    ]["schema"]
    validator = OAS30Validator({**request_schema, "components": schema["components"]})
    assert validator.is_valid(payload) is valid
    assert serializer(data=payload).is_valid() is valid

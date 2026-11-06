from __future__ import annotations

from collections.abc import Mapping
from enum import Enum
from typing import Annotated, Any, Literal, NotRequired, ReadOnly, Required, TypedDict

import pytest
from django.http import HttpRequest
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.settings import patched_settings
from drf_spectacular.utils import extend_schema, extend_schema_serializer
from jsonschema.exceptions import ValidationError
from openapi_schema_validator import OAS30Validator
from rest_framework import serializers

from sentry.api.base import Endpoint
from sentry.api.endpoints.organization_events_timeseries import OrganizationEventsTimeseriesEndpoint
from sentry.api.serializers import Serializer
from sentry.apidocs.examples.discover_performance_examples import DiscoverAndPerformanceExamples
from sentry.apidocs.extensions import (
    RestrictedJsonFieldExtension,
    SentryInlineResponseSerializerExtension,
    SentryResponseSerializerExtension,
)
from sentry.apidocs.spectacular_ports import resolve_type_hint
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.organization_investigation_block_execution_details import (
    OrganizationInvestigationBlockExecutionDetailsEndpoint,
)
from sentry.investigations.endpoints.validators.investigation import InvestigationCreateValidator
from sentry.investigations.endpoints.validators.orchestration import (
    InvestigationOrchestrationCommandValidator,
)
from sentry.notebooks.endpoints.organization_investigation_block_details import (
    OrganizationInvestigationBlockDetailsEndpoint,
)
from sentry.notebooks.endpoints.schema import InvestigationSchema
from sentry.notebooks.endpoints.validators.block import BlockExecutionResumeValidator
from tests.sentry.apidocs import generate_schema


@pytest.fixture
def events_timeseries_schema() -> dict[str, Any]:
    with patched_settings(
        {"POSTPROCESSING_HOOKS": ["sentry.apidocs.hooks.custom_postprocessing_hook"]}
    ):
        return generate_schema(
            "api/0/organizations/<organization_id_or_slug>/events-timeseries/",
            view=OrganizationEventsTimeseriesEndpoint,
        )


def test_events_timeseries_query_contract(events_timeseries_schema: dict[str, Any]) -> None:
    operation = events_timeseries_schema["paths"][
        "/api/0/organizations/{organization_id_or_slug}/events-timeseries/"
    ]["get"]
    parameters = {parameter["name"]: parameter for parameter in operation["parameters"]}

    assert parameters["interval"]["schema"]["type"] == "string"
    assert parameters["yAxis"]["schema"] == {"type": "array", "items": {"type": "string"}}
    assert parameters["yAxis"]["style"] == "form"
    assert parameters["yAxis"]["explode"] is True
    transformations = parameters["transformations"]
    assert transformations.get("required", False) is False
    assert transformations["style"] == "deepObject"
    assert transformations["explode"] is True
    assert transformations["schema"] == {
        "type": "object",
        "additionalProperties": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 2,
        },
    }
    OAS30Validator(transformations["schema"]).validate(
        {"0": ["fill(locf)", "smooth(sma,3)"], "12": ["smooth(asap)"]}
    )


def test_events_timeseries_response_contract(events_timeseries_schema: dict[str, Any]) -> None:
    response = events_timeseries_schema["components"]["schemas"][
        "OrganizationEventsTimeseriesResponse"
    ]
    validator = OAS30Validator(response)
    validator.validate({"timeSeries": []})
    for example in DiscoverAndPerformanceExamples.QUERY_TIMESERIES:
        validator.validate(example.value)
    validator.validate(
        {
            "timeSeries": [
                {
                    "yAxis": "count()",
                    "groupBy": [{"key": "flag", "value": True}],
                    "meta": {"valueType": "number", "valueUnit": None, "interval": 60000},
                    "values": [
                        {
                            "timestamp": 0,
                            "value": None,
                            "incomplete": False,
                            "comparisonValue": None,
                            "filled": False,
                            "smoothed": False,
                            "comparisonFilled": True,
                            "comparisonSmoothed": True,
                            "sampleCount": None,
                            "sampleRate": None,
                            "confidence": None,
                        },
                        {"timestamp": 60000, "value": 0, "incomplete": False},
                    ],
                },
                {
                    "yAxis": "count()",
                    "groupBy": None,
                    "meta": {
                        "valueType": "number",
                        "valueUnit": None,
                        "interval": 60000,
                        "isOther": True,
                    },
                    "values": [],
                },
            ]
        }
    )
    series = response["properties"]["timeSeries"]["items"]
    point = series["properties"]["values"]["items"]
    assert "groupBy" not in series["required"]
    assert "sampleCount" not in point["required"]
    assert point["properties"]["sampleCount"]["nullable"] is True
    assert point["properties"]["value"]["nullable"] is True
    for flag in ("filled", "smoothed", "comparisonFilled", "comparisonSmoothed"):
        assert point["properties"][flag]["type"] == "boolean"
        assert flag not in point["required"]
    assert "comparisonValue" not in point["required"]
    assert "value" in point["required"]
    with pytest.raises(ValidationError):
        validator.validate({"timeSeries": [{"yAxis": "count()", "values": []}]})


def test_null_only_response_field() -> None:
    schema = resolve_type_hint(type(None))
    validator = OAS30Validator(schema)

    validator.validate(None)
    with pytest.raises(ValidationError):
        validator.validate("123")
    with pytest.raises(ValidationError):
        validator.validate({})


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


FailSerializer = type(
    "FailSerializer",
    (Serializer,),
    {
        "serialize": lambda self, obj, attrs, user, **kwargs: (_ for _ in ()).throw(
            NotImplementedError()
        )
    },
)


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


class ItemQualifiersResponse(TypedDict):
    plain: str
    not_required: NotRequired[str]
    annotated: NotRequired[Annotated[str, "meta"]]
    read_only: ReadOnly[NotRequired[str]]


class PartialResponse(TypedDict, total=False):
    plain: str
    required: Required[str]


class InheritedQualifiersResponse(PartialResponse):
    child_plain: str
    child_not_required: NotRequired[str]


def test_typed_dict_item_qualifiers_with_postponed_annotations() -> None:
    # This module uses `from __future__ import annotations`, under which
    # `__required_keys__` ignores Required and NotRequired.
    assert resolve_type_hint(ItemQualifiersResponse) == {
        "type": "object",
        "properties": {
            "plain": {"type": "string"},
            "not_required": {"type": "string"},
            "annotated": {"type": "string"},
            "read_only": {"type": "string"},
        },
        "required": ["plain"],
    }
    assert resolve_type_hint(PartialResponse)["required"] == ["required"]
    assert resolve_type_hint(InheritedQualifiersResponse)["required"] == [
        "child_plain",
        "required",
    ]


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
def test_investigation_polymorphic_requests_match_validation(
    serializer: type[serializers.Serializer], payload: dict[str, object], valid: bool
) -> None:
    class ExampleEndpoint(Endpoint):
        permission_classes = ()
        schema = InvestigationSchema()

        @extend_schema(request=serializer, responses={204: None})
        def post(self, request: HttpRequest) -> None:
            pass

    schema = generate_schema("investigations/", view=ExampleEndpoint)
    request_schema = schema["paths"]["/investigations/"]["post"]["requestBody"]["content"][
        "application/json"
    ]["schema"]
    validator = OAS30Validator({**request_schema, "components": schema["components"]})
    assert validator.is_valid(payload) is valid
    assert serializer(data=payload).is_valid() is valid

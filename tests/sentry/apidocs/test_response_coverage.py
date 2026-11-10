import os
from collections.abc import Iterator
from typing import Annotated, Any, TypedDict
from unittest import mock

import pytest

from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import JsonValue
from sentry.apidocs.response_coverage import (
    CYCLE,
    FIELD_SOURCE,
    JSON_VALUE,
    find_violations,
    has_field_sources,
)
from sentry.apidocs.spectacular_ports import resolve_type_hint


class ItemResponse(TypedDict):
    id: Annotated[str, ApiDescription("The item ID")]
    name: str
    extra: Annotated[dict[str, Any], ApiDescription("Free-form data")]


def _spec(
    responses: list[dict[str, Any]], components: dict[str, Any] | None = None
) -> dict[str, Any]:
    paths = {
        f"/items/{index}/": {
            "get": {"responses": {"200": {"content": {"application/json": {"schema": schema}}}}}
        }
        for index, schema in enumerate(responses)
    }
    return {"paths": paths, "components": {"schemas": components or {}}}


def _ref(name: str) -> dict[str, str]:
    return {"$ref": f"#/components/schemas/{name}"}


@pytest.fixture
def field_sources() -> Iterator[None]:
    with mock.patch.dict(os.environ, {"OPENAPIGENERATE": "1"}):
        yield


def test_typed_dict_fields_are_keyed_by_source(field_sources: None) -> None:
    item = resolve_type_hint(ItemResponse)
    source = f"{__name__}.ItemResponse"
    assert item["properties"]["name"][FIELD_SOURCE] == f"{source}.name"

    # Two components that inline the same TypedDict share its entries.
    spec = _spec(
        [_ref("ItemList"), _ref("ItemDetails")],
        {"ItemList": {"type": "array", "items": item}, "ItemDetails": item},
    )
    assert has_field_sources(spec)
    assert find_violations(spec) == {
        f"missing-description {source}.name",
        f"untyped {source}.extra",
    }


def test_fields_without_a_source_are_keyed_by_path() -> None:
    inline = {
        "type": "object",
        "properties": {
            "count": {"type": "integer"},
            "described": {"type": "integer", "description": "Has one"},
            "only_status": {"type": "string", "description": "  "},
        },
    }
    spec = _spec([inline], {"Unused": {"type": "object", "properties": {"x": {}}}})
    assert not has_field_sources(spec)
    assert find_violations(spec) == {
        "missing-description GET /items/0/ 200.count",
        "missing-description GET /items/0/ 200.only_status",
    }


def test_untyped_schemas() -> None:
    def prop(schema: dict[str, Any]) -> dict[str, Any]:
        return {**schema, "description": "Described"}

    root = {
        "type": "object",
        "properties": {
            "any": prop({}),
            "free_dict": prop({"type": "object", "additionalProperties": {}}),
            "open_object": prop({"type": "object", "additionalProperties": True}),
            "bare_object": prop({"type": "object", "nullable": True}),
            "any_list": prop({"type": "array", "items": {}}),
            "dict_list": prop({"type": "array", "items": {"type": "object"}}),
            "any_branch": prop({"anyOf": [{"type": "string"}, {}]}),
            "typed_map": prop({"type": "object", "additionalProperties": {"type": "integer"}}),
            "empty_object": prop({"type": "object", "maxProperties": 0}),
            "enum": prop({"enum": ["a", "b"]}),
            "union": prop({"oneOf": [{"type": "string"}, {"type": "integer"}]}),
            "reference": prop({"allOf": [_ref("Thing")], "nullable": True}),
        },
    }
    thing = {"type": "object", "properties": {"id": prop({"type": "string"})}}
    key = "GET /items/0/ 200"
    assert find_violations(_spec([root], {"Thing": thing})) == {
        f"untyped {key}.any",
        f"untyped {key}.free_dict",
        f"untyped {key}.open_object",
        f"untyped {key}.bare_object",
        f"untyped {key}.any_list[]",
        f"untyped {key}.dict_list[]",
        f"untyped {key}.any_branch<anyOf1>",
    }


def test_untyped_root_schema() -> None:
    assert find_violations(_spec([{}])) == {"untyped GET /items/0/ 200"}


class TreeResponse(TypedDict):
    name: Annotated[str, ApiDescription("Node name")]
    children: Annotated[list["TreeResponse"], ApiDescription("Child nodes")]


def test_recursive_typed_dict_is_typed(field_sources: None) -> None:
    tree = resolve_type_hint(TreeResponse)
    assert tree["properties"]["children"]["items"][CYCLE] is True
    assert find_violations(_spec([tree])) == set()


class JsonValueResponse(TypedDict):
    data: Annotated[JsonValue, ApiDescription("Data an SDK sent")]
    by_key: Annotated[dict[str, JsonValue], ApiDescription("Data an SDK sent, by key")]


def test_json_value_is_typed(field_sources: None) -> None:
    schema = resolve_type_hint(JsonValueResponse)
    assert schema["properties"]["data"][JSON_VALUE] is True
    assert find_violations(_spec([schema])) == set()


def test_reference_uses_component_description() -> None:
    root = {"type": "object", "properties": {"described": _ref("Described"), "bare": _ref("Bare")}}
    components = {
        "Described": {"type": "object", "description": "Docstring", "properties": {}},
        "Bare": {"type": "object", "properties": {"id": {"type": "string"}}},
    }
    assert find_violations(_spec([root], components)) == {
        "missing-description GET /items/0/ 200.bare",
        "untyped components/Described",
        "missing-description components/Bare.id",
    }


def test_only_success_responses_are_checked() -> None:
    undescribed = {"type": "object", "properties": {"detail": {"type": "string"}}}
    spec = {
        "paths": {
            "/items/": {
                "post": {
                    "requestBody": {"content": {"application/json": {"schema": undescribed}}},
                    "responses": {
                        "201": {"content": {"application/json": {"schema": {"type": "string"}}}},
                        "400": {"content": {"application/json": {"schema": undescribed}}},
                        "204": {"description": "No Content"},
                    },
                }
            }
        }
    }
    assert find_violations(spec) == set()


class BaseResponse(TypedDict):
    inherited: str


class DerivedResponse(BaseResponse):
    own: str


def test_inherited_field_is_keyed_by_declaring_typed_dict(field_sources: None) -> None:
    properties = resolve_type_hint(DerivedResponse)["properties"]
    assert properties["inherited"][FIELD_SOURCE] == f"{__name__}.BaseResponse.inherited"
    assert properties["own"][FIELD_SOURCE] == f"{__name__}.DerivedResponse.own"


def test_no_field_sources_outside_the_docs_build() -> None:
    with mock.patch.dict(os.environ):
        os.environ.pop("OPENAPIGENERATE", None)
        assert FIELD_SOURCE not in resolve_type_hint(ItemResponse)["properties"]["name"]
        assert CYCLE not in resolve_type_hint(TreeResponse)["properties"]["children"]["items"]
        assert JSON_VALUE not in resolve_type_hint(JsonValueResponse)["properties"]["data"]

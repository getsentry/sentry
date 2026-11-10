import pytest

from sentry.apidocs.json_schemas import UndescribedPropertyError, to_response_schema, union_schema
from sentry.uptime.endpoints.serializers import _assertion_schema

DEFINITIONS = {
    "Node": {
        "description": "A node",
        "type": "object",
        "properties": {
            "child_node": {"oneOf": [{"type": "null"}, {"$ref": "#/definitions/Node"}]},
            "kind": {"const": "node"},
            "label": {"type": ["string", "null"]},
        },
        "required": ["kind"],
    },
}


def test_inlines_definitions_and_cuts_cycles() -> None:
    schema = to_response_schema(
        {"$ref": "#/definitions/Node"},
        definitions=DEFINITIONS,
        descriptions={"Node.kind": "Kind of node", "Node.label": "Label of the node"},
    )
    assert schema == {
        "description": "A node",
        "type": "object",
        "properties": {
            "child_node": {
                "type": "object",
                "description": "A node. Its fields are the same as the one this is inside, "
                "so they're left out here.",
                "nullable": True,
            },
            "kind": {"enum": ["node"], "description": "Kind of node"},
            "label": {"type": "string", "nullable": True, "description": "Label of the node"},
        },
        "required": ["kind"],
    }


def test_undescribed_property_raises() -> None:
    with pytest.raises(UndescribedPropertyError, match="Node.kind"):
        to_response_schema({"$ref": "#/definitions/Node"}, definitions=DEFINITIONS)


def test_uptime_assertion_schema_describes_every_property() -> None:
    # Fails when sentry-kafka-schemas adds an assertion property that isn't described.
    assert _assertion_schema()["properties"]["root"]["anyOf"]


def test_camel_cases_keys_and_drops_validation_only_keywords() -> None:
    schema = to_response_schema(
        {
            "$defs": {"Name": {"type": "string", "description": "A name"}},
            "type": "object",
            "properties": {
                "first_name": {"$ref": "#/$defs/Name"},
                "nick_name": {"type": ["string", "null"], "optional": True},
            },
            "required": ["first_name"],
            "oneOf": [{"required": ["first_name"]}],
            "additionalProperties": False,
        },
        descriptions={"nick_name": "A nickname"},
        camel_case=True,
    )
    assert schema == {
        "type": "object",
        "properties": {
            "firstName": {"type": "string", "description": "A name"},
            "nickName": {"type": "string", "nullable": True, "description": "A nickname"},
        },
        "required": ["firstName"],
        "additionalProperties": False,
    }


def test_describes_nested_properties_by_path() -> None:
    schema = to_response_schema(
        {
            "type": "object",
            "properties": {
                "filters": {
                    "type": "array",
                    "items": {"type": "object", "properties": {"value": {"type": "string"}}},
                },
                "value": {"type": "integer"},
            },
        },
        descriptions={"filters": "Filters", "filters[].value": "Filter value", "value": "Value"},
    )
    assert schema["properties"]["filters"]["items"]["properties"]["value"]["description"] == (
        "Filter value"
    )
    assert schema["properties"]["value"]["description"] == "Value"


def test_empty_object_counts_as_typed() -> None:
    assert to_response_schema({"type": "object", "additionalProperties": False}) == {
        "type": "object",
        "additionalProperties": False,
        "maxProperties": 0,
    }


def test_union_schema_drops_duplicates() -> None:
    assert union_schema([{"type": "boolean"}, {"type": "boolean"}]) == {"type": "boolean"}
    assert union_schema([{"type": "boolean"}, {"type": "integer"}]) == {
        "anyOf": [{"type": "boolean"}, {"type": "integer"}]
    }


def test_tuple_items_become_a_union() -> None:
    schema = to_response_schema(
        {"type": "array", "items": [{"type": "string"}, {"anyOf": [{"type": "number"}]}]}
    )
    assert schema == {"type": "array", "items": {"anyOf": [{"type": "string"}, {"type": "number"}]}}

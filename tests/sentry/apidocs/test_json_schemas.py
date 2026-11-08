import pytest

from sentry.apidocs.json_schemas import UndescribedPropertyError, to_response_schema
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

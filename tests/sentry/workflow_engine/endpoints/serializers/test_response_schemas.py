from collections.abc import Callable, Iterator
from typing import Any

import pytest

from sentry.workflow_engine.endpoints.serializers import response_schemas
from sentry.workflow_engine.endpoints.serializers.action_handler_serializer import (
    JsonSchemaDocument,
)
from sentry.workflow_engine.registry import action_handler_registry


@pytest.mark.parametrize(
    "build",
    [
        response_schemas.condition_comparison_schema,
        response_schemas.action_config_schema,
        response_schemas.action_data_schema,
        response_schemas.detector_config_schema,
        response_schemas.workflow_config_schema,
    ],
)
def test_builds_fully_described_schema(build: Callable[[], dict[str, Any]]) -> None:
    # Raises UndescribedPropertyError when a handler or detector type adds a property
    # that the descriptions in response_schemas don't cover.
    assert build()


def _keyword_nodes(schema: dict[str, Any] | bool) -> Iterator[dict[str, Any]]:
    if isinstance(schema, bool):
        return
    yield schema
    for name, value in schema.items():
        if name == "properties":
            for prop in value.values():
                yield from _keyword_nodes(prop)
        elif name in ("items", "if", "then") and isinstance(value, dict):
            yield from _keyword_nodes(value)
        elif name == "allOf":
            for branch in value:
                yield from _keyword_nodes(branch)


def test_action_handler_schemas_match_json_schema_document() -> None:
    keywords = set(JsonSchemaDocument.__annotations__)
    for action_type, handler in action_handler_registry.registrations.items():
        for schema in (handler.config_schema, handler.data_schema):
            for node in _keyword_nodes(schema):
                unknown = set(node) - keywords
                assert not unknown, f"{action_type} uses {unknown}; add them to JsonSchemaDocument"
                assert isinstance(node.get("additionalProperties", False), bool)
                default = node.get("default")
                if isinstance(default, list):
                    assert all(isinstance(item, str) for item in default)
                elif isinstance(default, dict):
                    assert all(isinstance(item, str) for item in default.values())

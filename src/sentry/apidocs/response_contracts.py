from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict

from django.http.response import HttpResponseBase
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import ComponentRegistry

# Register the same serializer extensions used by the OpenAPI generation command.
from sentry.apidocs import extensions as _extensions  # noqa: F401
from sentry.apidocs.hooks import CustomEndpointEnumerator

_endpoint_enumerator = CustomEndpointEnumerator(patterns=[])


class OperationContract(TypedDict):
    operation_id: str
    responses: dict[str, dict[str, Any] | None]


def normalize_django_route(route: str) -> str:
    return _endpoint_enumerator.get_path_from_regex(route)


def get_runtime_operation_contract(
    callback: Callable[..., HttpResponseBase],
    path: str,
    path_regex: str,
    method: str,
) -> OperationContract | None:
    """Build one endpoint's response contract from its OpenAPI declaration."""
    view = SchemaGenerator(patterns=[]).create_view(callback, method)
    schema = view.schema
    if not isinstance(schema, AutoSchema):
        return None

    registry = ComponentRegistry()
    schema.registry = registry
    schema.path = path
    schema.path_regex = path_regex
    schema.path_prefix = ""
    schema.method = method.upper()
    if schema.is_excluded():
        return None

    operation_id = schema.get_operation_id()
    operation_responses = schema._get_response_bodies()
    components = registry.build({})
    responses: dict[str, dict[str, Any] | None] = {}
    for status, response in operation_responses.items():
        if not status.isdigit() or not 200 <= int(status) < 300:
            continue

        media = response.get("content", {}).get("application/json")
        response_schema = media.get("schema") if media is not None else None
        if response_schema is not None and components:
            response_schema = {"allOf": [response_schema], "components": components}
        responses[status] = response_schema

    if not responses:
        return None
    return {"operation_id": operation_id, "responses": responses}

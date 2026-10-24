from typing import Any, get_type_hints

from drf_spectacular.extensions import (
    OpenApiAuthenticationExtension,
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import Direction

from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.apidocs.spectacular_ports import resolve_type_hint
from sentry.conf.server import GRANULAR_SCOPES


def _action_schema_to_openapi(schema: dict[str, Any]) -> dict[str, Any]:
    """Convert an action handler's JSON Schema to its public OpenAPI 3.0 schema."""

    def convert(value: Any) -> Any:
        if isinstance(value, list):
            return [convert(item) for item in value]
        if not isinstance(value, dict):
            return value

        result = {
            key: convert(item)
            for key, item in value.items()
            if key not in {"$schema", "if", "then", "else"}
        }
        if isinstance(properties := value.get("properties"), dict):
            result["properties"] = {
                snake_to_camel_case(name): convert(spec)
                for name, spec in properties.items()
                if not (name == "additionalProperties" and spec is False)
            }
        if isinstance(required := value.get("required"), list):
            result["required"] = [snake_to_camel_case(field) for field in required]
        if isinstance(schema_types := result.get("type"), list):
            non_null_types = [schema_type for schema_type in schema_types if schema_type != "null"]
            if "null" in schema_types:
                result["nullable"] = True
            if len(non_null_types) == 1:
                result["type"] = non_null_types[0]
            elif not non_null_types:
                result.pop("type")

        if isinstance(all_of := result.get("allOf"), list):
            if converted_all_of := [item for item in all_of if item]:
                result["allOf"] = converted_all_of
            else:
                result.pop("allOf")
        return result

    return convert(schema)


def _map_camel_case_serializer(
    extension: OpenApiSerializerExtension, auto_schema: AutoSchema, direction: Direction
) -> dict[str, Any]:
    schema = auto_schema._map_serializer(extension.target, direction, bypass_extensions=True)
    schema["properties"] = {
        snake_to_camel_case(name): value for name, value in schema.get("properties", {}).items()
    }
    if required := schema.get("required"):
        schema["required"] = [snake_to_camel_case(name) for name in required]
    return schema


def _workflow_action_schema() -> dict[str, Any]:
    # These imports are deferred because action handlers import API serializers while registering.
    from sentry.workflow_engine.endpoints.validators.base.action import DEPRECATED_ACTION_TYPES
    from sentry.workflow_engine.models import Action
    from sentry.workflow_engine.registry import action_handler_registry

    variants = []
    for registered_type, handler in sorted(action_handler_registry.registrations.items()):
        action_type = Action.Type(registered_type)
        if action_type in DEPRECATED_ACTION_TYPES:
            continue

        transformer = handler.get_config_transformer()
        config_schema = transformer.api_schema if transformer is not None else handler.config_schema
        properties: dict[str, Any] = {
            "id": {"type": "string"},
            "type": {"type": "string", "enum": [action_type.value]},
            "data": _action_schema_to_openapi(handler.data_schema) or {"type": "object"},
            "config": _action_schema_to_openapi(config_schema),
            "status": {"type": "string"},
        }
        required = ["type", "data", "config"]
        if action_type.is_integration():
            properties["integrationId"] = {"type": "string"}
            required.append("integrationId")

        if action_type == Action.Type.EMAIL:
            properties["config"]["properties"]["targetIdentifier"]["description"] = (
                "The stringified Sentry User.id or Team.id. Resolve users with the organization "
                "members endpoint and teams with the organization teams endpoint. Member IDs, "
                "email addresses, team slugs, and 'me' are not accepted. Omit this field when "
                "targetType is issue_owners."
            )

        variants.append(
            {
                "title": f"{action_type.name.title()} Workflow Action",
                "type": "object",
                "properties": properties,
                "required": required,
            }
        )

    return {
        "oneOf": variants,
        "discriminator": {"propertyName": "type"},
    }


class TokenAuthExtension(OpenApiAuthenticationExtension):
    """
    Extension that adds what scopes are needed to access an endpoint to the
    OpenAPI Schema.
    """

    target_class = "sentry.api.authentication.UserAuthTokenAuthentication"
    name = "auth_token"

    def get_security_requirement(self, auto_schema: AutoSchema) -> dict[str, list[Any]]:
        scopes = set()
        for permission in auto_schema.view.get_permissions():
            for s in permission.scope_map.get(auto_schema.method, []):
                scopes.add(s)

        scope_list = sorted(scopes - GRANULAR_SCOPES)
        return {self.name: scope_list}

    def get_security_definition(
        self, auto_schema: AutoSchema
    ) -> dict[str, Any] | list[dict[str, Any]]:
        return {"type": "http", "scheme": "bearer"}


class SentryResponseSerializerExtension(OpenApiSerializerExtension):
    """
    This extension will register any Sentry Response Serializer as a component that can be used
    in an OpenAPI schema. To have the serializer schema be mapped, you must type the
    `serialize` function with a TypedDict / List.
    """

    priority = 0
    target_class = "sentry.api.serializers.base.Serializer"
    match_subclasses = True

    def get_name(self, auto_schema: AutoSchema, direction: Direction) -> str | None:
        return self.target.__name__

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> Any:
        type_hints = get_type_hints(self.target.serialize)
        if "return" not in type_hints:
            raise TypeError("Please type the return value of the serializer with a TypedDict")

        return resolve_type_hint(type_hints["return"])


class SentryInlineResponseSerializerExtension(OpenApiSerializerExtension):
    """
    This extension is used for the `inline_sentry_response_serializer` utils function
    and will simply resolve the type passed into the function to an OpenAPI schema.
    """

    priority = 0
    target_class = "sentry.apidocs.utils._RawSchema"
    match_subclasses = True

    def get_name(self, auto_schema: AutoSchema, direction: Direction) -> str | None:
        return self.target.__name__

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> Any:
        return resolve_type_hint(self.target.typeSchema)


class SentryAppIssueActionSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.sentry_apps.api.endpoints.installation_external_issue_actions.SentryAppInstallationExternalIssueActionsSerializer"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        schema = auto_schema._map_serializer(self.target, direction, bypass_extensions=True)
        schema["properties"]["action"]["enum"] = ["link", "create"]
        # Apps define additional form fields at the top level of the request.
        schema["additionalProperties"] = True
        return schema


class WorkflowActionSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.workflow_engine.endpoints.validators.base.action.BaseActionValidator"

    def get_name(self, auto_schema: AutoSchema, direction: Direction) -> str:
        return "WorkflowAction"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        return _workflow_action_schema()


class WorkflowValidatorSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.workflow_engine.endpoints.validators.base.workflow.WorkflowValidator"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        return _map_camel_case_serializer(self, auto_schema, direction)


class ActionFilterValidatorSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.workflow_engine.endpoints.validators.base.workflow.ActionFilterValidator"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        from sentry.workflow_engine.endpoints.validators.base.action import BaseActionValidator

        schema = _map_camel_case_serializer(self, auto_schema, direction)
        action_component = auto_schema.resolve_serializer(BaseActionValidator(), direction)
        schema["properties"]["actions"]["items"] = action_component.ref
        return schema


class DataConditionGroupValidatorSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.workflow_engine.endpoints.validators.base.data_condition_group.BaseDataConditionGroupValidator"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        return _map_camel_case_serializer(self, auto_schema, direction)


class RestrictedJsonFieldExtension(OpenApiSerializerFieldExtension):
    """
    This extension restricts Sentry's use of the JSONField to mimic a DictField.
    It comes from a change in drf-spectacular because rest_framework's JSONField actually accepts
    primative, strings, numbers and arrays. drf-spectacular patched this, but in Sentry, we want to
    ensure those fields are always given the correct type of 'object'.

    issue: https://github.com/tfranzel/drf-spectacular/issues/1095
    suggested patch: https://github.com/tfranzel/drf-spectacular/issues/1242#issuecomment-2123492057
    """

    target_class = "rest_framework.fields.JSONField"

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.OBJECT)


# TODO: extension to do default error codes on responses.
# https://github.com/tfranzel/drf-spectacular/issues/334


class InvestigationRequestSerializerExtension(OpenApiSerializerExtension):
    """Expose the wire names without changing opaque JSON keys or runtime validation."""

    target_class = "sentry.investigations.endpoints.validators.base.StrictCamelSnakeValidator"
    match_subclasses = True

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        schema = auto_schema._map_serializer(self.target, direction, bypass_extensions=True)
        schema["properties"] = {
            snake_to_camel_case(name): field for name, field in schema["properties"].items()
        }
        # These validators do not treat PATCH as partial: resume requires both
        # inputId and responseData, including when the latter is null.
        schema["required"] = [
            snake_to_camel_case(name)
            for name, field in self.target.fields.items()
            if field.required
        ]
        # An unconstrained JSON value already includes null. OpenAPI validators
        # such as AJV reject nullable without a type on these fields.
        for field in schema["properties"].values():
            if not any(key in field for key in ("type", "$ref", "oneOf", "anyOf", "allOf")):
                field.pop("nullable", None)
        if not schema["required"]:
            schema.pop("required")
        schema["additionalProperties"] = False
        return schema

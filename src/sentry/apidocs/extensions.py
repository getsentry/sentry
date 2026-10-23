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
from sentry.conf.server import GRANULAR_SCOPES, LEGACY_READ_WRITE_SCOPES


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
                # Document the read scope behind a compatibility scope until the
                # cutoff applies to every credential.
                scopes.add(LEGACY_READ_WRITE_SCOPES.get(s, s))

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

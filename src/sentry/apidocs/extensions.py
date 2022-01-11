import inspect
from typing import Any, Optional

from drf_spectacular.extensions import OpenApiAuthenticationExtension, OpenApiSerializerExtension
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import resolve_type_hint
from drf_spectacular.utils import Direction


class TokenAuthExtension(OpenApiAuthenticationExtension):
    target_class = "sentry.api.authentication.TokenAuthentication"
    name = "auth_token"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer"}

    def get_security_requirement(self, auto_schema):
        permissions = set()
        # TODO: resolve duplicates
        for permission in auto_schema.view.get_permissions():
            for p in permission.scope_map.get(auto_schema.method, []):
                permissions.add(p)

        return {self.name: list(permissions)}


# TODO: map things in registry?
# add docstring as description
# excluded attributes?
# optional/required in responses
class SentryResponseSerializerExtension(OpenApiSerializerExtension):  # type: ignore
    priority = 0
    target_class = "sentry.api.serializers.base.Serializer"
    match_subclasses = True

    def get_name(self) -> Optional[str]:
        name: str = self.target.__name__
        return name

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> Any:
        serializer_signature = inspect.signature(self.target.serialize)
        return resolve_type_hint(serializer_signature.return_annotation)


# class SentryInlineResponseSerializerExtension(OpenApiSerializerExtension):  # type: ignore
#     priority = 0
#     target_class = "sentry.apidocs.schemaserializer.RawSchema"
#     match_subclasses = True

#     def get_name(self) -> Optional[str]:
#         name: str = self.target.__name__
#         return name

#     def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> Any:
#         return resolve_type_hint(self.target.typeSchema)


class RawSchema:
    def __init__(self, t: type) -> None:
        self.typeSchema = t


def inline_sentry_response_serializer(name: str, t: type) -> type:
    serializer_class = type(name, (RawSchema,), {"typeSchema": t})
    return serializer_class

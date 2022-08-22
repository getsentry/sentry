from typing import Any, Dict, List, Optional, Union, get_type_hints

from drf_spectacular.extensions import OpenApiAuthenticationExtension, OpenApiSerializerExtension
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import Direction

from sentry.apidocs.spectacular_ports import resolve_type_hint  # type: ignore


class TokenAuthExtension(OpenApiAuthenticationExtension):  # type: ignore
    """
    Extension that adds what scopes are needed to access an endpoint to the
    OpenAPI Schema.
    """

    target_class = "sentry.api.authentication.TokenAuthentication"
    name = "auth_token"

    def get_security_requirement(self, auto_schema: AutoSchema) -> Dict[str, List[Any]]:
        scopes = set()
        for permission in auto_schema.view.get_permissions():
            for s in permission.scope_map.get(auto_schema.method, []):
                scopes.add(s)

        scope_list = list(scopes)
        scope_list.sort()
        return {self.name: scope_list}

    def get_security_definition(
        self, auto_schema: AutoSchema
    ) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
        return {"type": "http", "scheme": "bearer"}


class SentryResponseSerializerExtension(OpenApiSerializerExtension):  # type: ignore
    """
    This extension will register any Sentry Response Serializer as a component that can be used
    in an OpenAPI schema. To have the serializer schema be mapped, you must type the
    `serialize` function with a TypedDict / List.
    """

    priority = 0
    target_class = "sentry.api.serializers.base.Serializer"
    match_subclasses = True

    def get_name(self) -> Optional[str]:
        name: str = self.target.__name__
        return name

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> Any:
        type_hints = get_type_hints(self.target.serialize)
        if "return" not in type_hints:
            raise TypeError("Please type the return value of the serializer with a TypedDict")

        return resolve_type_hint(type_hints["return"])


class SentryInlineResponseSerializerExtension(OpenApiSerializerExtension):  # type: ignore
    """
    This extension is used for the `inline_sentry_response_serializer` utils function
    and will simply resolve the type passed into the function to an OpenAPI schema.
    """

    priority = 0
    target_class = "sentry.apidocs.utils._RawSchema"
    match_subclasses = True

    def get_name(self) -> Optional[str]:
        name: str = self.target.__name__
        return name

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> Any:
        return resolve_type_hint(self.target.typeSchema)


# TODO: extension to do default error codes on responses.
# https://github.com/tfranzel/drf-spectacular/issues/334

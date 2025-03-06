from typing import Literal

from sentry.search.eap.spans.attributes import SPAN_ATTRIBUTE_DEFINITIONS

INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[Literal["string", "number"], dict[str, str]] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type != "string"
    },
}


def translate_internal_to_public_alias(
    internal_alias: str,
    type: Literal["string", "number"],
) -> str | None:
    mappings = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(type, {})
    return mappings.get(internal_alias)

from typing import Any, Literal, NotRequired, TypedDict


class TraceItemAttributeSource(TypedDict):
    source_type: Literal["sentry", "user"]
    is_transformed_alias: NotRequired[bool]


class TraceItemAttributeContext(TypedDict):
    """
    Additional, mostly-static metadata about an attribute sourced from the
    sentry conventions (``sentry_conventions.attributes.ATTRIBUTE_METADATA``).

    Only attributes that map to a known sentry convention have context, and
    within the context only the fields actually present in the conventions
    metadata are included. This is only attached when the caller passes
    ``expand=context`` and the ``data-browsing-attribute-context`` feature is
    enabled.
    """

    # A short, human-readable description of the attribute. Always present for a
    # known convention.
    brief: str
    # Whether the convention has been deprecated. Always present for a known
    # convention.
    isDeprecated: bool
    # Longer-form notes that add nuance beyond the brief (e.g. caveats,
    # double-counting warnings). Sourced from the convention's
    # ``additional_context``.
    details: NotRequired[list[str]]
    # Example value(s) for the attribute, normalized to a list.
    examples: NotRequired[list[Any]]
    # The attribute that replaces this one, when deprecated.
    replacementAttribute: NotRequired[str]


class TraceItemAttributeKey(TypedDict):
    key: str
    name: str
    secondaryAliases: NotRequired[list[str]]
    attributeSource: TraceItemAttributeSource
    attributeType: Literal["string", "number", "boolean"]
    # Sentry conventions metadata, only present when requested via
    # ``expand=context`` (and gated behind the feature flag).
    context: NotRequired[TraceItemAttributeContext]

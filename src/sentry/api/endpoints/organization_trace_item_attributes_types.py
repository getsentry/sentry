from typing import Any, Literal, NotRequired, TypedDict


class TraceItemAttributeSource(TypedDict):
    source_type: Literal["sentry", "user"]
    is_transformed_alias: NotRequired[bool]


class TraceItemAttributeContext(TypedDict):
    """
    Additional, mostly-static metadata about an attribute.

    When ``expand=context`` is requested, context is attached to every
    attribute. Today the metadata is sourced from the sentry conventions
    (``sentry_conventions.attributes.ATTRIBUTE_METADATA``), so attributes that
    map to a known convention carry that metadata (only the fields actually
    present are included) while custom attributes get an empty context. Serving
    context for custom attributes is planned (gated behind the
    ``data-browsing-attribute-context`` feature), at which point the empty
    contexts will start to be populated.
    """

    # A short, human-readable description of the attribute. Present for a known
    # convention.
    brief: NotRequired[str]
    # Whether the convention has been deprecated. Present for a known
    # convention.
    isDeprecated: NotRequired[bool]
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
    # Attribute context, only present when requested via ``expand=context`` (and
    # gated behind the feature flag). Attached to every attribute when
    # requested; currently empty for custom (non-convention) attributes, which
    # will be populated once custom attribute context is served.
    context: NotRequired[TraceItemAttributeContext]

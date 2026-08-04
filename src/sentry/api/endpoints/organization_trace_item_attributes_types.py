from typing import Any, Literal, NotRequired, TypedDict


class TraceItemAttributeSource(TypedDict):
    source_type: Literal["sentry", "user"]
    is_transformed_alias: NotRequired[bool]


class TraceItemAttributeContext(TypedDict):
    """
    Additional, mostly-static metadata about an attribute.

    When ``expand=context`` is requested, context is attached to every attribute.
    Metadata comes from the sentry conventions, Sentry's own column definitions,
    or user-authored context (gated behind ``data-browsing-attribute-context``),
    in that precedence order. Only the fields available are included, so an
    attribute with no metadata gets an empty context.
    """

    # Whether this context comes from a known sentry convention. Present (and
    # True) for a known convention.
    isConvention: NotRequired[bool]
    # Whether this context was authored by a user. Present (and True) only for
    # user-authored context, so mutually exclusive with ``isConvention``.
    isCustom: NotRequired[bool]
    # A short, human-readable description of the attribute. Present for a known
    # convention, and for user-authored context (where it is required).
    brief: NotRequired[str]
    # Whether the convention has been deprecated. Present for a known
    # convention; not modeled for user-authored context.
    isDeprecated: NotRequired[bool]
    # Longer-form notes that add nuance beyond the brief (e.g. caveats,
    # double-counting warnings). Sourced from ``additional_context``.
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
    # Attribute context, only present when requested via ``expand=context``.
    # Attached to every attribute, and empty when it has no metadata.
    context: NotRequired[TraceItemAttributeContext]

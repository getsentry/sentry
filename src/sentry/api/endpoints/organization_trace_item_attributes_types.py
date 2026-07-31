from typing import Any, Literal, NotRequired, TypedDict


class TraceItemAttributeSource(TypedDict):
    source_type: Literal["sentry", "user"]
    is_transformed_alias: NotRequired[bool]


class TraceItemAttributeContext(TypedDict):
    """
    Additional, mostly-static metadata about an attribute.

    When ``expand=context`` is requested, context is attached to every
    attribute. Metadata comes from three sources, in precedence order: the
    sentry conventions (``sentry_conventions.attributes.ATTRIBUTE_METADATA``,
    matched by attribute name and type regardless of the attribute's source),
    Sentry's own column definitions (e.g. ``span.description``), and
    user-authored context stored in ``TraceItemAttributeContext`` (gated behind
    the ``data-browsing-attribute-context`` feature). Only the fields actually
    available for an attribute are included; an attribute with no metadata from
    any source gets an empty context.
    """

    # Whether this context comes from a known sentry convention. Present (and
    # True) for a known convention. Lets clients distinguish sentry-convention
    # context from Sentry-defined and custom (user-authored) context.
    isConvention: NotRequired[bool]
    # Whether this context was authored by a user (as opposed to sourced from
    # the sentry conventions or a Sentry column definition). Present (and True)
    # only for user-authored context. Sentry-owned attributes are never
    # user-describable, so this is mutually exclusive with ``isConvention``.
    isCustom: NotRequired[bool]
    # A short, human-readable description of the attribute. Present for a known
    # convention, and for user-authored context (where it is required).
    brief: NotRequired[str]
    # Whether the convention has been deprecated. Present for a known
    # convention. User-authored context has no notion of deprecation.
    isDeprecated: NotRequired[bool]
    # Longer-form notes that add nuance beyond the brief (e.g. caveats,
    # double-counting warnings). Sourced from the convention's
    # ``additional_context``, or from user-authored ``additional_context``.
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
    # Attached to every attribute when requested, and empty for attributes with
    # no metadata from any source.
    context: NotRequired[TraceItemAttributeContext]

from typing import Any, Literal, NotRequired, TypedDict

from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.search.eap.types import ColumnType


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


@sentry_schema_serializer(
    omit_from_public_schema={
        "context": "The context shape it returns is still evolving.",
    }
)
class TraceItemAttributeKey(TypedDict):
    key: str
    name: str
    secondaryAliases: NotRequired[list[str]]
    attributeSource: TraceItemAttributeSource
    attributeType: ColumnType
    # Attribute context, only present when requested via ``expand=context``.
    # Attached to every attribute, and empty when it has no metadata.
    #
    # Excluded from the OpenAPI spec above: the context shape is still evolving,
    # so we don't want public consumers depending on it. It stays on the
    # TypedDict, so mypy and the runtime are unaffected.
    context: NotRequired[TraceItemAttributeContext]


class TraceItemAttributeValidationResult(TypedDict):
    valid: bool
    # The resolved type of the attribute. Only present when ``valid`` is True.
    type: NotRequired[Literal["string", "number", "boolean", "array"]]
    # Why the attribute is invalid. Only present when ``valid`` is False.
    error: NotRequired[str]


class TraceItemAttributeValidateResponse(TypedDict):
    # Keyed by each attribute name passed in the request body.
    attributes: dict[str, TraceItemAttributeValidationResult]


class AttributeBucket(TypedDict):
    label: str
    value: float


class RankedAttributeOrder(TypedDict):
    rrr: int


class RankedAttribute(TypedDict):
    attributeName: str
    # Value distribution of the attribute in each cohort, or null when the
    # attribute has no values in that cohort.
    cohort1: list[AttributeBucket] | None
    cohort2: list[AttributeBucket] | None
    # Deprecated: the position is the index in ``rankedAttributes``.
    order: RankedAttributeOrder


class RankingInfo(TypedDict):
    function: str
    # The function's value over the suspect cohort, or "N/A" when it isn't a
    # percentile function or there was no data.
    value: float | str
    above: bool


class RankedAttributesResponse(TypedDict):
    rankedAttributes: list[RankedAttribute]
    # Omitted when there are no projects or both queries are identical.
    rankingInfo: NotRequired[RankingInfo]
    cohort1Total: NotRequired[int]
    cohort2Total: NotRequired[int]

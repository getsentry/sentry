from typing import Annotated, Literal, NotRequired, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.search.eap.types import ColumnType

TraceItemAttributeUnit = Literal["byte", "currency", "millisecond", "percentage", "second"]


class TraceItemAttributeSource(TypedDict):
    source_type: Annotated[
        Literal["sentry", "user"],
        ApiDescription(
            "Who set the attribute: `sentry` for attributes Sentry defines, or `user` for custom attributes"
        ),
    ]
    is_transformed_alias: NotRequired[
        Annotated[
            bool,
            ApiDescription(
                "Whether the attribute name is an alias Sentry maps to an internal column"
            ),
        ]
    ]


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
    isConvention: NotRequired[
        Annotated[bool, ApiDescription("Whether this context comes from a known Sentry convention")]
    ]
    # Whether this context was authored by a user. Present (and True) only for
    # user-authored context, so mutually exclusive with ``isConvention``.
    isCustom: NotRequired[
        Annotated[bool, ApiDescription("Whether this context was written by a user")]
    ]
    # A short, human-readable description of the attribute. Present for a known
    # convention, and for user-authored context (where it is required).
    brief: NotRequired[Annotated[str, ApiDescription("Short description of the attribute")]]
    # Whether the convention has been deprecated. Present for a known
    # convention; not modeled for user-authored context.
    isDeprecated: NotRequired[
        Annotated[bool, ApiDescription("Whether the convention is deprecated")]
    ]
    # Longer-form notes that add nuance beyond the brief (e.g. caveats,
    # double-counting warnings). Sourced from ``additional_context``.
    details: NotRequired[
        Annotated[list[str], ApiDescription("Longer notes about the attribute, such as caveats")]
    ]
    # Example value(s) for the attribute, normalized to a list.
    examples: NotRequired[
        Annotated[
            list[str | int | float | bool], ApiDescription("Example values for the attribute")
        ]
    ]
    # The attribute that replaces this one, when deprecated.
    replacementAttribute: NotRequired[
        Annotated[str, ApiDescription("Attribute that replaces this one, when it is deprecated")]
    ]
    isInOtel: NotRequired[
        Annotated[
            bool,
            ApiDescription(
                "Whether this Sentry convention is part of the OpenTelemetry semantic "
                "conventions. Present (and true) only for such conventions; OpenTelemetry "
                "attributes that aren't Sentry conventions are never marked"
            ),
        ]
    ]
    unit: NotRequired[
        Annotated[
            TraceItemAttributeUnit,
            ApiDescription(
                "Unit of a number attribute, from the dataset's Sentry-defined attributes or "
                "from Sentry conventions, which apply in every dataset"
            ),
        ]
    ]


class TraceItemAttributeKey(TypedDict):
    key: Annotated[str, ApiDescription("Key to use when querying the attribute")]
    name: Annotated[str, ApiDescription("Display name of the attribute")]
    secondaryAliases: NotRequired[
        Annotated[list[str], ApiDescription("Other names the attribute can be queried by")]
    ]
    attributeSource: Annotated[
        TraceItemAttributeSource, ApiDescription("Where the attribute comes from")
    ]
    attributeType: Annotated[
        ColumnType,
        ApiDescription("Type of the attribute: `string`, `number`, `boolean` or `array`"),
    ]
    # Attribute context, only present when requested via ``expand=context``.
    # Attached to every attribute, and empty when it has no metadata.
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

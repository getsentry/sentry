from typing import Annotated, TypedDict

from sentry.apidocs.descriptions import ApiDescription


class TraceItemStatsBucket(TypedDict):
    label: Annotated[str, ApiDescription("Value of the attribute")]
    value: Annotated[float, ApiDescription("Number of items with the value")]


class AttributeDistributions(TypedDict):
    data: Annotated[
        dict[str, list[TraceItemStatsBucket]],
        ApiDescription("Value distribution of each attribute, by attribute name"),
    ]


class TraceItemStat(TypedDict):
    attributeDistributions: Annotated[
        AttributeDistributions, ApiDescription("Value distributions of the attributes")
    ]


class TraceItemStatsResponse(TypedDict):
    data: Annotated[list[TraceItemStat], ApiDescription("Requested stats")]

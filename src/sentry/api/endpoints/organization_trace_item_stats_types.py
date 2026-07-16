from typing import TypedDict


class TraceItemStatsBucket(TypedDict):
    label: str
    value: float


class AttributeDistributions(TypedDict):
    data: dict[str, list[TraceItemStatsBucket]]


class TraceItemStat(TypedDict):
    attributeDistributions: AttributeDistributions


class TraceItemStatsResponse(TypedDict):
    data: list[TraceItemStat]

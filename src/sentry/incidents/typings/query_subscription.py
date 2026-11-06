from typing import TypedDict


class SnubaQuerySerializerResponse(TypedDict):
    id: str
    dataset: str
    query: str
    aggregate: str
    timeWindow: int
    environment: str | None
    eventTypes: list[str]
    extrapolationMode: str | None


class QuerySubscriptionSerializerResponse(TypedDict):
    id: str
    status: int
    subscription: str | None
    snubaQuery: SnubaQuerySerializerResponse

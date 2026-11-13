from typing import Annotated, TypedDict

from sentry.apidocs.descriptions import ApiDescription


class SnubaQuerySerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the query")]
    dataset: Annotated[
        str,
        ApiDescription("Dataset the query runs on, such as events or events_analytics_platform"),
    ]
    query: Annotated[str, ApiDescription("Search query that filters the data")]
    aggregate: Annotated[
        str, ApiDescription("Aggregate function the query computes, such as count()")
    ]
    timeWindow: Annotated[int, ApiDescription("Time window of the query in seconds")]
    environment: Annotated[
        str | None, ApiDescription("Environment the query is limited to. Null for all environments")
    ]
    eventTypes: Annotated[
        list[str], ApiDescription("Event types the query includes, such as error or transaction")
    ]
    extrapolationMode: Annotated[
        str | None,
        ApiDescription(
            "How sampled data is extrapolated, unknown, none, client_and_server_weighted or server_weighted. Null when not set"
        ),
    ]


class QuerySubscriptionSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the query subscription")]
    status: Annotated[
        int,
        ApiDescription(
            "Status of the subscription: 0 active, 1 creating, 2 updating, 3 deleting or 4 disabled"
        ),
    ]
    subscription: Annotated[
        str | None, ApiDescription("ID of the subscription in Snuba. Null while it's being created")
    ]
    snubaQuery: Annotated[
        SnubaQuerySerializerResponse, ApiDescription("Query the subscription runs")
    ]

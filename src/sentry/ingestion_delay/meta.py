from typing import Annotated, NotRequired, TypedDict

from sentry.apidocs.descriptions import ApiDescription


class IngestionMeta(TypedDict):
    """
    Ingestion status for the data behind a response.
    """

    status: Annotated[
        str, ApiDescription("Ingestion status of the data: healthy, stalled, idle or unknown")
    ]
    delaySeconds: NotRequired[
        Annotated[float, ApiDescription("Measured ingestion delay in seconds")]
    ]
    completeThrough: NotRequired[
        Annotated[
            float,
            ApiDescription(
                "Time through which the data is complete, as a Unix timestamp in milliseconds"
            ),
        ]
    ]

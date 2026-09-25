from typing import NotRequired, TypedDict


class IngestionMeta(TypedDict):
    """
    Ingestion status for the data behind a response.
    """

    status: str
    delaySeconds: NotRequired[float]
    completeThrough: NotRequired[float]

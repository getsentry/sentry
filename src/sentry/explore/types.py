from dataclasses import dataclass
from enum import StrEnum


class SavedQueryType(StrEnum):
    DISCOVER = "discover"
    EXPLORE = "explore"


@dataclass(frozen=True)
class SavedQueryRef:
    """
    A saved query identified across products.

    ``type`` is either discover or explore
    ``query_id`` is the associated primary key for that query.
                 Ex. if type is discover, query_id is the primary key of a DiscoverSavedQuery.
    """

    type: SavedQueryType
    query_id: int

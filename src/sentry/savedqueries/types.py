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
    ``id`` is the associated primary key for that query
    """

    type: SavedQueryType
    id: int

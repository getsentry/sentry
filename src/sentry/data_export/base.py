from typing import int
from datetime import timedelta
from enum import Enum

MAX_BATCH_SIZE = 8 * 1024 * 1024
MAX_FRAGMENTS_PER_BATCH = 10
EXPORTED_ROWS_LIMIT = 10000000
SNUBA_MAX_RESULTS = 10000
DEFAULT_EXPIRATION = timedelta(weeks=4)


class ExportError(Exception):
    def __init__(self, message: str, recoverable: bool = False) -> None:
        super().__init__(message)
        self.recoverable = recoverable


class ExportStatus(str, Enum):
    Early = "EARLY"  # The download is being prepared
    Valid = "VALID"  # The download is ready for the user
    Expired = "EXPIRED"  # The download has been deleted


class ExportQueryType:
    ISSUES_BY_TAG = 0
    DISCOVER = 1
    EXPLORE = 2
    ISSUES_BY_TAG_STR = "Issues-by-Tag"
    DISCOVER_STR = "Discover"
    EXPLORE_STR = "Explore"

    @classmethod
    def as_choices(cls) -> tuple[tuple[int, str], ...]:
        return (
            (cls.ISSUES_BY_TAG, str(cls.ISSUES_BY_TAG_STR)),
            (cls.DISCOVER, str(cls.DISCOVER_STR)),
            (cls.EXPLORE, str(cls.EXPLORE_STR)),
        )

    @classmethod
    def as_str_choices(cls) -> tuple[tuple[str, str], ...]:
        return (
            (cls.ISSUES_BY_TAG_STR, cls.ISSUES_BY_TAG_STR),
            (cls.DISCOVER_STR, cls.DISCOVER_STR),
            (cls.EXPLORE_STR, cls.EXPLORE_STR),
        )

    @classmethod
    def as_str(cls, integer: int) -> str:
        if integer == cls.ISSUES_BY_TAG:
            return cls.ISSUES_BY_TAG_STR
        elif integer == cls.DISCOVER:
            return cls.DISCOVER_STR
        elif integer == cls.EXPLORE:
            return cls.EXPLORE_STR
        raise ValueError(f"Invalid ExportQueryType: {integer}")

    @classmethod
    def from_str(cls, string: str) -> int:
        if string == cls.ISSUES_BY_TAG_STR:
            return cls.ISSUES_BY_TAG
        elif string == cls.DISCOVER_STR:
            return cls.DISCOVER
        elif string == cls.EXPLORE_STR:
            return cls.EXPLORE
        raise ValueError(f"Invalid ExportQueryType: {string}")

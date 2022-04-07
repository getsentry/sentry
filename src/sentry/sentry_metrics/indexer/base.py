from dataclasses import dataclass
from enum import Enum
from typing import Dict, MutableMapping, Optional, Set

from sentry.utils.services import Service


class FetchType(Enum):
    CACHE_HIT = "c"
    HARDCODED = "h"
    DB_READ = "d"
    FIRST_SEEN = "f"


@dataclass
class BulkRecordResult:
    mapping: MutableMapping[str, int]
    meta: MutableMapping[FetchType, Dict[int, str]]


class StringIndexer(Service):
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.

    Check `sentry.snuba.metrics` for convenience functions.
    """

    __all__ = ("record", "resolve", "reverse_resolve", "bulk_record")

    def bulk_record(self, org_strings: MutableMapping[int, Set[str]]) -> BulkRecordResult:
        raise NotImplementedError()

    def record(self, org_id: int, string: str) -> int:
        """Store a string and return the integer ID generated for it

        With every call to this method, the lifetime of the entry will be
        prolonged.
        """
        raise NotImplementedError()

    def resolve(self, org_id: int, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Does not affect the lifetime of the entry.

        Returns None if the entry cannot be found.
        """
        raise NotImplementedError()

    def reverse_resolve(self, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        raise NotImplementedError()

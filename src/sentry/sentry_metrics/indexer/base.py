from enum import Enum
from typing import Optional

from sentry.models import Organization
from sentry.utils.services import Service


class UseCase(Enum):
    METRIC = 0
    TAG_KEY = 1
    TAG_VALUE = 2


class StringIndexer(Service):  # type: ignore
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.
    """

    __all__ = ("record", "resolve", "reverse_resolve")

    def record(self, organization: Organization, use_case: UseCase, string: str) -> int:
        """Store a string and return the integer ID generated for it

        With every call to this method, the lifetime of the entry will be
        prolonged.
        """
        raise NotImplementedError()

    def resolve(self, organization: Organization, use_case: UseCase, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Does not affect the lifetime of the entry.

        Returns None if the entry cannot be found.
        """
        raise NotImplementedError()

    def reverse_resolve(
        self, organization: Organization, use_case: UseCase, id: int
    ) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        raise NotImplementedError()

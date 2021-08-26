import itertools
from collections import defaultdict
from typing import Optional

from sentry.models import Project

from .base import StringIndexer, UseCase


class MemoryIndexer(StringIndexer):
    """
    In-memory implementation of the indexer, for debugging purposes only.
    """

    def __init__(self):
        self._entries = {}
        counter = itertools.count()
        self._entries = defaultdict(counter.__next__)
        self._reverse = {}

    def record(self, project: Project, use_case: UseCase, string: str) -> int:
        """Store a string and return the integer ID generated for it"""
        id_ = self._entries[(use_case, string)]
        self._reverse[(use_case, id_)] = string

        return id_

    def resolve(self, project: Project, use_case: UseCase, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Returns None if the entry cannot be found.
        """
        return self._entries.get((use_case, string))

    def reverse_resolve(self, project: Project, use_case: UseCase, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        return self._reverse.get((use_case, id))

from enum import Enum
from typing import List, Optional, Tuple

from sentry.models import Project
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

    __all__ = (
        "list_metrics",
        "list_tag_values",
        "record_metric",
        "record_tag",
        "resolve",
        "reverse_resolve",
    )

    def record_metric(self, project: Project, string: str) -> int:
        """Store a metric name and return the integer ID generated for it"""
        raise NotImplementedError

    def record_tag(self, project: Project, metric: str, key: str, value: str) -> Tuple[int, int]:
        """Store a key-value pair for a metric.
        Return the integer IDs corresponding to key and value.
        """
        raise NotImplementedError

    def resolve(self, project: Project, use_case: UseCase, string: str) -> Optional[int]:
        """Get the integer ID corresponding to the given use case and string.

        Return None if no entry was found.
        """
        raise NotImplementedError

    def reverse_resolve(self, project: Project, use_case: UseCase, id: int) -> Optional[str]:
        """Get the string corresponding to the given use case and integer ID.

        Return None if no entry was found.
        """
        raise NotImplementedError

    def list_metrics(self, project: Project) -> List[str]:
        """Return a list of metric names for this project."""
        raise NotImplementedError

    def list_tag_keys(self, project: Project, metric: Optional[str]) -> List[str]:
        """Return a list of tag keys for the given project.

        If `metric` is given, only return tag keys which have been recorded for this metric.
        """
        raise NotImplementedError

    def list_tag_values(self, project: Project, tag_key: str, metric: Optional[str]) -> List[str]:
        """Return a list of tag values for the given tag_key.

        If `metric` is given, only return tag values which have been recorded for this metric.
        """
        raise NotImplementedError

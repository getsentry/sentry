from collections import defaultdict
from typing import Any, Dict, List, Optional, Set

from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer
from sentry.utils.services import Service


class PGStringIndexer(Service):  # type: ignore
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.
    """

    __all__ = ("record", "resolve", "reverse_resolve", "bulk_record")

    def _bulk_record(self, unmapped_strings: Set[str]) -> Any:
        records = [MetricsKeyIndexer(string=string) for string in unmapped_strings]
        # We use `ignore_conflicts=True` here to avoid race conditions where metric indexer
        # records might have be created between when we queried in `bulk_record` and the
        # attempt to create the rows down below.
        MetricsKeyIndexer.objects.bulk_create(records, ignore_conflicts=True)
        # Using `ignore_conflicts=True` prevents the pk from being set on the model
        # instances. Re-query the database to fetch the rows, they should all exist at this
        # point.
        return MetricsKeyIndexer.objects.filter(string__in=unmapped_strings)

    def bulk_record(self, strings: List[str]) -> Dict[str, int]:
        # first look up to see if we have any of the values
        records = MetricsKeyIndexer.objects.filter(string__in=strings)
        result = defaultdict(int)

        for record in records:
            result[record.string] = record.id

        unmapped = set(strings).difference(result.keys())
        new_mapped = self._bulk_record(unmapped)

        for new in new_mapped:
            result[new.string] = new.id

        return result

    def record(self, string: str) -> int:
        """Store a string and return the integer ID generated for it"""
        result = self.bulk_record(strings=[string])
        return result[string]

    def resolve(self, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Returns None if the entry cannot be found.
        """
        try:
            id: int = MetricsKeyIndexer.objects.filter(string=string).values_list("id", flat=True)[
                0
            ]
        except IndexError:
            return None

        return id

    def reverse_resolve(self, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        try:
            string: str = MetricsKeyIndexer.objects.filter(id=id).values_list("string", flat=True)[
                0
            ]
        except IndexError:
            return None

        return string

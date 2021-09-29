from collections import defaultdict
from typing import Dict, List, Optional, Set

from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer
from sentry.utils.services import Service


class StringIndexer(Service):  # type: ignore
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.
    """

    __all__ = ("record", "resolve", "reverse_resolve", "bulk_record")

    def _bulk_record(self, org_id: int, unmapped_strings: Set[str]):
        records = []
        for string in unmapped_strings:
            obj = MetricsKeyIndexer.objects.create(organization_id=org_id, key=string)
            records.append(obj)
        return records

    def bulk_record(self, org_id: int, strings: List[str]) -> Dict[str, int]:
        # first look up to see if we have any of the values
        records = MetricsKeyIndexer.objects.filter(key__in=strings)
        result = defaultdict(int)

        for record in records:
            result[record.key] = record.value

        # find the unmapped strings
        unmapped = set(strings).difference(result.keys())
        new_mapped = self._bulk_record(org_id, unmapped)

        for new in new_mapped:
            result[new.key] = new.value

        return result

    def record(self, org_id: int, string: str) -> int:
        """Store a string and return the integer ID generated for it

        With every call to this method, the lifetime of the entry will be
        prolonged.
        """
        result = self.bulk_record(org_id=org_id, strings=[string])
        return result[string]

    def resolve(self, org_id: int, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Does not affect the lifetime of the entry.

        Returns None if the entry cannot be found.
        """
        try:
            MetricsKeyIndexer.objects.get(org_id, key=string)
        except MetricsKeyIndexer.DoesNotExist:
            return None

    def reverse_resolve(self, org_id: int, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        try:
            MetricsKeyIndexer.objects.get(org_id, value=id)
        except MetricsKeyIndexer.DoesNotExist:
            return None

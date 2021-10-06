from typing import Any, List, Mapping, MutableMapping, Optional, Set, Union

from django.core.cache import cache

from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer
from sentry.utils.services import Service


class PGStringIndexer(Service):  # type: ignore
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.
    """

    __all__ = ("record", "resolve", "reverse_resolve", "bulk_record")

    def _build_cache_key_pair_dict(self, string: str, id: int) -> Mapping[str, Any]:
        """
        We need to cache at the same time both relationships:

        1. string -> id
        2. id -> string

        The first is needed when consuming the original message
        payloads from relay so that we can translate the strings to
        their corresponding ids.

        The second is needed for when the product needs to get the
        human readable strings for ids read from snuba.
        """
        return {
            self._build_indexer_cache_key(string): id,
            self._build_indexer_cache_key(id): string,
        }

    def _build_indexer_cache_key(self, instance: Union[str, int]) -> str:
        if isinstance(instance, str):
            return f"metricsindexer:1:str:{instance}"
        elif isinstance(instance, int):
            return f"metricsindexer:1:int:{instance}"
        else:
            raise Exception("Invalid: must be string or int")

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

    def bulk_record(self, strings: List[str]) -> Mapping[str, int]:
        # first and foremoset check the cache
        keys = [self._build_indexer_cache_key(string) for string in strings]
        cache_results: Mapping[str, int] = cache.get_many(keys)

        uncached = set(strings).difference(cache_results.keys())

        if not uncached:
            return cache_results

        # next look up any values that have been created, but aren't in the cache
        records = MetricsKeyIndexer.objects.filter(string__in=uncached)
        result: MutableMapping[str, int] = {**cache_results}

        to_cache: MutableMapping[str, Any] = {}
        for record in records:
            result[record.string] = record.id
            to_cache = {**to_cache, **self._build_cache_key_pair_dict(record.string, record.id)}

        unmapped = set(strings).difference(result.keys())
        new_mapped = self._bulk_record(unmapped)

        for new in new_mapped:
            result[new.string] = new.id
            to_cache = {**to_cache, **self._build_cache_key_pair_dict(new.string, new.id)}

        if to_cache:
            # caches both newly created indexer values as well as previously created
            # indexer records that weren't in the cache already
            cache.set_many(to_cache)
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
            id = int(cache.get(self._build_indexer_cache_key(string)))
        except TypeError:
            try:
                id = MetricsKeyIndexer.objects.filter(string=string).values_list("id", flat=True)[0]
            except IndexError:
                return None

        return id

    def reverse_resolve(self, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        string: Optional[str] = cache.get(self._build_indexer_cache_key(id))
        if not string:
            try:
                string = MetricsKeyIndexer.objects.filter(id=id).values_list("string", flat=True)[0]
            except IndexError:
                return None

        return string

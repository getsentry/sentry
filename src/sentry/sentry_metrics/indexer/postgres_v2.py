from collections import defaultdict
from functools import reduce
from operator import or_
from typing import List, Mapping, MutableMapping, Optional, Sequence, Set, Union

from django.db.models import Q

from sentry.sentry_metrics.indexer.models import StringIndexer as StringIndexerTable
from sentry.sentry_metrics.indexer.models import indexer_cache
from sentry.utils import metrics
from sentry.utils.services import Service

_INDEXER_CACHE_METRIC = "sentry_metrics.indexer.memcache"


class PGStringIndexerV2(Service):
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.
    """

    __all__ = ("record", "resolve", "reverse_resolve", "bulk_record")

    def _record_many_strings(self, keys: Sequence[str]) -> Mapping[str, int]:
        """
        Bulk create db records for org_id:string pairs. As noted below, bulk_create with
        ignore_conflicts=True returns objects that don't have the pk set on them (aka the `id`
        that we need), so that's why we use `_get_db_ids_and_set_cache` to look up the records
        and return a mapping of org_id:string -> id:
            {
                "1:release": 3,
                "2:v1": 4
            }
        """
        records = []
        for key in keys:
            organization_id, string = key.split(":")
            records.append(StringIndexerTable(organization_id=int(organization_id), string=string))

        with metrics.timer("sentry_metrics.indexer.pg_bulk_create"):
            # We use `ignore_conflicts=True` here to avoid race conditions where metric indexer
            # records might have be created between when we queried in `bulk_record` and the
            # attempt to create the rows down below.
            StringIndexerTable.objects.bulk_create(records, ignore_conflicts=True)

        # We re-query the database to fetch the rows (which should all exist point at this point),
        # in addition to setting the results in the cache
        results = self._get_db_ids_and_set_cache(keys)
        # we _just_ created this records, there is no reason for results to be None
        assert results
        return results

    def _get_db_ids_and_set_cache(self, keys: Sequence[str]) -> Union[Mapping[str, int], None]:
        """
        Query the db for the org_id and string pairs given by the keys (e.g "1:release")

        If we find no records out of the entire list of keys, return None. Otherwise, we
        return a mapping of org_id:string key -> id:
            {
                "1:release": 3,
                "2:v1": 4
            }

        When setting values in the cache we need to cache both ways:
            * "org_id:string" -> id
            * id -> "string"
        The id doesn't need the org_id as part of the cache key because it's unique
        across the StringIndexerTable.
        """
        conditions = []
        for key in keys:
            organization_id, string = key.split(":")
            conditions.append(Q(organization_id=int(organization_id), string=string))

        query_statement = reduce(or_, conditions)

        db_results = {}
        reverse_db_results = {}
        db_objs = StringIndexerTable.objects.filter(query_statement)
        if not db_objs:
            return None

        for db_obj in db_objs:
            key = f"{db_obj.organization_id}:{db_obj.string}"

            db_results[key] = db_obj.id
            reverse_db_results[db_obj.id] = db_obj.string

        indexer_cache.set_many(db_results)
        indexer_cache.set_many(reverse_db_results)
        return db_results

    def _get_many_ids(self, keys: Sequence[str]) -> MutableMapping[str, Optional[int]]:
        """
        Takes a list of keys formatted as such "org_string:string". Ex. "1:release"

        Returns a mapping of the key to the id (or None if the id doesn't exist):
            {
                "1:release": 3,
                "2:v1": None
            }

        This method first attempts to check memcache to see if we have the id
        there and if not, we attempt to look up records in the db. We record
        the cache hits and misses here, but the misses don't mean that the
        records were in the db, just means they weren't in the cache.
        """
        final_results: MutableMapping[str, Optional[int]] = {}
        cache_results = indexer_cache.get_many(keys)

        db_look_up_keys = set()
        for key in keys:
            result = cache_results.get(key)
            if isinstance(result, int):
                final_results[key] = result
            else:
                final_results[key] = None
                db_look_up_keys.add(key)

        cache_hits = len(final_results.keys())
        cache_misses = len(db_look_up_keys)

        metrics.incr(
            _INDEXER_CACHE_METRIC,
            tags={"cache_hit": "true", "caller": "get_many_ids"},
            amount=cache_hits,
        )
        metrics.incr(
            _INDEXER_CACHE_METRIC,
            tags={"cache_hit": "false", "caller": "get_many_ids"},
            amount=cache_misses,
        )

        # if we found everything we need in the cache, return early
        # otherwise attempt to look up records in db (and cache results
        # if we find them in the db)
        if len(db_look_up_keys) == 0:
            return final_results

        db_results = self._get_db_ids_and_set_cache(list(db_look_up_keys))
        if db_results:
            final_results.update(db_results)

        return final_results

    def bulk_record(
        self, org_strings: MutableMapping[int, Set[str]]
    ) -> MutableMapping[int, MutableMapping[str, int]]:
        keys: List[str] = []
        for org_id in org_strings:
            keys.extend([f"{org_id}:{string}" for string in org_strings[org_id]])

        results: MutableMapping[int, MutableMapping[str, int]] = defaultdict(dict)
        keys_to_ids = self._get_many_ids(keys)

        unmapped: List[str] = []
        for key, id in keys_to_ids.items():
            if id is None:
                unmapped.append(key)
                continue
            org, string = key.split(":")
            results[int(org)][string] = id

        if not unmapped:
            return results

        new_mapped = self._record_many_strings(unmapped)
        for key, id in new_mapped.items():
            org, string = key.split(":")
            results[int(org)][string] = id

        return results

    def record(self, org_id: int, string: str) -> int:
        """Store a string and return the integer ID generated for it"""
        result = self.bulk_record({org_id: {string}})
        return result[org_id][string]

    def resolve(self, org_id: int, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Returns None if the entry cannot be found.

        """
        key = f"{org_id}:{string}"
        result = indexer_cache.get(key)
        if result and isinstance(result, int):
            metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "true", "caller": "resolve"})
            return result

        metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "false", "caller": "resolve"})
        try:
            id: int = StringIndexerTable.objects.get(organization_id=org_id, string=string).id
        except StringIndexerTable.DoesNotExist:
            return None
        indexer_cache.set(key, id)

        return id

    def reverse_resolve(self, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        result = indexer_cache.get(id)
        if result and isinstance(result, str):
            metrics.incr(
                _INDEXER_CACHE_METRIC, tags={"cache_hit": "true", "caller": "reverse_resolve"}
            )
            return result

        metrics.incr(
            _INDEXER_CACHE_METRIC, tags={"cache_hit": "false", "caller": "reverse_resolve"}
        )
        try:
            string: str = StringIndexerTable.objects.get(id=id).string
        except StringIndexerTable.DoesNotExist:
            return None

        indexer_cache.set(id, string)

        return string

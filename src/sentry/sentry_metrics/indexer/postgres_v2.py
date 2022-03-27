from collections import defaultdict
from functools import reduce
from operator import or_
from typing import Any, MutableMapping, Optional, Sequence, Set, Tuple

from django.db.models import Q

from sentry.sentry_metrics.indexer.cache import indexer_cache
from sentry.sentry_metrics.indexer.models import StringIndexer as StringIndexerTable
from sentry.utils import metrics
from sentry.utils.services import Service

_INDEXER_CACHE_METRIC = "sentry_metrics.indexer.memcache"


class KeyCollection:
    """
    A KeyCollection is a way of keeping track of a group of keys
    used to fetch ids, which are stored as results. There are
    three potential steps to fetching the ids, and each step
    can utilize a new KeyCollection:
        1. ids from cache
        2. ids from existing db records
        3. ids from newly created db records

    A key is a org_id, string pair, either represented as a
    tuple e.g (1, "a"), or a string "1:a".

    Initial mapping is org_id's to sets of strings:
        { 1: {"a", "b", "c"}, 2: {"e", "f"} }

    Resulting ids will be stored in self.results, which is a
    mapping of org_id to string -> int mapping:
        {
            1: {"a": 10, "b": 11, "c": 12},
            2: {"e": 13},
        }

    For any keys that we didn't find ids for in the current
    step (and therefore weren't added to the results) , use
    `get_unmapped_keys` to return a new KeyCollection that
    can be used for the next step in getting those ids.
    """

    def __init__(self, mapping: MutableMapping[int, Set[str]]):
        self.mapping = mapping
        self.results: MutableMapping[int, MutableMapping[str, int]] = {}

    def as_tuples(self) -> Sequence[Tuple[int, str]]:
        """
        Returns all the keys, each key represented as tuple -> (1, "a")
        """
        key_pairs: Sequence[Tuple[int, str]] = []
        for org_id in self.mapping:
            key_pairs.extend([(org_id, string) for string in self.mapping[org_id]])

        return key_pairs

    def as_strings(self) -> Sequence[str]:
        """
        Returns all the keys, each key represented as string -> "1:a"
        """
        keys: Sequence[str] = []
        for org_id in self.mapping:
            keys.extend([f"{org_id}:{string}" for string in self.mapping[org_id]])

        return keys

    def add_key_result(self, key_pair: Tuple[int, str], result: int) -> None:
        """
        For a given key, add the id to the results.
        """
        org_id, string = key_pair
        try:
            self.results[org_id][string] = result
        except KeyError:
            self.results[org_id] = {string: result}

    def get_unmapped_keys(self):
        """
        Return a new KeyCollection for any keys that don't have corresponding
        ids in results.
        """
        unmapped_org_strings: MutableMapping[int, Set[str]] = defaultdict(set)
        for org_id, strings in self.mapping.items():
            for string in strings:
                try:
                    self.results[org_id][string]
                except KeyError:
                    unmapped_org_strings[org_id].add(string)

        return KeyCollection(unmapped_org_strings)

    def get_mapped_results(self) -> MutableMapping[int, MutableMapping[str, int]]:
        """
        Return the results.
        """
        return self.results

    def get_mapped_key_strings_to_ints(self) -> MutableMapping[str, int]:
        """
        Return the results, but formatted as the following:
            {
                "1:a": 10,
                "1:b": 11,
                "1:c", 12,
                "2:e": 13
            }
        This is for when we use indexer_cache.set_many()
        """
        cache_key_results: MutableMapping[str, int] = {}
        for org_id, result_dict in self.results.items():
            for string, id in result_dict.items():
                key = f"{org_id}:{string}"
                cache_key_results[key] = id

        return cache_key_results


class PGStringIndexerV2(Service):
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.
    """

    __all__ = ("record", "resolve", "reverse_resolve", "bulk_record")

    def _get_db_records(self, db_keys: KeyCollection) -> Any:
        conditions = []
        for pair in db_keys.as_tuples():
            organization_id, string = pair
            conditions.append(Q(organization_id=int(organization_id), string=string))

        query_statement = reduce(or_, conditions)

        return StringIndexerTable.objects.filter(query_statement)

    def bulk_record(
        self, org_strings: MutableMapping[int, Set[str]]
    ) -> MutableMapping[int, MutableMapping[str, int]]:
        """
        TODO(meredith): add doc string
        """
        mapped_results: MutableMapping[int, MutableMapping[str, int]] = {}

        cache_keys = KeyCollection(org_strings)

        # Step 1: Lookup ids in the cache and add them to the
        # cache KeyCollection results.
        cache_hits = 0
        cache_misses = 0
        cache_key_strs = cache_keys.as_strings()
        cache_results = indexer_cache.get_many(cache_key_strs)
        for cache_key in cache_key_strs:
            result = cache_results.get(cache_key)
            org_id, string = cache_key.split(":")
            if result:
                cache_keys.add_key_result((int(org_id), string), result)
                cache_hits += 1
            else:
                cache_misses += 1

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
        mapped_results.update(cache_keys.get_mapped_results())

        db_read_keys = cache_keys.get_unmapped_keys()

        if not db_read_keys.as_strings():
            return mapped_results

        # Step 2: Lookup ids in the db and add them to the
        # db_read KeyCollection results.
        for db_obj in self._get_db_records(db_read_keys):
            db_read_keys.add_key_result((db_obj.organization_id, db_obj.string), db_obj.id)

        db_read_key_results = db_read_keys.get_mapped_results()

        if len(db_read_key_results.keys()) > 0:
            results_to_cache = db_read_keys.get_mapped_key_strings_to_ints()
            indexer_cache.set_many(results_to_cache)
            mapped_results.update(db_read_key_results)

        db_write_keys = db_read_keys.get_unmapped_keys()

        if not db_write_keys.as_strings():
            return mapped_results

        # Step 3: Create new records in the db and add them to the
        # db_write KeyCollection results.
        new_records = []
        for write_pair in db_write_keys.as_tuples():
            organization_id, string = write_pair
            new_records.append(
                StringIndexerTable(organization_id=int(organization_id), string=string)
            )

        with metrics.timer("sentry_metrics.indexer.pg_bulk_create"):
            # We use `ignore_conflicts=True` here to avoid race conditions where metric indexer
            # records might have be created between when we queried in `bulk_record` and the
            # attempt to create the rows down below.
            StringIndexerTable.objects.bulk_create(new_records, ignore_conflicts=True)

        for db_obj in self._get_db_records(db_write_keys):
            db_write_keys.add_key_result((db_obj.organization_id, db_obj.string), db_obj.id)

        db_write_key_results = db_write_keys.get_mapped_results()

        if len(db_write_key_results) > 0:
            results_to_cache = db_write_keys.get_mapped_key_strings_to_ints()
            indexer_cache.set_many(results_to_cache)
            mapped_results.update(db_write_key_results)

        return mapped_results

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
        try:
            string: str = StringIndexerTable.objects.get_from_cache(id=id).string
        except StringIndexerTable.DoesNotExist:
            return None

        return string

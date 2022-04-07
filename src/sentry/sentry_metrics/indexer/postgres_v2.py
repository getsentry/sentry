from collections import defaultdict
from dataclasses import dataclass
from functools import reduce
from operator import or_
from typing import (
    Any,
    Mapping,
    MutableMapping,
    MutableSequence,
    Optional,
    Sequence,
    Set,
    Tuple,
    Type,
    TypeVar,
)

from django.db.models import Q

from sentry.sentry_metrics.indexer.cache import indexer_cache
from sentry.sentry_metrics.indexer.models import StringIndexer as StringIndexerTable
from sentry.sentry_metrics.indexer.strings import SHARED_STRINGS
from sentry.utils import metrics
from sentry.utils.services import Service

_INDEXER_CACHE_METRIC = "sentry_metrics.indexer.memcache"
_INDEXER_DB_METRIC = "sentry_metrics.indexer.postgres"
# only used to compare to the older version of the PGIndexer
_INDEXER_CACHE_FETCH_METRIC = "sentry_metrics.indexer.memcache.fetch"


class KeyCollection:
    """
    A KeyCollection is a way of keeping track of a group of keys
    used to fetch ids, whose results are stored in KeyResults.

    A key is a org_id, string pair, either represented as a
    tuple e.g (1, "a"), or a string "1:a".

    Initial mapping is org_id's to sets of strings:
        { 1: {"a", "b", "c"}, 2: {"e", "f"} }
    """

    def __init__(self, mapping: Mapping[int, Set[str]]):
        self.mapping = mapping
        self.size = self._size()

    def _size(self) -> int:
        total_size = 0
        for org_id in self.mapping.keys():
            total_size += len(self.mapping[org_id])
        return total_size

    def as_tuples(self) -> Sequence[Tuple[int, str]]:
        """
        Returns all the keys, each key represented as tuple -> (1, "a")
        """
        key_pairs: MutableSequence[Tuple[int, str]] = []
        for org_id in self.mapping:
            key_pairs.extend([(org_id, string) for string in self.mapping[org_id]])

        return key_pairs

    def as_strings(self) -> Sequence[str]:
        """
        Returns all the keys, each key represented as string -> "1:a"
        """
        keys: MutableSequence[str] = []
        for org_id in self.mapping:
            keys.extend([f"{org_id}:{string}" for string in self.mapping[org_id]])

        return keys


KR = TypeVar("KR", bound="KeyResult")


@dataclass(frozen=True)
class KeyResult:
    org_id: int
    string: str
    id: int

    @classmethod
    def from_string(cls: Type[KR], key: str, id: int) -> KR:
        org_id, string = key.split(":")
        return cls(int(org_id), string, id)


class KeyResults:
    def __init__(self) -> None:
        self.results: MutableMapping[int, MutableMapping[str, int]] = defaultdict(dict)

    @classmethod
    def merge_results(
        cls,
        result_mappings: Sequence[Mapping[int, Mapping[str, int]]],
    ) -> Mapping[int, Mapping[str, int]]:
        new_results: MutableMapping[int, MutableMapping[str, int]] = defaultdict(dict)
        for result_map in result_mappings:
            for org_id, strings in result_map.items():
                new_results[org_id].update(strings)
        return new_results

    def add_key_result(self, key_result: KeyResult) -> None:
        self.results[key_result.org_id].update({key_result.string: key_result.id})

    def add_key_results(self, key_results: Sequence[KeyResult]) -> None:
        for key_result in key_results:
            self.results[key_result.org_id].update({key_result.string: key_result.id})

    def get_mapped_results(self) -> Mapping[int, Mapping[str, int]]:
        """
        Only return results that have org_ids with string/int mappings.
        """
        mapped_results = {k: v for k, v in self.results.items() if len(v) > 0}
        return mapped_results

    def get_unmapped_keys(self, keys: KeyCollection) -> KeyCollection:
        """
        Takes a KeyCollection and compares it to the results. Returns
        a new KeyCollection for any keys that don't have corresponding
        ids in results.
        """
        unmapped_org_strings: MutableMapping[int, Set[str]] = defaultdict(set)
        for org_id, strings in keys.mapping.items():
            for string in strings:
                if not self.results[org_id].get(string):
                    unmapped_org_strings[org_id].add(string)

        return KeyCollection(unmapped_org_strings)

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


def merge_results(
    result_mappings: Sequence[Mapping[int, Mapping[str, int]]],
) -> Mapping[int, Mapping[str, int]]:
    new_results: MutableMapping[int, MutableMapping[str, int]] = defaultdict(dict)
    for result_map in result_mappings:
        for org_id, strings in result_map.items():
            new_results[org_id].update(strings)
    return new_results


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

    def bulk_record(self, org_strings: Mapping[int, Set[str]]) -> Mapping[int, Mapping[str, int]]:
        """
        Takes in a mapping with org_ids to sets of strings.

        Ultimately returns a mapping of those org_ids to a
        string -> id mapping, for each string in the set.

        There are three steps to getting the ids for strings:
            1. ids from cache
            2. ids from existing db records
            3. ids from newly created db records

        Each step will start off with a KeyCollection and KeyResults:
            keys = KeyCollection(mapping)
            key_results = KeyResults()

        Then the work to get the ids (either from cache, db, etc)
            .... # work to add results to KeyResults()

        Those results will be added to `mapped_results`
            key_results.get_mapped_results()

        And any remaining unmapped keys get turned into a new
        KeyCollection for the next step:
            new_keys = key_results.get_unmapped_keys(mapping)
        """
        cache_keys = KeyCollection(org_strings)
        cache_key_strs = cache_keys.as_strings()
        cache_results = indexer_cache.get_many(cache_key_strs)

        hits = [k for k, v in cache_results.items() if v is not None]
        metrics.incr(
            _INDEXER_CACHE_METRIC,
            tags={"cache_hit": "true", "caller": "get_many_ids"},
            amount=len(hits),
        )
        metrics.incr(
            _INDEXER_CACHE_METRIC,
            tags={"cache_hit": "false", "caller": "get_many_ids"},
            amount=len(cache_results) - len(hits),
        )
        # used to compare to pre org_id indexer cache fetch metric
        metrics.incr(
            _INDEXER_CACHE_FETCH_METRIC,
            amount=cache_keys.size,
        )

        cache_key_results = KeyResults()
        cache_key_results.add_key_results(
            [KeyResult.from_string(k, v) for k, v in cache_results.items() if v is not None]
        )

        mapped_cache_results = cache_key_results.get_mapped_results()
        db_read_keys = cache_key_results.get_unmapped_keys(cache_keys)

        if db_read_keys.size == 0:
            return mapped_cache_results

        db_read_key_results = KeyResults()
        db_read_key_results.add_key_results(
            [
                KeyResult(org_id=db_obj.organization_id, string=db_obj.string, id=db_obj.id)
                for db_obj in self._get_db_records(db_read_keys)
            ]
        )
        new_results_to_cache = db_read_key_results.get_mapped_key_strings_to_ints()

        mapped_db_read_results = db_read_key_results.get_mapped_results()
        db_write_keys = db_read_key_results.get_unmapped_keys(db_read_keys)

        metrics.incr(
            _INDEXER_DB_METRIC,
            tags={"db_hit": "true"},
            amount=(db_read_keys.size - db_write_keys.size),
        )
        metrics.incr(
            _INDEXER_DB_METRIC,
            tags={"db_hit": "false"},
            amount=db_write_keys.size,
        )

        if db_write_keys.size == 0:
            indexer_cache.set_many(new_results_to_cache)
            return merge_results([mapped_cache_results, mapped_db_read_results])

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

        db_write_key_results = KeyResults()
        db_write_key_results.add_key_results(
            [
                KeyResult(org_id=db_obj.organization_id, string=db_obj.string, id=db_obj.id)
                for db_obj in self._get_db_records(db_write_keys)
            ]
        )

        new_results_to_cache.update(db_write_key_results.get_mapped_key_strings_to_ints())
        indexer_cache.set_many(new_results_to_cache)

        mapped_db_write_results = db_write_key_results.get_mapped_results()

        return merge_results(
            [mapped_cache_results, mapped_db_read_results, mapped_db_write_results]
        )

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


class Indexer(Service):
    """
    Wrapper for static strings
    """

    __all__ = ("record", "resolve", "reverse_resolve", "bulk_record")

    def __init__(self) -> None:
        self.indexer = PGStringIndexerV2()

    def _get_db_records(self, db_keys: KeyCollection) -> Any:
        return self.indexer._get_db_records(db_keys)

    def bulk_record(
        self, org_strings: MutableMapping[int, Set[str]]
    ) -> Mapping[int, Mapping[str, int]]:
        static_keys = KeyCollection(org_strings)
        static_key_results = KeyResults()
        for org_id, string in static_keys.as_tuples():
            if string in SHARED_STRINGS:
                id = SHARED_STRINGS[string]
                static_key_results.add_key_result(KeyResult(org_id, string, id))

        static_string_results = static_key_results.get_mapped_results()
        org_strings_left = static_key_results.get_unmapped_keys(static_keys)

        if org_strings_left.size == 0:
            return static_string_results

        indexer_results = self.indexer.bulk_record(org_strings_left.mapping)

        return KeyResults().merge_results([static_string_results, indexer_results])

    def record(self, org_id: int, string: str) -> int:
        return self.indexer.record(org_id, string)

    def resolve(self, org_id: int, string: str) -> Optional[int]:
        if string in SHARED_STRINGS:
            org_id = 0
        return self.indexer.resolve(org_id, string)

    def reverse_resolve(self, id: int) -> Optional[str]:
        return self.indexer.reverse_resolve(id)

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

    def __init__(self, mapping: Mapping[int, Set[str]]):
        self.mapping = mapping

    def as_tuples(self) -> MutableSequence[Tuple[int, str]]:
        """
        Returns all the keys, each key represented as tuple -> (1, "a")
        """
        key_pairs: MutableSequence[Tuple[int, str]] = []
        for org_id in self.mapping:
            key_pairs.extend([(org_id, string) for string in self.mapping[org_id]])

        return key_pairs

    def as_strings(self) -> MutableSequence[str]:
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
        self.results: MutableMapping[int, MutableMapping[str, int]] = {}

    def add_key_results(self, key_results: Sequence[KeyResult]) -> None:
        for key_result in key_results:
            try:
                self.results[key_result.org_id][key_result.string] = key_result.id
            except KeyError:
                self.results[key_result.org_id] = {key_result.string: key_result.id}

    def get_mapped_results(self) -> MutableMapping[int, MutableMapping[str, int]]:
        return self.results

    def get_unmapped_keys(self, keys: KeyCollection) -> KeyCollection:
        """
        Takes a KeyCollection and compares it to the results. Returns
        a new KeyCollection for any keys that don't have corresponding
        ids in results.
        """
        unmapped_org_strings: MutableMapping[int, Set[str]] = defaultdict(set)
        for org_id, strings in keys.mapping.items():
            for string in strings:
                try:
                    self.results[org_id][string]
                except KeyError:
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

        cache_key_results = KeyResults()
        cache_key_results.add_key_results(
            [KeyResult.from_string(k, v) for k, v in cache_results.items() if v is not None]
        )

        mapped_results = cache_key_results.get_mapped_results()
        db_read_keys = cache_key_results.get_unmapped_keys(cache_keys)

        if not db_read_keys.as_strings():
            return mapped_results

        db_read_key_results = KeyResults()
        db_read_key_results.add_key_results(
            [
                KeyResult(org_id=db_obj.organization_id, string=db_obj.string, id=db_obj.id)
                for db_obj in self._get_db_records(db_read_keys)
            ]
        )
        new_results_to_cache = db_read_key_results.get_mapped_key_strings_to_ints()

        mapped_results.update(db_read_key_results.get_mapped_results())
        db_write_keys = db_read_key_results.get_unmapped_keys(db_read_keys)

        if not db_write_keys.as_strings():
            indexer_cache.set_many(new_results_to_cache)
            return mapped_results

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

        mapped_results.update(db_write_key_results.get_mapped_results())

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

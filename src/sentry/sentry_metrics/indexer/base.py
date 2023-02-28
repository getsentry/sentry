from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from typing import (
    Mapping,
    MutableMapping,
    MutableSequence,
    NamedTuple,
    Optional,
    Sequence,
    Set,
    Tuple,
    Type,
    TypeVar,
)

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.utils.services import Service


class FetchType(Enum):
    CACHE_HIT = "c"
    HARDCODED = "h"
    DB_READ = "d"
    FIRST_SEEN = "f"
    RATE_LIMITED = "r"


class FetchTypeExt(NamedTuple):
    is_global: bool


KR = TypeVar("KR", bound="KeyResult")


class Metadata(NamedTuple):
    id: Optional[int]
    fetch_type: FetchType
    fetch_type_ext: Optional[FetchTypeExt] = None


@dataclass(frozen=True)
class KeyResult:
    org_id: int
    string: str
    id: Optional[int]

    @classmethod
    def from_string(cls: Type[KR], key: str, id: int) -> KR:
        org_id, string = key.split(":", 1)
        return cls(int(org_id), string, id)


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


class KeyResults:
    def __init__(self) -> None:
        self.results: MutableMapping[int, MutableMapping[str, Optional[int]]] = defaultdict(dict)
        self.meta: MutableMapping[int, MutableMapping[str, Metadata]] = defaultdict(dict)

    def add_key_result(
        self,
        key_result: KeyResult,
        fetch_type: Optional[FetchType] = None,
        fetch_type_ext: Optional[FetchTypeExt] = None,
    ) -> None:
        self.results[key_result.org_id].update({key_result.string: key_result.id})
        if fetch_type:
            self.meta[key_result.org_id][key_result.string] = Metadata(
                id=key_result.id, fetch_type=fetch_type, fetch_type_ext=fetch_type_ext
            )

    def add_key_results(
        self,
        key_results: Sequence[KeyResult],
        fetch_type: Optional[FetchType] = None,
        fetch_type_ext: Optional[FetchTypeExt] = None,
    ) -> None:
        for key_result in key_results:
            self.results[key_result.org_id].update({key_result.string: key_result.id})
            if fetch_type:
                self.meta[key_result.org_id][key_result.string] = Metadata(
                    id=key_result.id, fetch_type=fetch_type, fetch_type_ext=fetch_type_ext
                )

    def get_mapped_results(self) -> Mapping[int, Mapping[str, Optional[int]]]:
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
                if id is not None:
                    cache_key_results[key] = id

        return cache_key_results

    def get_fetch_metadata(
        self,
    ) -> Mapping[int, Mapping[str, Metadata]]:
        return self.meta

    def merge(self, other: "KeyResults") -> "KeyResults":
        new_results: "KeyResults" = KeyResults()

        for org_id, strings in [*other.results.items(), *self.results.items()]:
            new_results.results[org_id].update(strings)

        for org_id, org_meta in self.meta.items():
            new_results.meta[org_id].update(org_meta)

        for org_id, org_meta in other.meta.items():
            new_results.meta[org_id].update(org_meta)

        return new_results

    # For brevity, allow callers to address the mapping directly
    def __getitem__(self, org_id: int) -> Mapping[str, Optional[int]]:
        return self.results[org_id]


class StringIndexer(Service):
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.

    Check `sentry.snuba.metrics` for convenience functions.
    """

    __all__ = (
        "record",
        "resolve",
        "reverse_resolve",
        "bulk_record",
        "resolve_shared_org",
        "reverse_shared_org_resolve",
    )

    def bulk_record(
        self, use_case_id: UseCaseKey, org_strings: Mapping[int, Set[str]]
    ) -> KeyResults:
        """
        Takes in a mapping with org_ids to sets of strings.

        Ultimately returns a mapping of those org_ids to a
        string -> id mapping, for each string in the set.

        There are three steps to getting the ids for strings:
            0. ids from static strings (StaticStringIndexer)
            1. ids from cache (CachingIndexer)
            2. ids from existing db records (postgres/spanner)
            3. ids that have been rate limited (postgres/spanner)
            4. ids from newly created db records (postgres/spanner)

        Each step will start off with a KeyCollection and KeyResults:
            keys = KeyCollection(mapping)
            key_results = KeyResults()

        Then the work to get the ids (either from cache, db, etc)
            .... # work to add results to KeyResults()

        Those results will be added to `mapped_results` which can
        be retrieved
            key_results.get_mapped_results()

        Remaining unmapped keys get turned into a new
        KeyCollection for the next step:
            new_keys = key_results.get_unmapped_keys(mapping)

        When the last step is reached or a step resolves all the remaining
        unmapped keys the key_results objects are merged and returned:
            e.g. return cache_key_results.merge(db_read_key_results)
        """
        raise NotImplementedError()

    def record(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        """Store a string and return the integer ID generated for it

        With every call to this method, the lifetime of the entry will be
        prolonged.
        """
        raise NotImplementedError()

    def resolve(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Does not affect the lifetime of the entry.

        Callers should not rely on the default use_case_id -- it exists only
        as a temporary workaround.

        Returns None if the entry cannot be found.
        """
        raise NotImplementedError()

    def reverse_resolve(self, use_case_id: UseCaseKey, org_id: int, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Callers should not rely on the default use_case_id -- it exists only
        as a temporary workaround.

        Returns None if the entry cannot be found.
        """
        raise NotImplementedError()

    def resolve_shared_org(self, string: str) -> Optional[int]:
        """
        Look up the index for a shared (cross organisation) string.

        Typically, this function will only lookup strings that are statically defined but
        regardless of the mechanism these are strings that are not organisation or use-case specific.
        """
        raise NotImplementedError()

    def reverse_shared_org_resolve(self, id: int) -> Optional[str]:
        """Lookup the stored string given integer for a shared (cross organisation) ID.

        Returns None if the entry cannot be found.
        """
        raise NotImplementedError()

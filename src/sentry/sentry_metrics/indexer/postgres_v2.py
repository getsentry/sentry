from functools import reduce
from operator import or_
from typing import Any, Mapping, Optional, Set, Type

from django.db.models import Q

from sentry.sentry_metrics.configuration import DbKey, UseCaseKey, get_ingest_config
from sentry.sentry_metrics.indexer.base import KeyCollection, KeyResult, KeyResults, StringIndexer
from sentry.sentry_metrics.indexer.cache import indexer_cache
from sentry.sentry_metrics.indexer.models import BaseIndexer, PerfStringIndexer
from sentry.sentry_metrics.indexer.models import StringIndexer as StringIndexerTable
from sentry.sentry_metrics.indexer.strings import REVERSE_SHARED_STRINGS, SHARED_STRINGS
from sentry.utils import metrics

from .base import FetchType

_INDEXER_CACHE_METRIC = "sentry_metrics.indexer.memcache"
_INDEXER_DB_METRIC = "sentry_metrics.indexer.postgres"
# only used to compare to the older version of the PGIndexer
_INDEXER_CACHE_FETCH_METRIC = "sentry_metrics.indexer.memcache.fetch"

IndexerTable = Type[BaseIndexer]

TABLE_MAPPING: Mapping[DbKey, IndexerTable] = {
    DbKey.STRING_INDEXER: StringIndexerTable,
    DbKey.PERF_STRING_INDEXER: PerfStringIndexer,
}


class PGStringIndexerV2(StringIndexer):
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.
    """

    def _get_db_records(self, use_case_id: UseCaseKey, db_keys: KeyCollection) -> Any:
        conditions = []
        for pair in db_keys.as_tuples():
            organization_id, string = pair
            conditions.append(Q(organization_id=int(organization_id), string=string))

        query_statement = reduce(or_, conditions)

        return self._table(use_case_id).objects.filter(query_statement)

    def bulk_record(
        self, org_strings: Mapping[int, Set[str]], use_case_id: UseCaseKey
    ) -> KeyResults:
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

        cache_keys = KeyCollection(org_strings)
        metrics.gauge("sentry_metrics.indexer.lookups_per_batch", value=cache_keys.size)
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
            [KeyResult.from_string(k, v) for k, v in cache_results.items() if v is not None],
            FetchType.CACHE_HIT,
        )

        db_read_keys = cache_key_results.get_unmapped_keys(cache_keys)

        if db_read_keys.size == 0:
            return cache_key_results

        db_read_key_results = KeyResults()
        db_read_key_results.add_key_results(
            [
                KeyResult(org_id=db_obj.organization_id, string=db_obj.string, id=db_obj.id)
                for db_obj in self._get_db_records(use_case_id, db_read_keys)
            ],
            FetchType.DB_READ,
        )
        new_results_to_cache = db_read_key_results.get_mapped_key_strings_to_ints()
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
            return cache_key_results.merge(db_read_key_results)

        new_records = []
        for write_pair in db_write_keys.as_tuples():
            organization_id, string = write_pair
            new_records.append(
                self._table(use_case_id)(organization_id=int(organization_id), string=string)
            )

        with metrics.timer("sentry_metrics.indexer.pg_bulk_create"):
            # We use `ignore_conflicts=True` here to avoid race conditions where metric indexer
            # records might have be created between when we queried in `bulk_record` and the
            # attempt to create the rows down below.
            self._table(use_case_id).objects.bulk_create(new_records, ignore_conflicts=True)

        db_write_key_results = KeyResults()
        db_write_key_results.add_key_results(
            [
                KeyResult(org_id=db_obj.organization_id, string=db_obj.string, id=db_obj.id)
                for db_obj in self._get_db_records(use_case_id, db_write_keys)
            ],
            fetch_type=FetchType.FIRST_SEEN,
        )

        new_results_to_cache.update(db_write_key_results.get_mapped_key_strings_to_ints())
        indexer_cache.set_many(new_results_to_cache)

        return cache_key_results.merge(db_read_key_results).merge(db_write_key_results)

    def record(self, org_id: int, string: str, use_case_id: UseCaseKey) -> int:
        """Store a string and return the integer ID generated for it"""
        result = self.bulk_record(use_case_id=use_case_id, org_strings={org_id: {string}})
        return result[org_id][string]

    def resolve(
        self, org_id: int, string: str, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[int]:
        """Lookup the integer ID for a string.

        Returns None if the entry cannot be found.

        """
        key = f"{org_id}:{string}"
        result = indexer_cache.get(key)
        table = self._table(use_case_id)

        if result and isinstance(result, int):
            metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "true", "caller": "resolve"})
            return result

        metrics.incr(_INDEXER_CACHE_METRIC, tags={"cache_hit": "false", "caller": "resolve"})
        try:
            id: int = table.objects.using_replica().get(organization_id=org_id, string=string).id
        except table.DoesNotExist:
            return None
        indexer_cache.set(key, id)

        return id

    def reverse_resolve(
        self, id: int, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        table = self._table(use_case_id)
        try:
            string: str = table.objects.get_from_cache(id=id, use_replica=True).string
        except table.DoesNotExist:
            return None

        return string

    def _table(self, use_case_id: UseCaseKey) -> IndexerTable:
        return TABLE_MAPPING[get_ingest_config(use_case_id).db_model]


class StaticStringsIndexerDecorator(StringIndexer):
    """
    Wrapper for static strings
    """

    def __init__(self) -> None:
        self.indexer = PGStringIndexerV2()

    def bulk_record(
        self, org_strings: Mapping[int, Set[str]], use_case_id: UseCaseKey
    ) -> KeyResults:
        static_keys = KeyCollection(org_strings)
        static_key_results = KeyResults()
        for org_id, string in static_keys.as_tuples():
            if string in SHARED_STRINGS:
                id = SHARED_STRINGS[string]
                static_key_results.add_key_result(
                    KeyResult(org_id, string, id), FetchType.HARDCODED
                )

        org_strings_left = static_key_results.get_unmapped_keys(static_keys)

        if org_strings_left.size == 0:
            return static_key_results

        indexer_results = self.indexer.bulk_record(
            use_case_id=use_case_id, org_strings=org_strings_left.mapping
        )

        return static_key_results.merge(indexer_results)

    def record(self, org_id: int, string: str, use_case_id: UseCaseKey) -> int:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self.indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)

    def resolve(
        self, org_id: int, string: str, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[int]:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self.indexer.resolve(use_case_id=use_case_id, org_id=org_id, string=string)

    def reverse_resolve(
        self, id: int, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[str]:
        if id in REVERSE_SHARED_STRINGS:
            return REVERSE_SHARED_STRINGS[id]
        return self.indexer.reverse_resolve(use_case_id=use_case_id, id=id)

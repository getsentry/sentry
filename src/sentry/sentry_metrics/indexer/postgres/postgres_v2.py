from functools import reduce
from operator import or_
from typing import Any, Mapping, Optional, Set

from django.conf import settings
from django.db.models import Q

from sentry.sentry_metrics.configuration import IndexerStorage, UseCaseKey, get_ingest_config
from sentry.sentry_metrics.indexer.base import (
    FetchType,
    KeyCollection,
    KeyResult,
    KeyResults,
    StringIndexer,
)
from sentry.sentry_metrics.indexer.cache import CachingIndexer, StringIndexerCache
from sentry.sentry_metrics.indexer.limiters.writes import writes_limiter_factory
from sentry.sentry_metrics.indexer.postgres.models import TABLE_MAPPING, IndexerTable
from sentry.sentry_metrics.indexer.strings import StaticStringIndexer
from sentry.utils import metrics

__all__ = ["PostgresIndexer"]


_INDEXER_CACHE_METRIC = "sentry_metrics.indexer.memcache"
_INDEXER_DB_METRIC = "sentry_metrics.indexer.postgres"

_PARTITION_KEY = "pg"

indexer_cache = StringIndexerCache(
    **settings.SENTRY_STRING_INDEXER_CACHE_OPTIONS, partition_key=_PARTITION_KEY
)


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
        self, use_case_id: UseCaseKey, org_strings: Mapping[int, Set[str]]
    ) -> KeyResults:
        db_read_keys = KeyCollection(org_strings)

        db_read_key_results = KeyResults()
        db_read_key_results.add_key_results(
            [
                KeyResult(org_id=db_obj.organization_id, string=db_obj.string, id=db_obj.id)
                for db_obj in self._get_db_records(use_case_id, db_read_keys)
            ],
            FetchType.DB_READ,
        )
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
            return db_read_key_results

        config = get_ingest_config(use_case_id, IndexerStorage.POSTGRES)
        writes_limiter = writes_limiter_factory.get_ratelimiter(config)

        with writes_limiter.check_write_limits(use_case_id, db_write_keys) as writes_limiter_state:
            # After the DB has successfully committed writes, we exit this
            # context manager and consume quotas. If the DB crashes we
            # shouldn't consume quota.
            filtered_db_write_keys = writes_limiter_state.accepted_keys
            del db_write_keys

            rate_limited_key_results = KeyResults()
            for dropped_string in writes_limiter_state.dropped_strings:
                rate_limited_key_results.add_key_result(
                    dropped_string.key_result,
                    fetch_type=dropped_string.fetch_type,
                    fetch_type_ext=dropped_string.fetch_type_ext,
                )

            if filtered_db_write_keys.size == 0:
                return db_read_key_results.merge(rate_limited_key_results)

            new_records = []
            for write_pair in filtered_db_write_keys.as_tuples():
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
                for db_obj in self._get_db_records(use_case_id, filtered_db_write_keys)
            ],
            fetch_type=FetchType.FIRST_SEEN,
        )

        return db_read_key_results.merge(db_write_key_results).merge(rate_limited_key_results)

    def record(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        """Store a string and return the integer ID generated for it"""
        result = self.bulk_record(use_case_id=use_case_id, org_strings={org_id: {string}})
        return result[org_id][string]

    def resolve(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Returns None if the entry cannot be found.

        """
        table = self._table(use_case_id)
        try:
            id: int = table.objects.using_replica().get(organization_id=org_id, string=string).id
        except table.DoesNotExist:
            return None

        return id

    def reverse_resolve(self, use_case_id: UseCaseKey, org_id: int, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        table = self._table(use_case_id)
        try:
            obj = table.objects.get_from_cache(id=id, use_replica=True)
        except table.DoesNotExist:
            return None

        assert obj.organization_id == org_id
        string: str = obj.string
        return string

    def _table(self, use_case_id: UseCaseKey) -> IndexerTable:
        return TABLE_MAPPING[use_case_id]


class PostgresIndexer(StaticStringIndexer):
    def __init__(self) -> None:
        super().__init__(CachingIndexer(indexer_cache, PGStringIndexerV2()))

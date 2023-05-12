from functools import reduce
from operator import or_
from time import sleep
from typing import Any, Collection, Mapping, Optional, Sequence, Set

import sentry_sdk
from django.conf import settings
from django.db.models import Q
from psycopg2 import OperationalError
from psycopg2.errorcodes import DEADLOCK_DETECTED

from sentry.sentry_metrics.configuration import IndexerStorage, UseCaseKey, get_ingest_config
from sentry.sentry_metrics.indexer.base import (
    FetchType,
    OrgId,
    StringIndexer,
    UseCaseKeyCollection,
    UseCaseKeyResult,
    UseCaseKeyResults,
)
from sentry.sentry_metrics.indexer.cache import CachingIndexer, StringIndexerCache
from sentry.sentry_metrics.indexer.limiters.writes import writes_limiter_factory
from sentry.sentry_metrics.indexer.postgres.models import TABLE_MAPPING, BaseIndexer, IndexerTable
from sentry.sentry_metrics.indexer.strings import StaticStringIndexer
from sentry.sentry_metrics.use_case_id_registry import METRIC_PATH_MAPPING, UseCaseID
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

    def _get_db_records(self, db_use_case_keys: UseCaseKeyCollection) -> Any:
        """
        We are not querying for the use case ID because the order of
        operations for our changes needs to be:
        >>> 1. Change write path
            2. do DB backfill
            3. Change Read path (this code)
        We are currently at step 1
        """
        conditions = [
            Q(organization_id=int(organization_id), string=string)
            for _, organization_id, string in db_use_case_keys.as_tuples()
        ]

        return self._get_table_from_use_case_ids(db_use_case_keys.mapping.keys()).objects.filter(
            reduce(or_, conditions)
        )

    def _bulk_create_with_retry(
        self, table: IndexerTable, new_records: Sequence[BaseIndexer]
    ) -> None:
        """
        With multiple instances of the Postgres indexer running, we found that
        rather than direct insert conflicts we were actually observing deadlocks
        on insert. Here we surround bulk_create with a catch for the deadlock error
        specifically so that we don't interrupt processing or raise an error for a
        fairly normal event.
        """
        retry_count = 0
        sleep_ms = 5
        last_seen_exception: Optional[BaseException] = None

        with metrics.timer("sentry_metrics.indexer.pg_bulk_create"):
            # We use `ignore_conflicts=True` here to avoid race conditions where metric indexer
            # records might have be created between when we queried in `bulk_record` and the
            # attempt to create the rows down below.
            while retry_count + 1 < settings.SENTRY_POSTGRES_INDEXER_RETRY_COUNT:
                try:
                    table.objects.bulk_create(new_records, ignore_conflicts=True)
                    return
                except OperationalError as e:
                    sentry_sdk.capture_message(
                        f"retryable deadlock exception encountered; pgcode={e.pgcode}, pgerror={e.pgerror}"
                    )
                    if e.pgcode == DEADLOCK_DETECTED:
                        metrics.incr("sentry_metrics.indexer.pg_bulk_create.deadlocked")
                        retry_count += 1
                        sleep(sleep_ms / 1000 * (2**retry_count))
                        last_seen_exception = e
                    else:
                        raise e
            # If we haven't returned after successful bulk create, we should re-raise the last
            # seen exception
            assert isinstance(last_seen_exception, BaseException)
            raise last_seen_exception

    def bulk_record(
        self, strings: Mapping[UseCaseID, Mapping[OrgId, Set[str]]]
    ) -> UseCaseKeyResults:
        db_read_keys = UseCaseKeyCollection(strings)

        db_read_key_results = UseCaseKeyResults()
        db_read_key_results.add_use_case_key_results(
            [
                UseCaseKeyResult(
                    use_case_id=(
                        UseCaseID.TRANSACTIONS
                        if self._get_metric_path_key(strings.keys()) is UseCaseKey.PERFORMANCE
                        else UseCaseID.SESSIONS
                    ),
                    org_id=db_obj.organization_id,
                    string=db_obj.string,
                    id=db_obj.id,
                )
                for db_obj in self._get_db_records(db_read_keys)
            ],
            FetchType.DB_READ,
        )
        db_write_keys = db_read_key_results.get_unmapped_use_case_keys(db_read_keys)

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

        config = get_ingest_config(
            self._get_metric_path_key(strings.keys()), IndexerStorage.POSTGRES
        )
        writes_limiter = writes_limiter_factory.get_ratelimiter(config)

        """
        Changes to writes_limiter will happen in a separate PR.
        For now, we are going to operate on the assumption that no custom use case ID
        will enter this part of the code path. Therethere strings can only be one of the
        follow 2 types:
        {
            "sessions" : {
                org_id_1: ... ,
                org_id_n: ... ,
            }
        }
        {
            "transactions" : {
                org_id_1: ... ,
                org_id_n: ... ,
            }
        }
        """
        use_case_id = next(iter(strings.keys()))
        use_case_path_key = self._get_metric_path_key(strings.keys())
        with writes_limiter.check_write_limits(db_write_keys) as writes_limiter_state:
            # After the DB has successfully committed writes, we exit this
            # context manager and consume quotas. If the DB crashes we
            # shouldn't consume quota.
            use_case_collection = writes_limiter_state.accepted_keys
            # TODO: later we will use the whole use case collection instead
            # of pulling out the key collection
            filtered_db_write_keys = use_case_collection.mapping[use_case_id]
            del db_write_keys

            rate_limited_key_results = UseCaseKeyResults()
            for dropped_string in writes_limiter_state.dropped_strings:
                key_result = dropped_string.key_result
                rate_limited_key_results.add_use_case_key_result(
                    UseCaseKeyResult(
                        use_case_id, key_result.org_id, key_result.string, key_result.id
                    ),
                    fetch_type=dropped_string.fetch_type,
                    fetch_type_ext=dropped_string.fetch_type_ext,
                )

            if filtered_db_write_keys.size == 0:
                return db_read_key_results.merge(rate_limited_key_results)

            if use_case_path_key is UseCaseKey.PERFORMANCE:
                new_records = [
                    self._get_table_from_use_case_ids(strings.keys())(
                        organization_id=int(organization_id),
                        string=string,
                        use_case_id=use_case_id.value,
                    )
                    for organization_id, string in filtered_db_write_keys.as_tuples()
                ]
            else:
                new_records = [
                    self._get_table_from_use_case_ids(strings.keys())(
                        organization_id=int(organization_id),
                        string=string,
                    )
                    for organization_id, string in filtered_db_write_keys.as_tuples()
                ]

            with metrics.timer("sentry_metrics.indexer.pg_bulk_create"):
                self._bulk_create_with_retry(
                    self._get_table_from_use_case_ids(strings.keys()), new_records
                )

        db_write_key_results = UseCaseKeyResults()
        db_write_key_results.add_use_case_key_results(
            [
                UseCaseKeyResult(
                    use_case_id,
                    org_id=db_obj.organization_id,
                    string=db_obj.string,
                    id=db_obj.id,
                )
                for db_obj in self._get_db_records(
                    UseCaseKeyCollection({use_case_id: filtered_db_write_keys})
                )
            ],
            fetch_type=FetchType.FIRST_SEEN,
        )

        return db_read_key_results.merge(db_write_key_results).merge(rate_limited_key_results)

    def record(self, use_case_id: UseCaseID, org_id: int, string: str) -> Optional[int]:
        result = self.bulk_record(strings={use_case_id: {org_id: {string}}})
        return result[use_case_id][org_id][string]

    def resolve(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Returns None if the entry cannot be found.

        """
        table = self._get_table_from_metric_path_key(use_case_id)
        try:
            id: int = table.objects.using_replica().get(organization_id=org_id, string=string).id
        except table.DoesNotExist:
            return None

        return id

    def reverse_resolve(self, use_case_id: UseCaseKey, org_id: int, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        table = self._get_table_from_metric_path_key(use_case_id)
        try:
            obj = table.objects.get_from_cache(id=id, use_replica=True)
        except table.DoesNotExist:
            return None

        assert obj.organization_id == org_id
        string: str = obj.string
        return string

    def _get_metric_path_key(self, use_case_ids: Collection[UseCaseID]) -> UseCaseKey:
        metrics_paths = {METRIC_PATH_MAPPING[use_case_id] for use_case_id in use_case_ids}
        if len(metrics_paths) > 1:
            raise ValueError(
                f"The set of use_case_ids: {use_case_ids} maps to multiple metric path keys"
            )
        return next(iter(metrics_paths))

    def _get_table_from_use_case_ids(self, use_case_ids: Collection[UseCaseID]) -> IndexerTable:
        return TABLE_MAPPING[self._get_metric_path_key(use_case_ids)]

    def _get_table_from_metric_path_key(self, metric_path_key: UseCaseKey) -> IndexerTable:
        return TABLE_MAPPING[metric_path_key]

    def resolve_shared_org(self, string: str) -> Optional[int]:
        raise NotImplementedError(
            "This class should not be used directly, use the wrapping class PostgresIndexer"
        )

    def reverse_shared_org_resolve(self, id: int) -> Optional[str]:
        raise NotImplementedError(
            "This class should not be used directly, use the wrapping class PostgresIndexer"
        )


class PostgresIndexer(StaticStringIndexer):
    def __init__(self) -> None:
        super().__init__(CachingIndexer(indexer_cache, PGStringIndexerV2()))

import hashlib
from typing import Mapping, Set

from django.conf import settings

from sentry.sentry_metrics.indexer.base import (
    FetchType,
    OrgId,
    StringIndexer,
    UseCaseKeyCollection,
    UseCaseKeyResult,
    UseCaseKeyResults,
)
from sentry.sentry_metrics.indexer.cache import CachingIndexer, StringIndexerCache
from sentry.sentry_metrics.indexer.strings import StaticStringIndexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID


class Sha1Indexer(StringIndexer):
    def __init__(self) -> None:
        super().__init__()

    def bulk_record(
        self, strings: Mapping[UseCaseID, Mapping[OrgId, Set[str]]]
    ) -> UseCaseKeyResults:
        keys = UseCaseKeyCollection(strings)
        res = UseCaseKeyResults()
        for use_case_id, org_id, string in keys.as_tuples():
            id = int(hashlib.sha1(string.encode("utf-8")).hexdigest(), 16) % 10**64
            res.add_use_case_key_result(
                UseCaseKeyResult(use_case_id, org_id, string, id), FetchType.DB_READ
            )
        return res


indexer_cache = StringIndexerCache(
    **settings.SENTRY_STRING_INDEXER_CACHE_OPTIONS, partition_key="exp"
)


class StaticSha1Indexer(StaticStringIndexer):
    def __init__(self) -> None:
        super().__init__(CachingIndexer(indexer_cache, Sha1Indexer()))

from typing import Mapping, Type

from sentry.sentry_metrics.configuration import DbKey
from sentry.sentry_metrics.indexer.models import BaseIndexer, PerfStringIndexer, StringIndexer

IndexerTable = Type[BaseIndexer]

TABLE_MAPPING: Mapping[DbKey, IndexerTable] = {
    DbKey.STRING_INDEXER: StringIndexer,
    DbKey.PERF_STRING_INDEXER: PerfStringIndexer,
}

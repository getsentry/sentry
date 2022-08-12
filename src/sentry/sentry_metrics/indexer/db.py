from typing import Mapping, Type

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.models import BaseIndexer, PerfStringIndexer, StringIndexer

IndexerTable = Type[BaseIndexer]

TABLE_MAPPING: Mapping[UseCaseKey, IndexerTable] = {
    UseCaseKey.RELEASE_HEALTH: StringIndexer,
    UseCaseKey.PERFORMANCE: PerfStringIndexer,
}

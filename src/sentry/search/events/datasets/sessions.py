from typing import Callable, Mapping, Optional

from sentry.api.event_search import SearchFilter
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import RELEASE_ALIAS
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import SnQLFunction
from sentry.search.events.types import SelectType, WhereType


class SessionsDatasetConfig(DatasetConfig):
    def __init__(self, builder: QueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            RELEASE_ALIAS: self._release_filter_converter,
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {}

    @property
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        return {}

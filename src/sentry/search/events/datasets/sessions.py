from functools import reduce
from typing import Callable, Mapping, Optional

from sentry.api.event_search import SearchFilter, SearchValue
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import RELEASE_ALIAS
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import SnQLFunction
from sentry.search.events.filter import to_list
from sentry.search.events.types import SelectType, WhereType
from sentry.search.utils import parse_release


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
        return []

    def _release_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """Parse releases for potential aliases like `latest`"""

        if search_filter.value.is_wildcard():
            operator = search_filter.operator
            value = search_filter.value
        else:
            operator_conversions = {"=": "IN", "!=": "NOT IN"}
            operator = operator_conversions.get(search_filter.operator, search_filter.operator)
            value = SearchValue(
                reduce(
                    lambda x, y: x + y,
                    [
                        parse_release(
                            v,
                            self.builder.params["project_id"],
                            self.builder.params.get("environment_objects"),
                            self.builder.params.get("organization_id"),
                        )
                        for v in to_list(search_filter.value.value)
                    ],
                    [],
                )
            )

        return self.builder._default_filter_converter(
            SearchFilter(search_filter.key, operator, value)
        )

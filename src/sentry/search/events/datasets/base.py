import abc
from typing import Callable, Mapping, Optional

from sentry.api.event_search import SearchFilter
from sentry.search.events.fields import SnQLFunction
from sentry.search.events.types import SelectType, WhereType


class DatasetConfig(abc.ABC):
    custom_threshold_columns = {}

    @property
    @abc.abstractmethod
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        pass

    @property
    @abc.abstractmethod
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        pass

    @property
    @abc.abstractmethod
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        pass

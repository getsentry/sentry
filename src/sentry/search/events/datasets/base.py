import abc
from typing import Any, Callable, Dict, List, Mapping, Optional, Set

from snuba_sdk import OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import fields
from sentry.search.events.types import SelectType, WhereType


class DatasetConfig(abc.ABC):
    custom_threshold_columns: Set[str] = set()
    non_nullable_keys: Set[str] = set()
    missing_function_error = InvalidSearchQuery

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
    def function_converter(self) -> Mapping[str, fields.SnQLFunction]:
        pass

    @property
    @abc.abstractmethod
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        pass

    def reflective_result_type(
        self, index: int = 0
    ) -> Callable[[List[fields.FunctionArg], Dict[str, Any]], str]:
        """Return the type of the metric, default to duration

        based on fields.reflective_result_type, but in this config since we need the _custom_measurement_cache
        """

        def result_type_fn(
            function_arguments: List[fields.FunctionArg], parameter_values: Dict[str, Any]
        ) -> str:
            argument = function_arguments[index]
            value = parameter_values[argument.name]
            if (field_type := self.builder.get_field_type(value)) is not None:  # type: ignore
                return field_type
            else:
                return argument.get_type(value)

        return result_type_fn

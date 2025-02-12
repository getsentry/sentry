from __future__ import annotations

import abc
from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING, Any, ClassVar

if TYPE_CHECKING:
    from sentry.search.events.builder.base import BaseQueryBuilder

from snuba_sdk import OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import fields
from sentry.search.events.types import SelectType, WhereType


class DatasetConfig(abc.ABC):
    custom_threshold_columns: set[str] = set()
    non_nullable_keys: set[str] = set()
    nullable_context_keys: set[str] = set()
    missing_function_error: ClassVar[type[Exception]] = InvalidSearchQuery
    optimize_wildcard_searches = False
    subscriptables_with_index: set[str] = set()

    def __init__(self, builder: BaseQueryBuilder):
        pass

    @property
    @abc.abstractmethod
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
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
    ) -> Callable[[list[fields.FunctionArg], dict[str, Any]], str]:
        """Return the type of the metric, default to duration

        based on fields.reflective_result_type, but in this config since we need the _custom_measurement_cache
        """

        def result_type_fn(
            function_arguments: list[fields.FunctionArg], parameter_values: dict[str, Any]
        ) -> str:
            argument = function_arguments[index]
            value = parameter_values[argument.name]
            if (field_type := self.builder.get_field_type(value)) is not None:  # type: ignore[attr-defined]
                return field_type
            else:
                return argument.get_type(value)

        return result_type_fn

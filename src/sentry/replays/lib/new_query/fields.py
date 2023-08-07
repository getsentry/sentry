from __future__ import annotations

import datetime
from typing import Callable, Generic, Mapping, Type

from snuba_sdk import Condition

from sentry.api.event_search import SearchFilter
from sentry.replays.lib.new_query.conditions import GenericBase, T


class Field(Generic[T]):
    def __init__(self, parse: Callable[[str], T], query: Type[GenericBase[T]]) -> None:
        self.parse = parse
        self.query = query

    def apply(self, column_name: str, search_filter: SearchFilter) -> Condition:
        operator = search_filter.operator
        value = search_filter.value.raw_value

        if isinstance(value, (str, int, datetime.datetime)):
            parsed_value = self.parse(str(value))
            if search_filter.value.is_wildcard():
                return self._apply_wildcard(column_name, operator, parsed_value)
            else:
                return self._apply_scalar(column_name, operator, parsed_value)
        else:
            parsed_values = [self.parse(str(v)) for v in value]
            return self._apply_composite(column_name, operator, parsed_values)

    def _apply_wildcard(self, column_name: str, operator: str, value: T) -> Condition:
        if operator == "=":
            visitor = self.query.visit_match
        elif operator == "!=":
            visitor = self.query.visit_not_match
        else:
            raise Exception(f"Unsupported wildcard search operator: '{operator}'")

        return visitor(column_name, value)

    def _apply_composite(self, column_name: str, operator: str, value: list[T]) -> Condition:
        if operator == "IN":
            visitor = self.query.visit_in
        elif operator == "NOT IN":
            visitor = self.query.visit_not_in
        else:
            raise Exception(f"Unsupported composite search operator: '{operator}'")

        return visitor(column_name, value)

    def _apply_scalar(self, column_name: str, operator: str, value: T) -> Condition:
        if operator == "=":
            visitor = self.query.visit_eq
        elif operator == "!=":
            visitor = self.query.visit_neq
        elif operator == ">":
            visitor = self.query.visit_gt
        elif operator == ">=":
            visitor = self.query.visit_gte
        elif operator == "<":
            visitor = self.query.visit_lt
        elif operator == "<=":
            visitor = self.query.visit_lte
        else:
            raise Exception(f"Unsupported search operator: '{operator}'")

        return visitor(column_name, value)


QueryConfig = Mapping[str, Field]

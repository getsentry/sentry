from __future__ import annotations

import datetime
from typing import TypeVar

from snuba_sdk import Condition

from sentry.api.event_search import SearchFilter
from sentry.replays.lib.new_query.fields import BaseField

T = TypeVar("T")


class ComputedField(BaseField[T]):
    def apply(self, search_filter: SearchFilter) -> Condition:
        """Apply a search operation against any named expression.

        A named expression can be a column name or an expression alias.
        """
        operator = search_filter.operator
        value = search_filter.value.value

        if isinstance(value, (str, int, datetime.datetime)):
            parsed_value = self.parse(str(value))

            if search_filter.value.is_wildcard():
                applicable = self._apply_wildcard
            else:
                applicable = self._apply_scalar

            return applicable(operator, parsed_value)
        else:
            parsed_value = [self.parse(str(v)) for v in value]
            return self._apply_composite(operator, parsed_value)

    def _apply_wildcard(self, operator: str, value: T) -> Condition:
        if operator == "=":
            visitor = self.query.visit_match
        elif operator == "!=":
            visitor = self.query.visit_not_match
        else:
            raise Exception(f"Unsupported wildcard search operator: '{operator}'")

        return visitor(value)

    def _apply_composite(self, operator: str, value: list[T]) -> Condition:
        if operator == "IN":
            visitor = self.query.visit_in
        elif operator == "NOT IN":
            visitor = self.query.visit_not_in
        else:
            raise Exception(f"Unsupported composite search operator: '{operator}'")

        return visitor(value)

    def _apply_scalar(self, operator: str, value: T) -> Condition:
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

        return visitor(value)


class TagField(BaseField[T]):
    def apply(self, key: str, search_filter: SearchFilter) -> Condition:
        """Apply a search operation against any named expression.

        A named expression can be a column name or an expression alias.
        """
        operator = search_filter.operator
        value = search_filter.value.value

        if isinstance(value, (str, int, datetime.datetime)):
            parsed_value = self.parse(str(value))

            if search_filter.value.is_wildcard():
                applicable = self._apply_wildcard
            else:
                applicable = self._apply_scalar

            return applicable(key, operator, parsed_value)
        else:
            parsed_value = [self.parse(str(v)) for v in value]
            return self._apply_composite(key, operator, parsed_value)

    def _apply_wildcard(self, key: str, operator: str, value: T) -> Condition:
        if operator == "=":
            visitor = self.query.visit_match
        elif operator == "!=":
            visitor = self.query.visit_not_match
        else:
            raise Exception(f"Unsupported wildcard search operator: '{operator}'")

        return visitor(key, value)

    def _apply_composite(self, key: str, operator: str, value: list[T]) -> Condition:
        if operator == "IN":
            visitor = self.query.visit_in
        elif operator == "NOT IN":
            visitor = self.query.visit_not_in
        else:
            raise Exception(f"Unsupported composite search operator: '{operator}'")

        return visitor(key, value)

    def _apply_scalar(self, key: str, operator: str, value: T) -> Condition:
        if operator == "=":
            visitor = self.query.visit_eq
        elif operator == "!=":
            visitor = self.query.visit_neq
        else:
            raise Exception(f"Unsupported search operator: '{operator}'")

        return visitor(key, value)

from __future__ import annotations

import datetime
from typing import Callable, Generic, Type, TypeVar

from snuba_sdk import Condition

from sentry.api.event_search import SearchFilter
from sentry.replays.lib.new_query.parsers import parse_str
from sentry.replays.usecases.query.conditions import SumOfTagScalar
from sentry.replays.usecases.query.conditions.base import ComputedBase

T = TypeVar("T")


# Computed fields drop `expression` as their first argument to the `apply` method.  This means the
# condition class determines the expression it targets.  ComputedFields exist to support
# hard-coded expression use-cases where the implementation can-not or should-not be made generic.
#
# From a programmatic perspective, ComputedFields serve two purposes.  One, they expose an
# interface which the caller understands.  And two, they validate operator and value inputs and
# route to the correct visitor method.


class ComputedField(Generic[T]):
    def __init__(self, parse: Callable[[str], T], query: Type[ComputedBase]) -> None:
        self.parse = parse
        self.query = query

    def apply(self, search_filter: SearchFilter) -> Condition:
        """Apply a search operation against any named expression.

        A named expression can be a column name or an expression alias.
        """
        operator = search_filter.operator
        value = search_filter.value.value

        if isinstance(value, (str, int, float, datetime.datetime)):
            parsed_value = self.parse(str(value))

            if search_filter.value.is_wildcard():
                applicable = self._apply_wildcard
            else:
                applicable = self._apply_scalar

            return applicable(operator, parsed_value)
        else:
            parsed_values = [self.parse(str(v)) for v in value]
            return self._apply_composite(operator, parsed_values)

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


# TagFields accept a "key" as one of their arguments to the apply method.  This is a user-defined
# tag name.  The expression is hard-coded to target tags.key.  This makes this implementation
# highly specific to the replays dataset (hence why this is a use-case and not a lib module).


class TagField:
    def __init__(self) -> None:
        self.parse = parse_str
        self.query = SumOfTagScalar

    def apply(self, search_filter: SearchFilter) -> Condition:
        """Apply a search operation against any named expression.

        A named expression can be a column name or an expression alias.
        """
        key = search_filter.key.name
        if key.startswith("tags["):
            key = key[5:-1]

        operator = search_filter.operator
        value = search_filter.value.value

        if isinstance(value, (str, int, float, datetime.datetime)):
            parsed_value = self.parse(str(value))

            if search_filter.value.is_wildcard():
                applicable = self._apply_wildcard
            else:
                applicable = self._apply_scalar

            return applicable(key, operator, parsed_value)
        else:
            parsed_values = [self.parse(str(v)) for v in value]
            return self._apply_composite(key, operator, parsed_values)

    def _apply_wildcard(self, key: str, operator: str, value: str) -> Condition:
        if operator == "=":
            visitor = self.query.visit_match
        elif operator == "!=":
            visitor = self.query.visit_not_match
        else:
            raise Exception(f"Unsupported wildcard search operator: '{operator}'")

        return visitor(key, value)

    def _apply_composite(self, key: str, operator: str, value: list[str]) -> Condition:
        if operator == "IN":
            visitor = self.query.visit_in
        elif operator == "NOT IN":
            visitor = self.query.visit_not_in
        else:
            raise Exception(f"Unsupported composite search operator: '{operator}'")

        return visitor(key, value)

    def _apply_scalar(self, key: str, operator: str, value: str) -> Condition:
        if operator == "=":
            visitor = self.query.visit_eq
        elif operator == "!=":
            visitor = self.query.visit_neq
        else:
            raise Exception(f"Unsupported search operator: '{operator}'")

        return visitor(key, value)

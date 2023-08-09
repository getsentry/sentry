from __future__ import annotations

import datetime
from typing import Callable, Generic, Type

from snuba_sdk import Column, Condition, Function
from snuba_sdk.expressions import Expression

from sentry.api.event_search import SearchFilter
from sentry.replays.lib.new_query.conditions import GenericBase, T


class BaseField(Generic[T]):
    def __init__(self, parse: Callable[[str], T], query: Type[GenericBase[T]]) -> None:
        self.parse = parse
        self.query = query

    def apply(self, search_filter: SearchFilter) -> Condition:
        raise NotImplementedError

    def _apply_wildcard(self, expression: Expression, operator: str, value: T) -> Condition:
        if operator == "=":
            visitor = self.query.visit_match
        elif operator == "!=":
            visitor = self.query.visit_not_match
        else:
            raise Exception(f"Unsupported wildcard search operator: '{operator}'")

        return visitor(expression, value)

    def _apply_composite(self, expression: Expression, operator: str, value: list[T]) -> Condition:
        if operator == "IN":
            visitor = self.query.visit_in
        elif operator == "NOT IN":
            visitor = self.query.visit_not_in
        else:
            raise Exception(f"Unsupported composite search operator: '{operator}'")

        return visitor(expression, value)

    def _apply_scalar(self, expression: Expression, operator: str, value: T) -> Condition:
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

        return visitor(expression, value)


class ColumnField(BaseField[T]):
    """Column fields target one column."""

    def __init__(
        self, column_name: str, parse_fn: Callable[[str], T], query_type: Type[GenericBase[T]]
    ) -> None:
        self.column_name = column_name
        self.parse = parse_fn
        self.query = query_type

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

            return applicable(self.expression, operator, parsed_value)
        else:
            parsed_value = [self.parse(str(v)) for v in value]
            return self._apply_composite(self.expression, operator, parsed_value)

    @property
    def expression(self) -> Column:
        return Column(self.column_name)


class StringColumnField(ColumnField[str]):
    """String type conditional column field."""


class CountExpressionField(ColumnField[int]):
    @property
    def expression(self) -> Function:
        return Function("count", parameters=[Column(self.column_name)])


class SumExpressionField(ColumnField[int]):
    @property
    def expression(self) -> Function:
        return Function("sum", parameters=[Column(self.column_name)])


class SumLengthExpressionField(ColumnField[int]):
    @property
    def expression(self) -> Function:
        return Function(
            "sum", parameters=[Function("length", parameters=[Column(self.column_name)])]
        )

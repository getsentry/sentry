"""Field interface module.

Fields are the contact point to the wider search ecosystem at Sentry.  They act as an interface
to bridge the two worlds.  Fields are responsible for accepting a SearchFilter, verifying its
operator is valid, verifying the value's data-type is valid, and finally calling into the
condition system to return a condition clause for the query.

Fields also contain the means to determine the expression being filtered.  Whereas a Condition
visitor doesn't care what expression is given to it the Field instance certainly does.  One of its
core responsibilities is to pass the correct expression to be filtered against.

Fields are polymorphic on the source they target and the data-type of the field in the API
response.  Note just because a field appears as an array or as a scalar does not mean it is
filtered in that way.  The field's job is to translate the display format to the expression
format.
"""
from __future__ import annotations

import datetime
from typing import Callable, Generic, Protocol, Type
from uuid import UUID

from snuba_sdk import Column, Condition, Function
from snuba_sdk.expressions import Expression

from sentry.api.event_search import SearchFilter
from sentry.replays.lib.new_query.conditions import GenericBase, T


class FieldProtocol(Protocol):
    """Field interface.

    Any instance which defines an "apply" method which accepts a "SearchFilter" and returns a
    "Condition" is considered a field.  Additional methods and state may be added to help
    construct the "Condition".
    """

    def apply(self, search_filter: SearchFilter) -> Condition:
        ...


class BaseField(Generic[T]):
    def __init__(self, parse: Callable[[str], T], query: Type[GenericBase]) -> None:
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
        self, column_name: str, parse_fn: Callable[[str], T], query_type: Type[GenericBase]
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

        # We need to check if the value is a scalar to determine the path we should follow.  This
        # is not as simple as asking for isinstance(value, list).  Array values are provided to us
        # as "Sequence" types.  Sequence[str] is the same type as str.  So we can't check for
        # Sequence in the isinstance check.  We have to explicitly check for all the possible
        # scalar values and then use the else to apply array based filtering techniques.
        #
        # This exists solely to satisfy typing concerns.  Otherwise `isinstance(value, list)` is
        # perfectly valid Python.
        if isinstance(value, (str, int, float, datetime.datetime)):
            # We don't care that the SearchFilter typed the value for us. We'll determine what we
            # want to parse it to.  There's too much polymorphism if we have to consider coercing
            # this data-type to that data-type in the parse step.
            parsed_value = self.parse(str(value))

            if search_filter.value.is_wildcard():
                applicable = self._apply_wildcard
            else:
                applicable = self._apply_scalar

            return applicable(self.expression, operator, parsed_value)
        else:
            # Again the types contained within the list are coerced to string to be re-coerced
            # back into their correct data-type.
            parsed_values = [self.parse(str(v)) for v in value]
            return self._apply_composite(self.expression, operator, parsed_values)

    @property
    def expression(self) -> Column:
        return Column(self.column_name)


class StringColumnField(ColumnField[str]):
    """String-type condition column field."""


class IntegerColumnField(ColumnField[int]):
    """Integer-type condition column field."""


class UUIDColumnField(ColumnField[UUID]):
    """UUID-type condition column field."""


class CountField(ColumnField[int]):
    @property
    def expression(self) -> Function:
        return Function("count", parameters=[Column(self.column_name)])


class SumField(ColumnField[int]):
    @property
    def expression(self) -> Function:
        return Function("sum", parameters=[Column(self.column_name)])


class SumLengthField(ColumnField[int]):
    @property
    def expression(self) -> Function:
        return Function(
            "sum", parameters=[Function("length", parameters=[Column(self.column_name)])]
        )

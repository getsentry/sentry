"""Dynamic query parsing library."""
from typing import Any, Generator, List, Optional, Tuple

from rest_framework.exceptions import ParseError
from snuba_sdk import Column, Condition, Op
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.event_search import SearchFilter

# Interface.


OPERATOR_MAP = {
    "=": Op.EQ,
    "!=": Op.NEQ,
    ">": Op.GT,
    ">=": Op.GTE,
    "<": Op.LT,
    "<=": Op.LTE,
}


class Field:
    attribute_name: Optional[str] = None

    def __init__(
        self,
        name: Optional[str] = None,
        field_alias: Optional[str] = None,
        query_alias: Optional[str] = None,
        is_filterable: bool = True,
        is_sortable: bool = True,
        operators: Optional[list] = None,
        validators: Optional[list] = None,
    ) -> None:
        self.field_alias = field_alias or name
        self.query_alias = query_alias or name
        self.is_filterable = is_filterable
        self.is_sortable = is_sortable
        self.operators = operators or self._operators
        self.validators = validators or []

    def deserialize_operator(self, operator: str) -> Tuple[Any, List[str]]:
        op = OPERATOR_MAP.get(operator)
        if op is None:
            return None, ["Operator not found."]
        elif op not in self.operators:
            return None, ["Operator not permitted."]
        else:
            return op, []

    def deserialize_value(self, value: str) -> Tuple[Any, List[str]]:
        try:
            typed_value = self._python_type(value)
        except ValueError:
            return None, ["Invalid value specified."]

        for validator in self.validators:
            error = validator(typed_value)
            if error:
                return None, [error]

        return typed_value, []


class String(Field):
    _operators = [Op.EQ, Op.NEQ]
    _python_type = str


class Number(Field):
    _operators = [Op.EQ, Op.NEQ, Op.GT, Op.GTE, Op.LT, Op.LTE]
    _python_type = int


class QueryConfig:
    def __init__(self, only: Optional[Tuple[str]] = None) -> None:
        self.fields = {}
        for field_name in only or self.__class__.__dict__:
            field = getattr(self, field_name)
            if isinstance(field, Field):
                field.attribute_name = field_name
                self.insert(field_name, field)
                self.insert(field.field_alias, field)

    def get(self, field_name: str, default=None) -> Field:
        return self.fields.get(field_name, default)

    def insert(self, field_name: Optional[str], value: Field) -> None:
        if field_name is None:
            return None
        elif field_name in self.fields:
            raise KeyError(f"Field already exists: {field_name}")
        else:
            self.fields[field_name] = value


# Implementation.


def generate_valid_conditions(
    query: List[SearchFilter], query_config: QueryConfig
) -> Generator[None, None, Condition]:
    for search_filter in query:
        # Validate field exists and is filterable.
        field_alias = search_filter.key.name
        field = query_config.get(field_alias)
        if field is None or not field.is_filterable:
            raise ParseError(f"Invalid field specified: {field_alias}.")

        # Validate strategy is correct.
        query_operator = search_filter.operator
        operator, errors = field.deserialize_operator(query_operator)
        if errors:
            raise ParseError(f"Invalid operator specified: {field_alias}.")

        # Deserialize value to its correct type or error.
        query_value = search_filter.value.value
        value, errors = field.deserialize_value(query_value)
        if errors:
            raise ParseError(f"Invalid value specified: {field_alias}.")

        yield Condition(Column(field.query_alias or field.attribute_name), operator, value)


def get_valid_sort_commands(
    sort: Optional[str],
    default: OrderBy,
    query_config: QueryConfig,
) -> List[OrderBy]:
    if not sort:
        return [default]

    if sort.startswith("-"):
        strategy = Direction.DESC
        field_name = sort[1:]
    else:
        strategy = Direction.ASC
        field_name = sort

    field = query_config.get(field_name)
    if not field:
        raise ParseError(f"Invalid field specified: {field_name}.")
    else:
        return [OrderBy(Column(field.query_alias or field.attribute_name), strategy)]

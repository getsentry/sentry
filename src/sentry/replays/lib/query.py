"""Dynamic query parsing library."""
from typing import Any, List, Optional, Tuple, Union

from rest_framework.exceptions import ParseError
from snuba_sdk import Column, Condition, Op
from snuba_sdk.conditions import And, Or
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.event_search import ParenExpression, SearchFilter

# Interface.


OPERATOR_MAP = {
    "=": Op.EQ,
    "!=": Op.NEQ,
    ">": Op.GT,
    ">=": Op.GTE,
    "<": Op.LT,
    "<=": Op.LTE,
    "IN": Op.IN,
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

    def deserialize_values(self, values: List[str]) -> Tuple[Any, List[str]]:
        parsed_values = []
        for value in values:
            parsed_value, errors = self.deserialize_value(value)
            if errors:
                return None, errors

            parsed_values.append(parsed_value)

        return parsed_values, []

    def deserialize_value(self, value: Union[List[str], str]) -> Tuple[Any, List[str]]:
        if isinstance(value, list):
            return self.deserialize_values(value)

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
    _operators = [Op.EQ, Op.NEQ, Op.IN]
    _python_type = str


class Number(Field):
    _operators = [Op.EQ, Op.NEQ, Op.GT, Op.GTE, Op.LT, Op.LTE, Op.IN]
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
    query: List[Union[SearchFilter, ParenExpression, str]], query_config: QueryConfig
) -> List[Condition]:
    """Convert search filters to snuba conditions."""
    result = []
    look_back = None
    for search_filter in query:
        # SearchFilters are appended to the result set.  If they are top level filters they are
        # implicitly And'ed in the WHERE/HAVING clause.
        if isinstance(search_filter, SearchFilter):
            condition = filter_to_condition(search_filter, query_config)
            if look_back == "AND":
                look_back = None
                attempt_compressed_condition(result, condition, And)
            elif look_back == "OR":
                look_back = None
                attempt_compressed_condition(result, condition, Or)
            else:
                result.append(condition)
        # ParenExpressions are recursively computed.  If more than one condition is returned then
        # those conditions are And'ed.
        elif isinstance(search_filter, ParenExpression):
            conditions = generate_valid_conditions(search_filter.children, query_config)
            if len(conditions) < 2:
                result.extend(conditions)
            else:
                result.append(And(conditions))
        # String types are limited to AND and OR... I think?  In the case where its not a valid
        # look-back it is implicitly ignored.
        elif isinstance(search_filter, str):
            look_back = search_filter

    return result


def filter_to_condition(search_filter: SearchFilter, query_config: QueryConfig) -> Condition:
    """Coerce SearchFilter syntax to snuba Condtion syntax."""
    # Validate field exists and is filterable.
    field_alias = search_filter.key.name
    field = query_config.get(field_alias)
    if field is None:
        raise ParseError(f"Invalid field specified: {field_alias}.")
    elif not field.is_filterable:
        raise ParseError(f'"{field_alias}" is not filterable.')

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

    return Condition(Column(field.query_alias or field.attribute_name), operator, value)


def attempt_compressed_condition(result, rhs, condition_type):
    """Unnecessary query optimization.

    Improves the legibility of for query debugging. Clickhouse would flatten these nested OR
    statements internally anyway.

    (block OR block) OR block => (block OR block OR block)
    """
    if isinstance(result[-1], condition_type):
        result[-1].conditions.append(rhs)
    else:
        result.append(condition_type([result.pop(), rhs]))


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

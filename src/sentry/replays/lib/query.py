"""Dynamic query parsing library."""
from typing import Any, List, Optional, Tuple, Union

from rest_framework.exceptions import ParseError
from snuba_sdk import Column, Condition, Function, Identifier, Lambda, Op
from snuba_sdk.conditions import And, Or
from snuba_sdk.expressions import Expression
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.event_search import ParenExpression, SearchFilter

OPERATOR_MAP = {
    "=": Op.EQ,
    "!=": Op.NEQ,
    ">": Op.GT,
    ">=": Op.GTE,
    "<": Op.LT,
    "<=": Op.LTE,
    "IN": Op.IN,
    "NOT IN": Op.NOT_IN,
}


class Field:
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
        self.attribute_name = None
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

    def deserialize_values(self, values: List[str]) -> Tuple[List[Any], List[str]]:
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
            if self._python_type:
                typed_value = self._python_type(value)
            else:
                typed_value = value
        except ValueError:
            return None, ["Invalid value specified."]

        for validator in self.validators:
            error = validator(typed_value)
            if error:
                return None, [error]

        return typed_value, []

    def as_condition(
        self,
        field_alias: str,
        operator: Op,
        value: Union[List[str], str],
        is_wildcard: bool = False,
    ) -> Condition:

        return Condition(Column(self.query_alias or self.attribute_name), operator, value)


class String(Field):
    _operators = [Op.EQ, Op.NEQ, Op.IN, Op.NOT_IN]
    _python_type = str

    def as_condition(
        self, field_alias: str, operator: Op, value: Union[List[str], str], is_wildcard: bool
    ) -> Condition:
        if is_wildcard:
            return Condition(
                _wildcard_search_function(value, Column(self.query_alias or self.attribute_name)),
                operator,
                1,
            )

        return super().as_condition(field_alias, operator, value, is_wildcard)


class Number(Field):
    _operators = [Op.EQ, Op.NEQ, Op.GT, Op.GTE, Op.LT, Op.LTE, Op.IN, Op.NOT_IN]
    _python_type = int


class ListField(Field):
    _operators = [Op.EQ, Op.NEQ, Op.IN, Op.NOT_IN]
    _python_type = None

    def as_condition(
        self, _: str, operator: Op, value: Union[List[str], str], is_wildcard: bool = False
    ) -> Condition:
        if operator in [Op.EQ, Op.NEQ]:
            if is_wildcard:
                # wildcard search isn't supported with the IN operator
                return self._wildcard_condition(operator, value)

            return self._has_condition(operator, value)
        else:
            return self._has_any_condition(operator, value)

    def _wildcard_condition(self, operator: Op, value: str):
        return Condition(
            Function(
                "arrayExists",
                parameters=[
                    Lambda(
                        ["list_element"],
                        _wildcard_search_function(value, Identifier("list_element")),
                    ),
                    Column(self.query_alias or self.attribute_name),
                ],
            ),
            Op.EQ,
            1 if operator == Op.EQ else 0,
        )

    def _has_condition(
        self,
        operator: Op,
        value: Union[List[str], str],
    ) -> Condition:
        if isinstance(value, list):
            return self._has_any_condition(Op.IN if operator == Op.EQ else Op.NOT_IN, value)

        return Condition(
            Function("has", parameters=[Column(self.query_alias or self.attribute_name), value]),
            Op.EQ,
            1 if operator == Op.EQ else 0,
        )

    def _has_any_condition(
        self,
        operator: Op,
        values: Union[List[str], str],
    ) -> Condition:
        if not isinstance(values, list):
            return self._has_condition(Op.EQ if operator == Op.IN else Op.NEQ, values)

        return Condition(
            Function(
                "hasAny", parameters=[Column(self.query_alias or self.attribute_name), values]
            ),
            Op.EQ,
            1 if operator == Op.IN else 0,
        )


class Tag(Field):
    _operators = [Op.EQ, Op.NEQ, Op.IN, Op.NOT_IN]
    _negation_map = [False, True, False, True]
    _python_type = str

    def __init__(self, **kwargs):
        kwargs.pop("operators", None)
        return super().__init__(**kwargs)

    def deserialize_operator(self, operator: str) -> Tuple[Op, List[str]]:
        op = OPERATOR_MAP.get(operator)
        if op is None:
            return None, ["Operator not found."]
        elif op not in self._operators:
            return None, ["Operator not permitted."]
        else:
            return op, []

    def as_condition(
        self,
        field_alias: str,
        operator: Op,
        value: Union[List[str], str],
        is_wildcard: bool = False,
    ) -> Condition:

        if is_wildcard:
            return self._filter_tag_by_wildcard_search(field_alias, value, operator)

        return self._filter_tag_by_value(field_alias, value, operator)

    def _filter_tag_by_wildcard_search(self, field_alias: str, value: str, operator: Op):
        return Condition(
            Function(
                "arrayExists",
                parameters=[
                    Lambda(
                        ["tag_value"], _wildcard_search_function(value, Identifier("tag_value"))
                    ),
                    _all_values_for_tag_key(field_alias),
                ],
            ),
            operator,
            1,
        )

    def _filter_tag_by_value(
        self, key: str, values: Union[List[str], str], operator: Op
    ) -> Condition:
        """Helper function that allows filtering a tag by multiple values."""
        expected = 0 if operator not in (Op.EQ, Op.IN) else 1
        function = "hasAny" if isinstance(values, list) else "has"
        return Condition(
            Function(function, parameters=[_all_values_for_tag_key(key), values]),
            Op.EQ,
            expected,
        )


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
) -> List[Expression]:
    """Convert search filters to snuba conditions."""
    result: List[Expression] = []
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
    """Coerce SearchFilter syntax to snuba Condition syntax."""
    # Validate field exists and is filterable.
    field_alias = search_filter.key.name
    field = query_config.get(field_alias) or query_config.get("*")
    if field is None:
        raise ParseError(f"Invalid field specified: {field_alias}.")
    if not field.is_filterable:
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

    is_wildcard = search_filter.value.is_wildcard()

    return field.as_condition(field_alias, operator, value, is_wildcard)


def attempt_compressed_condition(
    result: List[Expression],
    condition: Condition,
    condition_type: Union[And, Or],
):
    """Unnecessary query optimization.

    Improves legibility for query debugging. Clickhouse would flatten these nested OR statements
    internally anyway.

    (block OR block) OR block => (block OR block OR block)
    """
    if isinstance(result[-1], condition_type):
        result[-1].conditions.append(condition)
    else:
        result.append(condition_type([result.pop(), condition]))


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


# Tag filtering behavior.


def _all_values_for_tag_key(key: str) -> Function:
    return Function(
        "arrayFilter",
        parameters=[
            Lambda(
                ["key", "mask"],
                Function("equals", parameters=[Identifier("mask"), 1]),
            ),
            Column("tv"),
            _bitmask_on_tag_key(key),
        ],
    )


def _bitmask_on_tag_key(key: str) -> Function:
    """Create a bit mask.

    Returns an array where the integer 1 represents a match.
        e.g.: [0, 0, 1, 0, 1, 0]
    """
    return Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["index", "key"],
                Function("equals", parameters=[Identifier("key"), key]),
            ),
            Function("arrayEnumerate", parameters=[Column("tk")]),
            Column("tk"),
        ],
    )


def _wildcard_search_function(value, identifier):
    # XXX: We don't want the '^$' values at the beginning and end of
    # the regex since we want to find the pattern anywhere in the
    # message. Strip off here
    wildcard_value = value[1:-1]
    return Function(
        "match",
        parameters=[
            identifier,
            f"(?i){wildcard_value}",
        ],
    )

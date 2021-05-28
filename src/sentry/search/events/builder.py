from datetime import datetime
from typing import Any, Callable, List, Mapping, Optional, Sequence, Union

from parsimonious.exceptions import ParseError
from snuba_sdk.column import Column
from snuba_sdk.conditions import BooleanCondition, Condition, Op, Or
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Limit
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Query

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue, parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.constants import (
    EQUALITY_OPERATORS,
    NO_CONVERSION_FIELDS,
    TAG_KEY_RE,
    VALID_FIELD_PATTERN,
)
from sentry.search.events.fields import FIELD_ALIASES, is_function
from sentry.utils.snuba import Dataset, resolve_column

# TODO: this should be a TypedDict instead
ParamsType = Mapping[str, Union[List[int], int, str, datetime]]
# Function is a subclass of CurriedFunction
AggregateType = Union[CurriedFunction]
WhereType = Union[Condition, BooleanCondition]
SelectType = Union[Column, Function, CurriedFunction]


class QueryBuilder:
    """ Builds a snql query """

    # Allow list of fields that are handled by this class Once we reach a
    # certain threshold of fields handled should turn this into a denylist
    # use public facing field/function names for this list
    field_allowlist = {
        "user.email",
        "release",
        "environment",
    }

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
        limit: int = 50,
    ):
        self.aggregates: List[AggregateType] = []
        self.columns: List[SelectType] = []
        self.where: List[WhereType] = []

        self.params = params
        self.dataset = dataset
        self.limit = Limit(limit)
        self.orderby_columns: List[str] = orderby if orderby else []

        self.resolve_column_name = resolve_column(self.dataset)
        self._key_conversion_map: Mapping[
            str,
            Callable[
                [SearchFilter, str],
                Optional[Sequence[Any]],
            ],
        ] = {
            "environment": self._environment_filter_converter,
        }

        if query is not None:
            self.resolve_where(query)
        # params depends on get_filter since there may be projects in the query
        self.resolve_params()
        if selected_columns is not None:
            self.resolve_select(selected_columns)

    def resolve_params(self) -> None:
        """Keys included as url params take precedent if same key is included in search
        They are also considered safe and to have had access rules applied unlike conditions
        from the query string.
        """
        # start/end are required so that we can run a query in a reasonable amount of time
        if "start" not in self.params or "end" not in self.params:
            raise InvalidSearchQuery("Cannot query without a valid date range")

        self.where.append(Condition(self.column("timestamp"), Op.GTE, self.params["start"]))
        self.where.append(Condition(self.column("timestamp"), Op.LT, self.params["end"]))

        if "project_id" in self.params:
            self.where.append(
                Condition(
                    self.column("project_id"),
                    Op.IN,
                    self.params["project_id"],
                )
            )

        if "environment" in self.params:
            term = SearchFilter(
                SearchKey("environment"), "=", SearchValue(self.params["environment"])
            )
            condition = self._environment_filter_converter(term, "environment")
            if condition:
                self.where.append(condition)

    def column(self, name: str) -> Column:
        return Column(self.resolve_column_name(name))

    def resolve_where(self, query: str) -> None:
        try:
            parsed_terms = parse_search_query(query, allow_boolean=True, params=self.params)
        except ParseError as e:
            raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")

        for term in parsed_terms:
            if isinstance(term, SearchFilter):
                self.format_search_filter(term)

    def format_search_filter(self, term: SearchFilter) -> None:
        converted_filter = self.convert_search_filter_to_condition(term)
        if converted_filter:
            self.where.append(converted_filter)

    def convert_search_filter_to_condition(
        self,
        search_filter: SearchFilter,
    ) -> Optional[Condition]:
        name = search_filter.key.name
        value = search_filter.value.value

        # We want to use group_id elsewhere so shouldn't be removed from the dataset
        # but if a user has a tag with the same name we want to make sure that works
        if name == {"group_id"}:
            name = f"tags[{name}]"

        if name in NO_CONVERSION_FIELDS:
            return
        elif name in self._key_conversion_map:
            return self._key_conversion_map[name](search_filter, name)
        elif name in self.field_allowlist:
            lhs = self.column(name)

            # Handle checks for existence
            if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
                if search_filter.key.is_tag:
                    return Condition(lhs, Op(search_filter.operator), value)
                else:
                    # If not a tag, we can just check that the column is null.
                    return Condition(Function("ifNull", [lhs]), Op(search_filter.operator), 1)

            if search_filter.value.is_wildcard():
                condition = Condition(
                    Function("match", [lhs, f"'(?i){value}'"]),
                    Op(search_filter.operator),
                    1,
                )
            else:
                condition = Condition(lhs, Op(search_filter.operator), value)

            return condition
        else:
            raise NotImplementedError(f"{name} not implemented in snql filter parsing yet")

    def _environment_filter_converter(
        self,
        search_filter: SearchFilter,
        _: str,
    ) -> WhereType:
        # conditions added to env_conditions can be OR'ed
        env_conditions = []
        value = search_filter.value.value
        values = set(value if isinstance(value, (list, tuple)) else [value])
        # sorted for consistency
        values = sorted([str(value) for value in values])
        environment = self.column("environment")
        # the "no environment" environment is null in snuba
        if "" in values:
            values.remove("")
            operator = Op.IS_NULL if search_filter.operator == "=" else Op.IS_NOT_NULL
            env_conditions.append(Condition(environment, operator))
        if len(values) == 1:
            operator = Op.EQ if search_filter.operator in EQUALITY_OPERATORS else Op.NEQ
            env_conditions.append(Condition(environment, operator, values.pop()))
        elif values:
            operator = Op.IN if search_filter.operator in EQUALITY_OPERATORS else Op.NOT_IN
            env_conditions.append(Condition(environment, operator, values))
        if len(env_conditions) > 1:
            return Or(conditions=env_conditions)
        else:
            return env_conditions[0]

    def resolve_select(self, selected_columns: List[str]) -> None:
        for field in selected_columns:
            if isinstance(field, str) and field.strip() == "":
                continue
            field = self.resolve_field(field)
            if isinstance(field, Column) and field not in self.columns:
                self.columns.append(field)

    def resolve_field(self, field) -> Union[Column, Function]:
        if not isinstance(field, str):
            raise InvalidSearchQuery("Field names must be strings")

        match = is_function(field)
        if match:
            raise NotImplementedError(f"{field} not implemented in snql field parsing yet")

        if field in FIELD_ALIASES:
            raise NotImplementedError(f"{field} not implemented in snql field parsing yet")

        tag_match = TAG_KEY_RE.search(field)
        field = tag_match.group("tag") if tag_match else field

        if VALID_FIELD_PATTERN.match(field):
            if field in self.field_allowlist:
                return self.column(field)
            else:
                raise NotImplementedError(f"{field} not implemented in snql field parsing yet")
        else:
            raise InvalidSearchQuery(f"Invalid characters in field {field}")

    @property
    def select(self) -> Optional[List[SelectType]]:
        return [*self.aggregates, *self.columns]

    @property
    def groupby(self) -> Optional[List[SelectType]]:
        if self.aggregates:
            return self.columns
        else:
            return []

    @property
    def orderby(self) -> List[OrderBy]:
        validated = []
        for column in self.orderby_columns:
            bare_column = self.column(column.lstrip("-"))
            direction = Direction.DESC if column.startswith("-") else Direction.ASC

            if bare_column in self.columns:
                validated.append(OrderBy(bare_column, direction))
                continue

            # TODO: orderby aggregations

            # TODO: orderby field aliases

        if len(validated) == len(self.orderby_columns):
            return validated

        # TODO: This is not true, can order by fields that aren't selected, keeping
        # for now so we're consistent with the existing functionality
        raise InvalidSearchQuery("Cannot order by a field that is not selected.")

    def get_snql_query(self) -> Query:
        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value),
            select=self.select,
            where=self.where,
            groupby=self.groupby,
            limit=self.limit,
        )

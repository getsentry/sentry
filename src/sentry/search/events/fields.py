import re
from collections import defaultdict, namedtuple
from copy import deepcopy
from datetime import datetime

from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE

from sentry.discover.models import KeyTransaction
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project
from sentry.search.events.constants import (
    ALIAS_PATTERN,
    ERROR_UNHANDLED_ALIAS,
    FUNCTION_PATTERN,
    KEY_TRANSACTION_ALIAS,
    PROJECT_ALIAS,
    PROJECT_NAME_ALIAS,
    RESULT_TYPES,
    SEARCH_MAP,
    TAG_KEY_RE,
    USER_DISPLAY_ALIAS,
    VALID_FIELD_PATTERN,
)
from sentry.utils.compat import zip
from sentry.utils.snuba import (
    get_json_type,
    is_duration_measurement,
    is_measurement,
    is_span_op_breakdown,
)

FunctionDetails = namedtuple("FunctionDetails", "field instance arguments")
ResolvedFunction = namedtuple("ResolvedFunction", "details column aggregate")


class InvalidFunctionArgument(Exception):
    pass


class PseudoField:
    def __init__(self, name, alias, expression=None, expression_fn=None, result_type=None):
        self.name = name
        self.alias = alias
        self.expression = expression
        self.expression_fn = expression_fn
        self.result_type = result_type

        self.validate()

    def get_expression(self, params):
        if isinstance(self.expression, (list, tuple)):
            return deepcopy(self.expression)
        elif self.expression_fn is not None:
            return self.expression_fn(params)
        return None

    def get_field(self, params=None):
        expression = self.get_expression(params)
        if expression is not None:
            expression.append(self.alias)
            return expression
        return self.alias

    def validate(self):
        assert self.alias is not None, f"{self.name}: alias is required"
        assert (
            self.expression is None or self.expression_fn is None
        ), f"{self.name}: only one of expression, expression_fn is allowed"


def key_transaction_expression(user_id, organization_id, project_ids):
    """
    This function may be called multiple times, making for repeated data bases queries.
    Lifting the query higher to earlier in the call stack will require a lot more changes
    as there are numerous entry points. So we will leave the duplicate query alone for now.
    """
    if user_id is None or organization_id is None or project_ids is None:
        raise InvalidSearchQuery("Missing necessary meta for key transaction field.")

    key_transactions = (
        KeyTransaction.objects.filter(
            owner_id=user_id,
            organization_id=organization_id,
            project_id__in=project_ids,
        )
        .order_by("transaction", "project_id")
        .values("project_id", "transaction")
    )

    # if there are no key transactions, the value should always be 0
    if not len(key_transactions):
        return ["toInt64", [0]]

    return [
        "has",
        [
            [
                "array",
                [
                    [
                        "tuple",
                        [
                            ["toUInt64", [transaction["project_id"]]],
                            "'{}'".format(transaction["transaction"]),
                        ],
                    ]
                    for transaction in key_transactions
                ],
            ],
            ["tuple", ["project_id", "transaction"]],
        ],
    ]


# When updating this list, also check if the following need to be updated:
# - convert_search_filter_to_snuba_query (otherwise aliased field will be treated as tag)
# - static/app/utils/discover/fields.tsx FIELDS (for discover column list and search box autocomplete)
FIELD_ALIASES = {
    field.name: field
    for field in [
        PseudoField("project", "project.id"),
        PseudoField("issue", "issue.id"),
        PseudoField(
            "timestamp.to_hour", "timestamp.to_hour", expression=["toStartOfHour", ["timestamp"]]
        ),
        PseudoField(
            "timestamp.to_day", "timestamp.to_day", expression=["toStartOfDay", ["timestamp"]]
        ),
        PseudoField(ERROR_UNHANDLED_ALIAS, ERROR_UNHANDLED_ALIAS, expression=["notHandled", []]),
        PseudoField(
            USER_DISPLAY_ALIAS,
            USER_DISPLAY_ALIAS,
            expression=["coalesce", ["user.email", "user.username", "user.ip"]],
        ),
        # the key transaction field is intentially not added to the discover/fields list yet
        # because there needs to be some work on the front end to integrate this into discover
        PseudoField(
            KEY_TRANSACTION_ALIAS,
            KEY_TRANSACTION_ALIAS,
            expression_fn=lambda params: key_transaction_expression(
                params.get("user_id"),
                params.get("organization_id"),
                params.get("project_id"),
            ),
            result_type="boolean",
        ),
    ]
}


def format_column_arguments(column_args, arguments):
    for i in range(len(column_args)):
        if isinstance(column_args[i], (list, tuple)):
            if isinstance(column_args[i][0], ArgValue):
                column_args[i][0] = arguments[column_args[i][0].arg]
            format_column_arguments(column_args[i][1], arguments)
        elif isinstance(column_args[i], str):
            column_args[i] = column_args[i].format(**arguments)
        elif isinstance(column_args[i], ArgValue):
            column_args[i] = arguments[column_args[i].arg]


def parse_arguments(function, columns):
    """
    The to_other function takes a quoted string for one of its arguments
    that may contain commas, so it requires special handling.
    """
    if function != "to_other":
        return [c.strip() for c in columns.split(",") if len(c.strip()) > 0]

    args = []

    quoted = False
    escaped = False

    i, j = 0, 0

    while j < len(columns):
        if i == j and columns[j] == '"':
            # when we see a quote at the beginning of
            # an argument, then this is a quoted string
            quoted = True
        elif quoted and not escaped and columns[j] == "\\":
            # when we see a slash inside a quoted string,
            # the next character is an escape character
            escaped = True
        elif quoted and not escaped and columns[j] == '"':
            # when we see a non-escaped quote while inside
            # of a quoted string, we should end it
            quoted = False
        elif quoted and escaped:
            # when we are inside a quoted string and have
            # begun an escape character, we should end it
            escaped = False
        elif quoted and columns[j] == ",":
            # when we are inside a quoted string and see
            # a comma, it should not be considered an
            # argument separator
            pass
        elif columns[j] == ",":
            # when we see a comma outside of a quoted string
            # it is an argument separator
            args.append(columns[i:j].strip())
            i = j + 1
        j += 1

    if i != j:
        # add in the last argument if any
        args.append(columns[i:].strip())

    return [arg for arg in args if arg]


def resolve_field_list(
    fields, snuba_filter, auto_fields=True, auto_aggregations=False, functions_acl=None
):
    """
    Expand a list of fields based on aliases and aggregate functions.

    Returns a dist of aggregations, selected_columns, and
    groupby that can be merged into the result of get_snuba_query_args()
    to build a more complete snuba query based on event search conventions.

    Auto aggregates are aggregates that will be automatically added to the
    list of aggregations when they're used in a condition. This is so that
    they can be used in a condition without having to manually add the
    aggregate to a field.
    """
    aggregations = []
    aggregate_fields = defaultdict(set)
    columns = []
    groupby = []
    project_key = ""
    functions = {}

    # If project is requested, we need to map ids to their names since snuba only has ids
    if "project" in fields:
        fields.remove("project")
        project_key = "project"
    # since project.name is more specific, if both are included use project.name instead of project
    if PROJECT_NAME_ALIAS in fields:
        fields.remove(PROJECT_NAME_ALIAS)
        project_key = PROJECT_NAME_ALIAS
    if project_key:
        if "project.id" not in fields:
            fields.append("project.id")

    for field in fields:
        if isinstance(field, str) and field.strip() == "":
            continue
        function = resolve_field(field, snuba_filter.params, functions_acl)
        if function.column is not None and function.column not in columns:
            columns.append(function.column)
            if function.details is not None and isinstance(function.column, (list, tuple)):
                functions[function.column[-1]] = function.details
        elif function.aggregate is not None:
            aggregations.append(function.aggregate)
            if function.details is not None and isinstance(function.aggregate, (list, tuple)):
                functions[function.aggregate[-1]] = function.details
                if function.details.instance.redundant_grouping:
                    aggregate_fields[function.aggregate[1]].add(field)

    # Only auto aggregate when there's one other so the group by is not unexpectedly changed
    if auto_aggregations and snuba_filter.having and len(aggregations) > 0:
        for agg in snuba_filter.condition_aggregates:
            if agg not in snuba_filter.aliases:
                function = resolve_field(agg, snuba_filter.params, functions_acl)
                if function.aggregate is not None and function.aggregate not in aggregations:
                    aggregations.append(function.aggregate)
                    if function.details is not None and isinstance(
                        function.aggregate, (list, tuple)
                    ):
                        functions[function.aggregate[-1]] = function.details

                        if function.details.instance.redundant_grouping:
                            aggregate_fields[function.aggregate[1]].add(field)

    rollup = snuba_filter.rollup
    if not rollup and auto_fields:
        # Ensure fields we require to build a functioning interface
        # are present. We don't add fields when using a rollup as the additional fields
        # would be aggregated away.
        if not aggregations and "id" not in columns:
            columns.append("id")
        if "id" in columns and "project.id" not in columns:
            columns.append("project.id")
            project_key = PROJECT_NAME_ALIAS

    if project_key:
        # Check to see if there's a condition on project ID already, to avoid unnecessary lookups
        filtered_project_ids = None
        if snuba_filter.conditions:
            for cond in snuba_filter.conditions:
                if cond[0] == "project_id":
                    filtered_project_ids = [cond[2]] if cond[1] == "=" else cond[2]

        project_ids = filtered_project_ids or snuba_filter.filter_keys.get("project_id", [])
        projects = Project.objects.filter(id__in=project_ids).values("slug", "id")
        # Clickhouse gets confused when the column contains a period
        # This is specifically for project.name and should be removed once we can stop supporting it
        if "." in project_key:
            project_key = f"`{project_key}`"
        columns.append(
            [
                "transform",
                [
                    # This is a workaround since having the column by itself currently is being treated as a function
                    ["toString", ["project_id"]],
                    ["array", ["'{}'".format(project["id"]) for project in projects]],
                    ["array", ["'{}'".format(project["slug"]) for project in projects]],
                    # Default case, what to do if a project id without a slug is found
                    "''",
                ],
                project_key,
            ]
        )

    if rollup and columns and not aggregations:
        raise InvalidSearchQuery("You cannot use rollup without an aggregate field.")

    orderby = snuba_filter.orderby
    # Only sort if there are columns. When there are only aggregates there's no need to sort
    if orderby and len(columns) > 0:
        orderby = resolve_orderby(orderby, columns, aggregations)
    else:
        orderby = None

    # If aggregations are present all columns
    # need to be added to the group by so that the query is valid.
    if aggregations:
        for column in columns:
            if isinstance(column, (list, tuple)):
                if column[0] == "transform":
                    # When there's a project transform, we already group by project_id
                    continue
                if column[2] == USER_DISPLAY_ALIAS:
                    # user.display needs to be grouped by its coalesce function
                    groupby.append(column)
                    continue
                groupby.append(column[2])
            else:
                if column in aggregate_fields:
                    conflicting_functions = list(aggregate_fields[column])
                    raise InvalidSearchQuery(
                        "A single field cannot be used both inside and outside a function in the same query. To use {field} you must first remove the function(s): {function_msg}".format(
                            field=column,
                            function_msg=", ".join(conflicting_functions[:2])
                            + (
                                f" and {len(conflicting_functions) - 2} more."
                                if len(conflicting_functions) > 2
                                else ""
                            ),
                        )
                    )
                groupby.append(column)

    return {
        "selected_columns": columns,
        "aggregations": aggregations,
        "groupby": groupby,
        "orderby": orderby,
        "functions": functions,
    }


def resolve_orderby(orderby, fields, aggregations):
    """
    We accept column names, aggregate functions, and aliases as order by
    values. Aggregates and field aliases need to be resolve/validated.

    TODO(mark) Once we're no longer using the dataset selection function
    should allow all non-tag fields to be used as sort clauses, instead of only
    those that are currently selected.
    """
    orderby = orderby if isinstance(orderby, (list, tuple)) else [orderby]
    validated = []
    for column in orderby:
        bare_column = column.lstrip("-")

        if bare_column in fields:
            validated.append(column)
            continue

        if is_function(bare_column):
            bare_column = get_function_alias(bare_column)

        found = [agg[2] for agg in aggregations if agg[2] == bare_column]
        if found:
            prefix = "-" if column.startswith("-") else ""
            validated.append(prefix + bare_column)
            continue

        if (
            bare_column in FIELD_ALIASES
            and FIELD_ALIASES[bare_column].alias
            and bare_column != PROJECT_ALIAS
        ):
            prefix = "-" if column.startswith("-") else ""
            validated.append(prefix + FIELD_ALIASES[bare_column].alias)
            continue

        found = [
            col[2]
            for col in fields
            if isinstance(col, (list, tuple)) and col[2].strip("`") == bare_column
        ]
        if found:
            prefix = "-" if column.startswith("-") else ""
            validated.append(prefix + bare_column)

    if len(validated) == len(orderby):
        return validated

    raise InvalidSearchQuery("Cannot order by a field that is not selected.")


def resolve_field(field, params=None, functions_acl=None):
    if not isinstance(field, str):
        raise InvalidSearchQuery("Field names must be strings")

    match = is_function(field)
    if match:
        return resolve_function(field, match, params, functions_acl)

    if field in FIELD_ALIASES:
        special_field = FIELD_ALIASES[field]
        return ResolvedFunction(None, special_field.get_field(params), None)

    tag_match = TAG_KEY_RE.search(field)
    tag_field = tag_match.group("tag") if tag_match else field

    if VALID_FIELD_PATTERN.match(tag_field):
        return ResolvedFunction(None, field, None)
    else:
        raise InvalidSearchQuery(f"Invalid characters in field {field}")


def resolve_function(field, match=None, params=None, functions_acl=False):
    if params is not None and field in params.get("aliases", {}):
        alias = params["aliases"][field]
        return ResolvedFunction(
            FunctionDetails(field, FUNCTIONS["percentage"], []),
            None,
            alias.aggregate,
        )
    function_name, columns, alias = parse_function(field, match)
    function = FUNCTIONS[function_name]
    if not function.is_accessible(functions_acl):
        raise InvalidSearchQuery(f"{function.name}: no access to private function")

    arguments = function.format_as_arguments(field, columns, params)
    details = FunctionDetails(field, function, arguments)

    if function.transform is not None:
        snuba_string = function.transform.format(**arguments)
        if alias is None:
            alias = get_function_alias_with_columns(function.name, columns)
        return ResolvedFunction(
            details,
            None,
            [snuba_string, None, alias],
        )
    elif function.aggregate is not None:
        aggregate = deepcopy(function.aggregate)

        aggregate[0] = aggregate[0].format(**arguments)
        if isinstance(aggregate[1], (list, tuple)):
            format_column_arguments(aggregate[1], arguments)
        elif isinstance(aggregate[1], ArgValue):
            arg = aggregate[1].arg
            # The aggregate function has only a single argument
            # however that argument is an expression, so we have
            # to make sure to nest it so it doesn't get treated
            # as a list of arguments by snuba.
            if isinstance(arguments[arg], (list, tuple)):
                aggregate[1] = [arguments[arg]]
            else:
                aggregate[1] = arguments[arg]

        if alias is not None:
            aggregate[2] = alias
        elif aggregate[2] is None:
            aggregate[2] = get_function_alias_with_columns(function.name, columns)

        return ResolvedFunction(details, None, aggregate)
    elif function.column is not None:
        # These can be very nested functions, so we need to iterate through all the layers
        addition = deepcopy(function.column)
        addition[0] = addition[0].format(**arguments)
        if isinstance(addition[1], (list, tuple)):
            format_column_arguments(addition[1], arguments)
        if len(addition) < 3:
            if alias is not None:
                addition.append(alias)
            else:
                addition.append(get_function_alias_with_columns(function.name, columns))
        elif len(addition) == 3:
            if alias is not None:
                addition[2] = alias
            elif addition[2] is None:
                addition[2] = get_function_alias_with_columns(function.name, columns)
            else:
                addition[2] = addition[2].format(**arguments)
        return ResolvedFunction(details, addition, None)


def parse_function(field, match=None, err_msg=None):
    if not match:
        match = is_function(field)

    if not match or match.group("function") not in FUNCTIONS:
        if err_msg is None:
            err_msg = f"{field} is not a valid function"
        raise InvalidSearchQuery(err_msg)

    function = match.group("function")
    return (
        function,
        parse_arguments(function, match.group("columns")),
        match.group("alias"),
    )


def is_function(field):
    function_match = FUNCTION_PATTERN.search(field)
    if function_match:
        return function_match

    return None


def get_function_alias(field):
    match = FUNCTION_PATTERN.search(field)
    if match is None:
        return field

    if match.group("alias") is not None:
        return match.group("alias")
    function = match.group("function")
    columns = parse_arguments(function, match.group("columns"))
    return get_function_alias_with_columns(function, columns)


def get_function_alias_with_columns(function_name, columns):
    columns = re.sub(r"[^\w]", "_", "_".join(columns))
    return f"{function_name}_{columns}".rstrip("_")


def get_json_meta_type(field_alias, snuba_type, function=None):
    alias_definition = FIELD_ALIASES.get(field_alias)
    if alias_definition and alias_definition.result_type is not None:
        return alias_definition.result_type

    snuba_json = get_json_type(snuba_type)
    if snuba_json != "string":
        if function is not None:
            result_type = function.instance.get_result_type(function.field, function.arguments)
            if result_type is not None:
                return result_type

        function_match = FUNCTION_ALIAS_PATTERN.match(field_alias)
        if function_match:
            function_definition = FUNCTIONS.get(function_match.group(1))
            if function_definition:
                result_type = function_definition.get_result_type()
                if result_type is not None:
                    return result_type

    if (
        "duration" in field_alias
        or is_duration_measurement(field_alias)
        or is_span_op_breakdown(field_alias)
    ):
        return "duration"
    if is_measurement(field_alias):
        return "number"
    if field_alias == "transaction.status":
        return "string"
    return snuba_json


def reflective_result_type(index=0):
    def result_type_fn(function_arguments, parameter_values):
        argument = function_arguments[index]
        value = parameter_values[argument.name]
        return argument.get_type(value)

    return result_type_fn


class ArgValue:
    def __init__(self, arg):
        self.arg = arg


class FunctionArg:
    def __init__(self, name):
        self.name = name
        self.has_default = False

    def get_default(self, params):
        raise InvalidFunctionArgument(f"{self.name} has no defaults")

    def normalize(self, value, params):
        return value

    def get_type(self, value):
        raise InvalidFunctionArgument(f"{self.name} has no type defined")


class FunctionAliasArg(FunctionArg):
    def normalize(self, value, params):
        if not ALIAS_PATTERN.match(value):
            raise InvalidFunctionArgument(f"{value} is not a valid function alias")
        return value


class NullColumn(FunctionArg):
    """
    Convert the provided column to null so that we
    can drop it. Used to make count() not have a
    required argument that we ignore.
    """

    def __init__(self, name):
        super().__init__(name)
        self.has_default = True

    def get_default(self, params):
        return None

    def normalize(self, value, params):
        return None


class CountColumn(FunctionArg):
    def __init__(self, name):
        super().__init__(name)
        self.has_default = True

    def get_default(self, params):
        return None

    def normalize(self, value, params):
        if value is None:
            raise InvalidFunctionArgument("a column is required")

        if value not in FIELD_ALIASES:
            return value

        field = FIELD_ALIASES[value]

        # If the alias has an expression prefer that over the column alias
        # This enables user.display to work in aggregates
        expression = field.get_expression(params)
        if expression is not None:
            return expression
        elif field.alias is not None:
            return field.alias
        return value


class FieldColumn(CountColumn):
    """Allow any field column, of any type"""

    def get_type(self, value):
        if is_duration_measurement(value) or is_span_op_breakdown(value):
            return "duration"
        elif value == "transaction.duration":
            return "duration"
        elif value == "timestamp":
            return "date"
        return "string"


class StringArg(FunctionArg):
    def __init__(self, name, unquote=False, unescape_quotes=False):
        super().__init__(name)
        self.unquote = unquote
        self.unescape_quotes = unescape_quotes

    def normalize(self, value, params):
        if self.unquote:
            if len(value) < 2 or value[0] != '"' or value[-1] != '"':
                raise InvalidFunctionArgument("string should be quoted")
            value = value[1:-1]
        if self.unescape_quotes:
            value = re.sub(r'\\"', '"', value)
        return f"'{value}'"


class DateArg(FunctionArg):
    date_format = "%Y-%m-%dT%H:%M:%S"

    def normalize(self, value, params):
        try:
            datetime.strptime(value, self.date_format)
        except ValueError:
            raise InvalidFunctionArgument(
                f"{value} is in the wrong format, expected a date like 2020-03-14T15:14:15"
            )
        return f"'{value}'"


class ConditionArg(FunctionArg):
    # List and not a set so the error message is consistent
    VALID_CONDITIONS = [
        "equals",
        "notEquals",
        "lessOrEquals",
        "greaterOrEquals",
        "less",
        "greater",
    ]

    def normalize(self, value, params):
        if value not in self.VALID_CONDITIONS:
            raise InvalidFunctionArgument(
                "{} is not a valid condition, the only supported conditions are: {}".format(
                    value,
                    ",".join(self.VALID_CONDITIONS),
                )
            )

        return value


class Column(FunctionArg):
    def __init__(self, name, allowed_columns=None):
        super().__init__(name)
        # make sure to map the allowed columns to their snuba names
        self.allowed_columns = [SEARCH_MAP.get(col) for col in allowed_columns]

    def normalize(self, value, params):
        snuba_column = SEARCH_MAP.get(value)
        if self.allowed_columns is not None:
            if value in self.allowed_columns or snuba_column in self.allowed_columns:
                return snuba_column
            else:
                raise InvalidFunctionArgument(f"{value} is not an allowed column")
        if not snuba_column:
            raise InvalidFunctionArgument(f"{value} is not a valid column")
        return snuba_column


class ColumnNoLookup(Column):
    def __init__(self, name, allowed_columns=None):
        super().__init__(name, allowed_columns=allowed_columns)

    def normalize(self, value, params):
        super().normalize(value, params)
        return value


class NumericColumn(FunctionArg):
    def _normalize(self, value):
        # This method is written in this way so that `get_type` can always call
        # this even in child classes where `normalize` have been overridden.

        snuba_column = SEARCH_MAP.get(value)
        if not snuba_column and is_measurement(value):
            return value
        if not snuba_column and is_span_op_breakdown(value):
            return value
        if not snuba_column:
            raise InvalidFunctionArgument(f"{value} is not a valid column")
        elif snuba_column not in ["time", "timestamp", "duration"]:
            raise InvalidFunctionArgument(f"{value} is not a numeric column")
        return snuba_column

    def normalize(self, value, params):
        return self._normalize(value)

    def get_type(self, value):
        snuba_column = self._normalize(value)
        if is_duration_measurement(snuba_column) or is_span_op_breakdown(snuba_column):
            return "duration"
        elif snuba_column == "duration":
            return "duration"
        elif snuba_column == "timestamp":
            return "date"
        return "number"


class NumericColumnNoLookup(NumericColumn):
    def __init__(self, name, allow_array_value=False):
        super().__init__(name)
        self.allow_array_value = allow_array_value

    def normalize(self, value, params):
        # `measurement_value` and `span_op_breakdowns_value` are actually an
        # array of Float64s. But when used in this context, we always want to
        # expand it using `arrayJoin`. The resulting column will be a numeric
        # column of type Float64.
        if self.allow_array_value:
            if value in {"measurements_value", "span_op_breakdowns_value"}:
                return ["arrayJoin", [value]]

        super().normalize(value, params)
        return value


class DurationColumn(FunctionArg):
    def normalize(self, value, params):
        snuba_column = SEARCH_MAP.get(value)
        if not snuba_column and is_duration_measurement(value):
            return value
        if not snuba_column and is_span_op_breakdown(value):
            return value
        if not snuba_column:
            raise InvalidFunctionArgument(f"{value} is not a valid column")
        elif snuba_column != "duration":
            raise InvalidFunctionArgument(f"{value} is not a duration column")
        return snuba_column


class DurationColumnNoLookup(DurationColumn):
    def normalize(self, value, params):
        super().normalize(value, params)
        return value


class StringArrayColumn(FunctionArg):
    def normalize(self, value, params):
        if value in ["tags.key", "tags.value", "measurements_key", "span_op_breakdowns_key"]:
            return value
        raise InvalidFunctionArgument(f"{value} is not a valid string array column")


class NumberRange(FunctionArg):
    def __init__(self, name, start, end):
        super().__init__(name)
        self.start = start
        self.end = end

    def normalize(self, value, params):
        try:
            value = float(value)
        except ValueError:
            raise InvalidFunctionArgument(f"{value} is not a number")

        if self.start and value < self.start:
            raise InvalidFunctionArgument(
                f"{value:g} must be greater than or equal to {self.start:g}"
            )
        elif self.end and value >= self.end:
            raise InvalidFunctionArgument(f"{value:g} must be less than {self.end:g}")

        return value


class IntervalDefault(NumberRange):
    def __init__(self, name, start, end):
        super().__init__(name, start, end)
        self.has_default = True

    def get_default(self, params):
        if not params or not params.get("start") or not params.get("end"):
            raise InvalidFunctionArgument("function called without default")
        elif not isinstance(params.get("start"), datetime) or not isinstance(
            params.get("end"), datetime
        ):
            raise InvalidFunctionArgument("function called with invalid default")

        interval = (params["end"] - params["start"]).total_seconds()
        return int(interval)


def with_default(default, argument):
    argument.has_default = True
    argument.get_default = lambda *_: default
    return argument


class Function:
    def __init__(
        self,
        name,
        required_args=None,
        optional_args=None,
        calculated_args=None,
        column=None,
        aggregate=None,
        transform=None,
        result_type_fn=None,
        default_result_type=None,
        redundant_grouping=False,
        private=False,
    ):
        """
        Specifies a function interface that must be followed when defining new functions

        :param str name: The name of the function, this refers to the name to invoke.
        :param list[FunctionArg] required_args: The list of required arguments to the function.
            If any of these arguments are not specified, an error will be raised.
        :param list[FunctionArg] optional_args: The list of optional arguments to the function.
            If any of these arguments are not specified, they will be filled using their default value.
        :param list[obj] calculated_args: The list of calculated arguments to the function.
            These arguments will be computed based on the list of specified arguments.
        :param [str, [any], str or None] column: The column to be passed to snuba once formatted.
            The arguments will be filled into the column where needed. This must not be an aggregate.
        :param [str, [any], str or None] aggregate: The aggregate to be passed to snuba once formatted.
            The arguments will be filled into the aggregate where needed. This must be an aggregate.
        :param str transform: NOTE: Use aggregate over transform whenever possible.
            An aggregate string to be passed to snuba once formatted. The arguments
            will be filled into the string using `.format(...)`.
        :param str result_type_fn: A function to call with in order to determine the result type.
            This function will be passed the list of argument classes and argument values. This should
            be tried first as the source of truth if available.
        :param str default_result_type: The default resulting type of this function. Must be a type
            defined by RESULTS_TYPES.
        :param bool redundant_grouping: This function will result in redundant grouping if its column
            is included as a field as well.
        :param bool private: Whether or not this function should be disabled for general use.
        """

        self.name = name
        self.required_args = [] if required_args is None else required_args
        self.optional_args = [] if optional_args is None else optional_args
        self.calculated_args = [] if calculated_args is None else calculated_args
        self.column = column
        self.aggregate = aggregate
        self.transform = transform
        self.result_type_fn = result_type_fn
        self.default_result_type = default_result_type
        self.redundant_grouping = redundant_grouping
        self.private = private

        self.validate()

    @property
    def required_args_count(self):
        return len(self.required_args)

    @property
    def optional_args_count(self):
        return len(self.optional_args)

    @property
    def total_args_count(self):
        return self.required_args_count + self.optional_args_count

    @property
    def args(self):
        return self.required_args + self.optional_args

    def alias_as(self, name):
        """Create a copy of this function to be used as an alias"""
        alias = deepcopy(self)
        alias.name = name
        return alias

    def add_default_arguments(self, field, columns, params):
        # make sure to validate the argument count first to
        # ensure the right number of arguments have been passed
        self.validate_argument_count(field, columns)

        columns = [column for column in columns]

        # use default values to populate optional arguments if any
        for argument in self.args[len(columns) :]:
            try:
                default = argument.get_default(params)
            except InvalidFunctionArgument as e:
                raise InvalidSearchQuery(f"{field}: invalid arguments: {e}")

            # Hacky, but we expect column arguments to be strings so easiest to convert it back
            columns.append(str(default) if default else default)

        return columns

    def format_as_arguments(self, field, columns, params):
        columns = self.add_default_arguments(field, columns, params)

        arguments = {}

        # normalize the arguments before putting them in a dict
        for argument, column in zip(self.args, columns):
            try:
                arguments[argument.name] = argument.normalize(column, params)
            except InvalidFunctionArgument as e:
                raise InvalidSearchQuery(f"{field}: {argument.name} argument invalid: {e}")

        # populate any computed args
        for calculation in self.calculated_args:
            arguments[calculation["name"]] = calculation["fn"](arguments)

        return arguments

    def get_result_type(self, field=None, arguments=None):
        if field is None or arguments is None or self.result_type_fn is None:
            return self.default_result_type

        result_type = self.result_type_fn(self.args, arguments)
        if result_type is None:
            return self.default_result_type

        self.validate_result_type(result_type)
        return result_type

    def validate(self):
        # assert that all optional args have defaults available
        for i, arg in enumerate(self.optional_args):
            assert (
                arg.has_default
            ), f"{self.name}: optional argument at index {i} does not have default"

        # assert that the function has only one of the following specified
        # `column`, `aggregate`, or `transform`
        assert (
            sum([self.column is not None, self.aggregate is not None, self.transform is not None])
            == 1
        ), f"{self.name}: only one of column, aggregate, or transform is allowed"

        # assert that no duplicate argument names are used
        names = set()
        for arg in self.args:
            assert (
                arg.name not in names
            ), f"{self.name}: argument {arg.name} specified more than once"
            names.add(arg.name)

        for calculation in self.calculated_args:
            assert (
                calculation["name"] not in names
            ), "{}: argument {} specified more than once".format(self.name, calculation["name"])
            names.add(calculation["name"])

        self.validate_result_type(self.default_result_type)

    def validate_argument_count(self, field, arguments):
        """
        Validate the number of required arguments the function defines against
        provided arguments. Raise an exception if there is a mismatch in the
        number of arguments. Do not return any values.

        There are 4 cases:
            1. provided # of arguments != required # of arguments AND provided # of arguments != total # of arguments (bad, raise an error)
            2. provided # of arguments < required # of arguments (bad, raise an error)
            3. provided # of arguments > total # of arguments (bad, raise an error)
            4. required # of arguments <= provided # of arguments <= total # of arguments (good, pass the validation)
        """
        args_count = len(arguments)
        total_args_count = self.total_args_count
        if args_count != total_args_count:
            required_args_count = self.required_args_count
            if required_args_count == total_args_count:
                raise InvalidSearchQuery(f"{field}: expected {total_args_count:g} argument(s)")
            elif args_count < required_args_count:
                raise InvalidSearchQuery(
                    f"{field}: expected at least {required_args_count:g} argument(s)"
                )
            elif args_count > total_args_count:
                raise InvalidSearchQuery(
                    f"{field}: expected at most {total_args_count:g} argument(s)"
                )

    def validate_result_type(self, result_type):
        assert (
            result_type is None or result_type in RESULT_TYPES
        ), f"{self.name}: result type {result_type} not one of {list(RESULT_TYPES)}"

    def is_accessible(self, acl=None):
        if not self.private:
            return True
        elif not acl:
            return False
        return self.name in acl


# When updating this list, also check if the following need to be updated:
# - convert_search_filter_to_snuba_query
# - static/app/utils/discover/fields.tsx FIELDS (for discover column list and search box autocomplete)
FUNCTIONS = {
    function.name: function
    for function in [
        Function(
            "percentile",
            required_args=[NumericColumnNoLookup("column"), NumberRange("percentile", 0, 1)],
            aggregate=["quantile({percentile:g})", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p50",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["quantile(0.5)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p75",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["quantile(0.75)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p95",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["quantile(0.95)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p99",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["quantile(0.99)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "p100",
            optional_args=[with_default("transaction.duration", NumericColumnNoLookup("column"))],
            aggregate=["max", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "eps",
            optional_args=[IntervalDefault("interval", 1, None)],
            transform="divide(count(), {interval:g})",
            default_result_type="number",
        ),
        Function(
            "epm",
            optional_args=[IntervalDefault("interval", 1, None)],
            transform="divide(count(), divide({interval:g}, 60))",
            default_result_type="number",
        ),
        Function(
            "last_seen",
            aggregate=["max", "timestamp", "last_seen"],
            default_result_type="date",
            redundant_grouping=True,
        ),
        Function(
            "latest_event",
            aggregate=["argMax", ["id", "timestamp"], "latest_event"],
            default_result_type="string",
        ),
        Function(
            "apdex",
            required_args=[NumberRange("satisfaction", 0, None)],
            transform="apdex(duration, {satisfaction:g})",
            default_result_type="number",
        ),
        Function(
            "count_miserable",
            required_args=[CountColumn("column"), NumberRange("satisfaction", 0, None)],
            calculated_args=[{"name": "tolerated", "fn": lambda args: args["satisfaction"] * 4.0}],
            aggregate=[
                "uniqIf",
                [ArgValue("column"), ["greater", ["transaction.duration", ArgValue("tolerated")]]],
                None,
            ],
            default_result_type="number",
        ),
        Function(
            "user_misery",
            required_args=[NumberRange("satisfaction", 0, None)],
            # To correct for sensitivity to low counts, User Misery is modeled as a Beta Distribution Function.
            # With prior expectations, we have picked the expected mean user misery to be 0.05 and variance
            # to be 0.0004. This allows us to calculate the alpha (5.8875) and beta (111.8625) parameters,
            # with the user misery being adjusted for each fast/slow unique transaction. See:
            # https://stats.stackexchange.com/questions/47771/what-is-the-intuition-behind-beta-distribution
            # for an intuitive explanation of the Beta Distribution Function.
            optional_args=[
                with_default(5.8875, NumberRange("alpha", 0, None)),
                with_default(111.8625, NumberRange("beta", 0, None)),
            ],
            calculated_args=[
                {"name": "tolerated", "fn": lambda args: args["satisfaction"] * 4.0},
                {"name": "parameter_sum", "fn": lambda args: args["alpha"] + args["beta"]},
            ],
            transform="ifNull(divide(plus(uniqIf(user, greater(duration, {tolerated:g})), {alpha}), plus(uniq(user), {parameter_sum})), 0)",
            default_result_type="number",
        ),
        Function("failure_rate", transform="failure_rate()", default_result_type="percentage"),
        Function(
            "failure_count",
            aggregate=[
                "countIf",
                [
                    [
                        "not",
                        [
                            [
                                "has",
                                [
                                    [
                                        "array",
                                        [
                                            SPAN_STATUS_NAME_TO_CODE[name]
                                            for name in ["ok", "cancelled", "unknown"]
                                        ],
                                    ],
                                    "transaction_status",
                                ],
                            ],
                        ],
                    ],
                ],
                None,
            ],
            default_result_type="integer",
        ),
        Function(
            "array_join",
            required_args=[StringArrayColumn("column")],
            column=["arrayJoin", [ArgValue("column")], None],
            default_result_type="string",
            private=True,
        ),
        Function(
            "histogram",
            required_args=[
                NumericColumnNoLookup("column", allow_array_value=True),
                # the bucket_size and start_offset should already be adjusted
                # using the multiplier before it is passed here
                NumberRange("bucket_size", 0, None),
                NumberRange("start_offset", 0, None),
                NumberRange("multiplier", 1, None),
            ],
            # floor((x * multiplier - start_offset) / bucket_size) * bucket_size + start_offset
            column=[
                "plus",
                [
                    [
                        "multiply",
                        [
                            [
                                "floor",
                                [
                                    [
                                        "divide",
                                        [
                                            [
                                                "minus",
                                                [
                                                    [
                                                        "multiply",
                                                        [
                                                            ArgValue("column"),
                                                            ArgValue("multiplier"),
                                                        ],
                                                    ],
                                                    ArgValue("start_offset"),
                                                ],
                                            ],
                                            ArgValue("bucket_size"),
                                        ],
                                    ],
                                ],
                            ],
                            ArgValue("bucket_size"),
                        ],
                    ],
                    ArgValue("start_offset"),
                ],
                None,
            ],
            default_result_type="number",
            private=True,
        ),
        Function(
            "count_unique",
            optional_args=[CountColumn("column")],
            aggregate=["uniq", ArgValue("column"), None],
            default_result_type="integer",
        ),
        Function(
            "count",
            optional_args=[NullColumn("column")],
            aggregate=["count", None, None],
            default_result_type="integer",
        ),
        Function(
            "count_at_least",
            required_args=[NumericColumnNoLookup("column"), NumberRange("threshold", 0, None)],
            aggregate=[
                "countIf",
                [["greaterOrEquals", [ArgValue("column"), ArgValue("threshold")]]],
                None,
            ],
            default_result_type="integer",
        ),
        Function(
            "min",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["min", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "max",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["max", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "avg",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["avg", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        Function(
            "var",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["varSamp", ArgValue("column"), None],
            default_result_type="number",
            redundant_grouping=True,
        ),
        Function(
            "stddev",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["stddevSamp", ArgValue("column"), None],
            default_result_type="number",
            redundant_grouping=True,
        ),
        Function(
            "sum",
            required_args=[NumericColumnNoLookup("column")],
            aggregate=["sum", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
        ),
        Function(
            "any",
            required_args=[FieldColumn("column")],
            aggregate=["min", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            redundant_grouping=True,
        ),
        # Currently only being used by the baseline PoC
        Function(
            "absolute_delta",
            required_args=[DurationColumnNoLookup("column"), NumberRange("target", 0, None)],
            column=["abs", [["minus", [ArgValue("column"), ArgValue("target")]]], None],
            default_result_type="duration",
        ),
        # These range functions for performance trends, these aren't If functions
        # to avoid allowing arbitrary if statements
        # Not yet supported in Discover, and shouldn't be added to fields.tsx
        Function(
            "percentile_range",
            required_args=[
                NumericColumnNoLookup("column"),
                NumberRange("percentile", 0, 1),
                ConditionArg("condition"),
                DateArg("middle"),
            ],
            aggregate=[
                "quantileIf({percentile:.2f})",
                [
                    ArgValue("column"),
                    # NOTE: This condition is written in this seemingly backwards way
                    # because of how snuba special cases the following syntax
                    # ["a", ["b", ["c", ["d"]]]
                    #
                    # This array is can be interpreted 2 ways
                    # 1. a(b(c(d))) the way snuba interprets it
                    #   - snuba special cases it when it detects an array where the first
                    #     element is a literal, and the second element is an array and
                    #     treats it as a function call rather than 2 separate arguments
                    # 2. a(b, c(d)) the way we want it to be interpreted
                    #
                    # Because of how snuba interprets this expression, it makes it impossible
                    # to specify a function with 2 arguments whose first argument is a literal
                    # and the second argument is an expression.
                    #
                    # Working with this limitation, we have to invert the conditions in
                    # order to express a function whose first argument is an expression while
                    # the second argument is a literal.
                    [ArgValue("condition"), [["toDateTime", [ArgValue("middle")]], "timestamp"]],
                ],
                None,
            ],
            default_result_type="duration",
        ),
        Function(
            "avg_range",
            required_args=[
                NumericColumnNoLookup("column"),
                ConditionArg("condition"),
                DateArg("middle"),
            ],
            aggregate=[
                "avgIf",
                [
                    ArgValue("column"),
                    # see `percentile_range` for why this condition feels backwards
                    [ArgValue("condition"), [["toDateTime", [ArgValue("middle")]], "timestamp"]],
                ],
                None,
            ],
            default_result_type="duration",
        ),
        Function(
            "variance_range",
            required_args=[
                NumericColumnNoLookup("column"),
                ConditionArg("condition"),
                DateArg("middle"),
            ],
            aggregate=[
                "varSampIf",
                [
                    ArgValue("column"),
                    # see `percentile_range` for why this condition feels backwards
                    [ArgValue("condition"), [["toDateTime", [ArgValue("middle")]], "timestamp"]],
                ],
                None,
            ],
            default_result_type="duration",
        ),
        Function(
            "count_range",
            required_args=[ConditionArg("condition"), DateArg("middle")],
            aggregate=[
                "countIf",
                # see `percentile_range` for why this condition feels backwards
                [[ArgValue("condition"), [["toDateTime", [ArgValue("middle")]], "timestamp"]]],
                None,
            ],
            default_result_type="integer",
        ),
        Function(
            "percentage",
            required_args=[FunctionArg("numerator"), FunctionArg("denominator")],
            # Since percentage is only used on aggregates, it needs to be an aggregate and not a column
            # This is because as a column it will be added to the `WHERE` clause instead of the `HAVING` clause
            aggregate=[
                "if(greater({denominator},0),divide({numerator},{denominator}),null)",
                None,
                None,
            ],
            default_result_type="percentage",
        ),
        # Calculate the Welch's t-test value, this is used to help identify which of our trends are significant or not
        Function(
            "t_test",
            required_args=[
                FunctionAliasArg("avg_1"),
                FunctionAliasArg("avg_2"),
                FunctionAliasArg("variance_1"),
                FunctionAliasArg("variance_2"),
                FunctionAliasArg("count_1"),
                FunctionAliasArg("count_2"),
            ],
            aggregate=[
                "divide(minus({avg_1},{avg_2}),sqrt(plus(divide({variance_1},{count_1}),divide({variance_2},{count_2}))))",
                None,
                "t_test",
            ],
            default_result_type="number",
        ),
        Function(
            "minus",
            required_args=[FunctionArg("minuend"), FunctionArg("subtrahend")],
            aggregate=["minus", [ArgValue("minuend"), ArgValue("subtrahend")], None],
            default_result_type="duration",
        ),
        Function(
            "absolute_correlation",
            aggregate=[
                "abs",
                [["corr", [["toUnixTimestamp", ["timestamp"]], "transaction.duration"]]],
                None,
            ],
            default_result_type="number",
        ),
        # Currently only used by trace meta so we can count event types which is why this only accepts strings
        Function(
            "count_if",
            required_args=[
                ColumnNoLookup("column", allowed_columns=["event.type", "http.status_code"]),
                ConditionArg("condition"),
                StringArg("value"),
            ],
            aggregate=[
                "countIf",
                [
                    [
                        ArgValue("condition"),
                        [
                            ArgValue("column"),
                            ArgValue("value"),
                        ],
                    ]
                ],
                None,
            ],
            default_result_type="integer",
        ),
        Function(
            "compare_numeric_aggregate",
            required_args=[
                FunctionAliasArg("aggregate_alias"),
                ConditionArg("condition"),
                NumberRange("value", 0, None),
            ],
            aggregate=[
                # snuba json syntax isn't compatible with this query here
                # this function can't be a column, since we want to use this with aggregates
                "{condition}({aggregate_alias},{value})",
                None,
                None,
            ],
            default_result_type="number",
        ),
        Function(
            "to_other",
            required_args=[
                ColumnNoLookup("column", allowed_columns=["release", "trace.parent_span"]),
                StringArg("value", unquote=True, unescape_quotes=True),
            ],
            optional_args=[
                with_default("that", StringArg("that")),
                with_default("this", StringArg("this")),
            ],
            column=[
                "if",
                [
                    ["equals", [ArgValue("column"), ArgValue("value")]],
                    ArgValue("this"),
                    ArgValue("that"),
                ],
            ],
        ),
    ]
}


# In Performance TPM is used as an alias to EPM
FUNCTION_ALIASES = {
    "tpm": "epm",
    "tps": "eps",
}
for alias, name in FUNCTION_ALIASES.items():
    FUNCTIONS[alias] = FUNCTIONS[name].alias_as(alias)


FUNCTION_ALIAS_PATTERN = re.compile(r"^({}).*".format("|".join(list(FUNCTIONS.keys()))))

import re
from collections import defaultdict, namedtuple
from copy import deepcopy
from datetime import datetime
from typing import Any, List, Mapping, Match, NamedTuple, Optional, Sequence, Set, Tuple, Union

import sentry_sdk
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from snuba_sdk.function import Function

from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project, ProjectTeam, ProjectTransactionThreshold
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThresholdOverride,
)
from sentry.search.events.constants import (
    ALIAS_PATTERN,
    ARRAY_FIELDS,
    DEFAULT_PROJECT_THRESHOLD,
    DEFAULT_PROJECT_THRESHOLD_METRIC,
    DURATION_PATTERN,
    ERROR_UNHANDLED_ALIAS,
    FUNCTION_ALIASES,
    FUNCTION_PATTERN,
    MEASUREMENTS_FRAMES_FROZEN_RATE,
    MEASUREMENTS_FRAMES_SLOW_RATE,
    MEASUREMENTS_STALL_PERCENTAGE,
    PROJECT_ALIAS,
    PROJECT_NAME_ALIAS,
    PROJECT_THRESHOLD_CONFIG_ALIAS,
    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    RESULT_TYPES,
    SEARCH_MAP,
    TAG_KEY_RE,
    TEAM_KEY_TRANSACTION_ALIAS,
    USER_DISPLAY_ALIAS,
    VALID_FIELD_PATTERN,
)
from sentry.search.events.types import NormalizedArg, ParamsType
from sentry.search.utils import InvalidQuery, parse_duration
from sentry.utils.compat import zip
from sentry.utils.numbers import format_grouped_length
from sentry.utils.snuba import (
    SESSIONS_SNUBA_MAP,
    get_json_type,
    is_duration_measurement,
    is_measurement,
    is_span_op_breakdown,
)

MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS = 500
MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 500

ConditionalFunction = namedtuple("ConditionalFunction", "condition match fallback")
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

    def get_expression(self, params) -> Union[List[Any], Tuple[Any]]:
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


def project_threshold_config_expression(organization_id, project_ids):
    """
    This function returns a column with the threshold and threshold metric
    for each transaction based on project level settings. If no project level
    thresholds are set, the will fallback to the default values. This column
    is used in the new `count_miserable` and `user_misery` aggregates.
    """
    if organization_id is None or project_ids is None:
        raise InvalidSearchQuery("Missing necessary data for project threshold config")

    project_threshold_configs = (
        ProjectTransactionThreshold.objects.filter(
            organization_id=organization_id,
            project_id__in=project_ids,
        )
        .order_by("project_id")
        .values("project_id", "threshold", "metric")
    )

    transaction_threshold_configs = (
        ProjectTransactionThresholdOverride.objects.filter(
            organization_id=organization_id,
            project_id__in=project_ids,
        )
        .order_by("project_id")
        .values("transaction", "project_id", "threshold", "metric")
    )

    num_project_thresholds = project_threshold_configs.count()
    sentry_sdk.set_tag("project_threshold.count", num_project_thresholds)
    sentry_sdk.set_tag(
        "project_threshold.count.grouped",
        format_grouped_length(num_project_thresholds, [10, 100, 250, 500]),
    )

    num_transaction_thresholds = transaction_threshold_configs.count()
    sentry_sdk.set_tag("txn_threshold.count", num_transaction_thresholds)
    sentry_sdk.set_tag(
        "txn_threshold.count.grouped",
        format_grouped_length(num_transaction_thresholds, [10, 100, 250, 500]),
    )

    if num_project_thresholds + num_transaction_thresholds == 0:
        return ["tuple", [f"'{DEFAULT_PROJECT_THRESHOLD_METRIC}'", DEFAULT_PROJECT_THRESHOLD]]
    elif num_project_thresholds + num_transaction_thresholds > MAX_QUERYABLE_TRANSACTION_THRESHOLDS:
        raise InvalidSearchQuery(
            f"Exceeded {MAX_QUERYABLE_TRANSACTION_THRESHOLDS} configured transaction thresholds limit, try with fewer Projects."
        )

    project_threshold_config_index = [
        "indexOf",
        [
            [
                "array",
                [["toUInt64", [config["project_id"]]] for config in project_threshold_configs],
            ],
            "project_id",
        ],
        PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    ]

    project_transaction_override_config_index = [
        "indexOf",
        [
            [
                "array",
                [
                    [
                        "tuple",
                        [
                            ["toUInt64", [config["project_id"]]],
                            "'{}'".format(config["transaction"]),
                        ],
                    ]
                    for config in transaction_threshold_configs
                ],
            ],
            ["tuple", ["project_id", "transaction"]],
        ],
        PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    ]

    project_config_query = (
        [
            "if",
            [
                [
                    "equals",
                    [
                        project_threshold_config_index,
                        0,
                    ],
                ],
                ["tuple", [f"'{DEFAULT_PROJECT_THRESHOLD_METRIC}'", DEFAULT_PROJECT_THRESHOLD]],
                [
                    "arrayElement",
                    [
                        [
                            "array",
                            [
                                [
                                    "tuple",
                                    [
                                        "'{}'".format(TRANSACTION_METRICS[config["metric"]]),
                                        config["threshold"],
                                    ],
                                ]
                                for config in project_threshold_configs
                            ],
                        ],
                        project_threshold_config_index,
                    ],
                ],
            ],
        ]
        if project_threshold_configs
        else ["tuple", [f"'{DEFAULT_PROJECT_THRESHOLD_METRIC}'", DEFAULT_PROJECT_THRESHOLD]]
    )

    if transaction_threshold_configs:
        return [
            "if",
            [
                [
                    "equals",
                    [
                        project_transaction_override_config_index,
                        0,
                    ],
                ],
                project_config_query,
                [
                    "arrayElement",
                    [
                        [
                            "array",
                            [
                                [
                                    "tuple",
                                    [
                                        "'{}'".format(TRANSACTION_METRICS[config["metric"]]),
                                        config["threshold"],
                                    ],
                                ]
                                for config in transaction_threshold_configs
                            ],
                        ],
                        project_transaction_override_config_index,
                    ],
                ],
            ],
        ]

    return project_config_query


def team_key_transaction_expression(organization_id, team_ids, project_ids):
    if organization_id is None or team_ids is None or project_ids is None:
        raise TypeError("Team key transactions parameters cannot be None")

    team_key_transactions = (
        TeamKeyTransaction.objects.filter(
            organization_id=organization_id,
            project_team__in=ProjectTeam.objects.filter(
                project_id__in=project_ids, team_id__in=team_ids
            ),
        )
        .order_by("transaction", "project_team__project_id")
        .values("transaction", "project_team__project_id")
        .distinct("transaction", "project_team__project_id")[:MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS]
    )

    count = len(team_key_transactions)

    # NOTE: this raw count is not 100% accurate because if it exceeds
    # `MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS`, it will not be reflected
    sentry_sdk.set_tag("team_key_txns.count", count)
    sentry_sdk.set_tag(
        "team_key_txns.count.grouped", format_grouped_length(count, [10, 100, 250, 500])
    )

    # There are no team key transactions marked, so hard code false into the query.
    if count == 0:
        return ["toInt8", [0]]

    return [
        "in",
        [
            ["tuple", ["project_id", "transaction"]],
            [
                "tuple",
                [
                    [
                        "tuple",
                        [
                            transaction["project_team__project_id"],
                            "'{}'".format(transaction["transaction"]),
                        ],
                    ]
                    for transaction in team_key_transactions
                ],
            ],
        ],
    ]


def normalize_count_if_value(args: Mapping[str, str]) -> Union[float, str, int]:
    """Ensures that the type of the third parameter is compatible with the first
    and cast the value if needed
    eg. duration = numeric_value, and not duration = string_value
    """
    column = args["column"]
    value = args["value"]
    if column == "transaction.duration" or is_measurement(column) or is_span_op_breakdown(column):
        duration_match = DURATION_PATTERN.match(value.strip("'"))
        if duration_match:
            try:
                normalized_value = parse_duration(*duration_match.groups())
            except InvalidQuery as exc:
                raise InvalidSearchQuery(str(exc))
        else:
            try:
                normalized_value = float(value.strip("'"))
            except Exception:
                raise InvalidSearchQuery(f"{value} is not a valid value to compare with {column}")
    elif column == "transaction.status":
        code = SPAN_STATUS_NAME_TO_CODE.get(value.strip("'"))
        if code is None:
            raise InvalidSearchQuery(f"{value} is not a valid value for transaction.status")
        try:
            normalized_value = int(code)
        except Exception:
            raise InvalidSearchQuery(f"{value} is not a valid value for transaction.status")
    # TODO: not supporting field aliases or arrays yet
    elif column in FIELD_ALIASES or column in ARRAY_FIELDS:
        raise InvalidSearchQuery(f"{column} is not supported by count_if")
    else:
        normalized_value = value

    return normalized_value


# When updating this list, also check if the following need to be updated:
# - convert_search_filter_to_snuba_query (otherwise aliased field will be treated as tag)
# - static/app/utils/discover/fields.tsx FIELDS (for discover column list and search box autocomplete)

# TODO: I think I have to support the release stage alias here maybe?
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
            expression=["coalesce", ["user.email", "user.username", "user.id", "user.ip"]],
        ),
        PseudoField(
            PROJECT_THRESHOLD_CONFIG_ALIAS,
            PROJECT_THRESHOLD_CONFIG_ALIAS,
            expression_fn=lambda params: project_threshold_config_expression(
                params.get("organization_id"),
                params.get("project_id"),
            ),
        ),
        # the team key transaction field is intentially not added to the discover/fields list yet
        # because there needs to be some work on the front end to integrate this into discover
        PseudoField(
            TEAM_KEY_TRANSACTION_ALIAS,
            TEAM_KEY_TRANSACTION_ALIAS,
            expression_fn=lambda params: team_key_transaction_expression(
                params.get("organization_id"),
                params.get("team_id"),
                params.get("project_id"),
            ),
            result_type="boolean",
        ),
        PseudoField(
            MEASUREMENTS_FRAMES_SLOW_RATE,
            MEASUREMENTS_FRAMES_SLOW_RATE,
            expression=[
                "if",
                [
                    ["greater", ["measurements.frames_total", 0]],
                    ["divide", ["measurements.frames_slow", "measurements.frames_total"]],
                    None,
                ],
            ],
            result_type="percentage",
        ),
        PseudoField(
            MEASUREMENTS_FRAMES_FROZEN_RATE,
            MEASUREMENTS_FRAMES_FROZEN_RATE,
            expression=[
                "if",
                [
                    ["greater", ["measurements.frames_total", 0]],
                    ["divide", ["measurements.frames_frozen", "measurements.frames_total"]],
                    None,
                ],
            ],
            result_type="percentage",
        ),
        PseudoField(
            MEASUREMENTS_STALL_PERCENTAGE,
            MEASUREMENTS_STALL_PERCENTAGE,
            expression=[
                "if",
                [
                    ["greater", ["transaction.duration", 0]],
                    ["divide", ["measurements.stall_total_time", "transaction.duration"]],
                    None,
                ],
            ],
            result_type="percentage",
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


def parse_arguments(function: str, columns: str) -> List[str]:
    """
    Some functions take a quoted string for their arguments that may contain commas,
    which requires special handling.
    This function attempts to be identical with the similarly named parse_arguments
    found in static/app/utils/discover/fields.tsx
    """
    if (function != "to_other" and function != "count_if") or len(columns) == 0:
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
        elif i == j and columns[j] == " ":
            # argument has leading spaces, skip over them
            i += 1
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


def format_column_as_key(x):
    if isinstance(x, list):
        return tuple(format_column_as_key(y) for y in x)
    return x


def resolve_field_list(
    fields,
    snuba_filter,
    auto_fields=True,
    auto_aggregations=False,
    functions_acl=None,
    resolved_equations=None,
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

    field = None
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
                    aggregate_fields[format_column_as_key(function.aggregate[1])].add(field)

    # Only auto aggregate when there's one other so the group by is not unexpectedly changed
    if auto_aggregations and snuba_filter.having and len(aggregations) > 0 and field is not None:
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
                            aggregate_fields[format_column_as_key(function.aggregate[1])].add(field)

    check_aggregations = (
        snuba_filter.having and len(aggregations) > 0 and snuba_filter.condition_aggregates
    )
    snuba_filter_condition_aggregates = (
        set(snuba_filter.condition_aggregates) if check_aggregations else set()
    )
    for field in set(fields[:]).union(snuba_filter_condition_aggregates):
        if isinstance(field, str) and field in {
            "apdex()",
            "count_miserable(user)",
            "user_misery()",
        }:
            if PROJECT_THRESHOLD_CONFIG_ALIAS not in fields:
                fields.append(PROJECT_THRESHOLD_CONFIG_ALIAS)
                function = resolve_field(
                    PROJECT_THRESHOLD_CONFIG_ALIAS, snuba_filter.params, functions_acl
                )
                columns.append(function.column)
                break

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
        orderby = resolve_orderby(orderby, columns, aggregations, resolved_equations)
    else:
        orderby = None

    # If aggregations are present all columns
    # need to be added to the group by so that the query is valid.
    if aggregations:
        for column in columns:
            is_iterable = isinstance(column, (list, tuple))
            if is_iterable and column[0] == "transform":
                # When there's a project transform, we already group by project_id
                continue
            elif is_iterable and column[2] not in FIELD_ALIASES:
                groupby.append(column[2])
            else:
                column_key = format_column_as_key([column[:2]]) if is_iterable else column
                if column_key in aggregate_fields:
                    conflicting_functions = list(aggregate_fields[column_key])
                    raise InvalidSearchQuery(
                        "A single field cannot be used both inside and outside a function in the same query. To use {field} you must first remove the function(s): {function_msg}".format(
                            field=column[2] if is_iterable else column,
                            function_msg=", ".join(conflicting_functions[:2])
                            + (
                                f" and {len(conflicting_functions) - 2} more."
                                if len(conflicting_functions) > 2
                                else ""
                            ),
                        )
                    )
                groupby.append(column)

    if resolved_equations:
        columns += resolved_equations

    return {
        "selected_columns": columns,
        "aggregations": aggregations,
        "groupby": groupby,
        "orderby": orderby,
        "functions": functions,
    }


def resolve_orderby(orderby, fields, aggregations, equations):
    """
    We accept column names, aggregate functions, and aliases as order by
    values. Aggregates and field aliases need to be resolve/validated.

    TODO(mark) Once we're no longer using the dataset selection function
    should allow all non-tag fields to be used as sort clauses, instead of only
    those that are currently selected.
    """
    orderby = orderby if isinstance(orderby, (list, tuple)) else [orderby]
    if equations is not None:
        equation_aliases = {equation[-1]: equation for equation in equations}
    else:
        equation_aliases = {}
    validated = []
    for column in orderby:
        bare_column = column.lstrip("-")

        if bare_column in fields:
            validated.append(column)
            continue

        if equation_aliases and bare_column in equation_aliases:
            equation = equation_aliases[bare_column]
            prefix = "-" if column.startswith("-") else ""
            # Drop alias because if prefix was included snuba thinks we're shadow aliasing
            validated.append([prefix + equation[0], equation[1]])
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

    raise InvalidSearchQuery("Cannot sort by a field that is not selected.")


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
    elif function.conditional_transform is not None:
        condition, match, fallback = function.conditional_transform
        if alias is None:
            alias = get_function_alias_with_columns(function.name, columns)

        if arguments[condition.arg] is not None:
            snuba_string = match.format(**arguments)
        else:
            snuba_string = fallback.format(**arguments)
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


def parse_combinator(function: str) -> Tuple[str, Optional[str]]:
    for combinator in COMBINATORS:
        kind = combinator.kind
        if function.endswith(kind):
            return function[: -len(kind)], kind

    return function, None


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


def is_function(field: str) -> Optional[Match[str]]:
    function_match = FUNCTION_PATTERN.search(field)
    if function_match:
        return function_match

    return None


def get_function_alias(field: str) -> str:
    match = FUNCTION_PATTERN.search(field)
    if match is None:
        return field

    if match.group("alias") is not None:
        return match.group("alias")
    function = match.group("function")
    columns = parse_arguments(function, match.group("columns"))
    return get_function_alias_with_columns(function, columns)


def get_function_alias_with_columns(function_name, columns) -> str:
    columns = re.sub(r"[^\w]", "_", "_".join(str(col) for col in columns))
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


class Combinator:
    # The kind of combinator this is, to be overridden in the subclasses
    kind: Optional[str] = None

    def __init__(self, private: bool = True):
        self.private = private

    def validate_argument(self, column: str) -> bool:
        raise NotImplementedError(f"{self.kind} combinator needs to implement `validate_argument`")

    def apply(self, value: Any) -> Any:
        raise NotImplementedError(f"{self.kind} combinator needs to implement `apply`")

    def is_applicable(self, column_name: str) -> bool:
        raise NotImplementedError(f"{self.kind} combinator needs to implement `is_applicable`")


class ArrayCombinator(Combinator):
    kind = "Array"

    def __init__(self, column_name: str, array_columns: Set[str], private: bool = True):
        super().__init__(private=private)
        self.column_name = column_name
        self.array_columns = array_columns

    def validate_argument(self, column: str) -> bool:
        if column in self.array_columns:
            return True

        raise InvalidFunctionArgument(f"{column} is not a valid array column.")

    def is_applicable(self, column_name: str) -> bool:
        return self.column_name == column_name


class SnQLArrayCombinator(ArrayCombinator):
    def apply(self, value: Any) -> Any:
        return Function("arrayJoin", [value])


COMBINATORS = [ArrayCombinator]


class ArgValue:
    def __init__(self, arg: str):
        self.arg = arg


class FunctionArg:
    """Parent class to function arguments, including both column references and values"""

    def __init__(self, name: str):
        self.name = name
        self.has_default = False

    def get_default(self, _):
        raise InvalidFunctionArgument(f"{self.name} has no defaults")

    def normalize(
        self, value: str, params: ParamsType, combinator: Optional[Combinator]
    ) -> NormalizedArg:
        return value

    def get_type(self, _):
        raise InvalidFunctionArgument(f"{self.name} has no type defined")


class FunctionAliasArg(FunctionArg):
    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        if not ALIAS_PATTERN.match(value):
            raise InvalidFunctionArgument(f"{value} is not a valid function alias")
        return value


class StringArg(FunctionArg):
    def __init__(
        self,
        name: str,
        unquote: Optional[bool] = False,
        unescape_quotes: Optional[bool] = False,
        optional_unquote: Optional[bool] = False,
    ):
        """
        :param str name: The name of the function, this refers to the name to invoke.
        :param boolean unquote: Whether to try unquoting the arg or not
        :param boolean unescape_quotes: Whether quotes within the string should be unescaped
        :param boolean optional_unquote: Don't error when unable to unquote
        """
        super().__init__(name)
        self.unquote = unquote
        self.unescape_quotes = unescape_quotes
        self.optional_unquote = optional_unquote

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        if self.unquote:
            if len(value) < 2 or value[0] != '"' or value[-1] != '"':
                if not self.optional_unquote:
                    raise InvalidFunctionArgument("string should be quoted")
            else:
                value = value[1:-1]
        if self.unescape_quotes:
            value = re.sub(r'\\"', '"', value)
        return f"'{value}'"


class DateArg(FunctionArg):
    date_format = "%Y-%m-%dT%H:%M:%S"

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        try:
            datetime.strptime(value, self.date_format)
        except ValueError:
            raise InvalidFunctionArgument(
                f"{value} is in the wrong format, expected a date like 2020-03-14T15:14:15"
            )
        return f"'{value}'"


class ConditionArg(FunctionArg):
    # List and not a set so the error message order is consistent
    VALID_CONDITIONS = [
        "equals",
        "notEquals",
        "lessOrEquals",
        "greaterOrEquals",
        "less",
        "greater",
    ]

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        if value not in self.VALID_CONDITIONS:
            raise InvalidFunctionArgument(
                "{} is not a valid condition, the only supported conditions are: {}".format(
                    value,
                    ",".join(self.VALID_CONDITIONS),
                )
            )

        return value


class NullColumn(FunctionArg):
    """
    Convert the provided column to null so that we
    can drop it. Used to make count() not have a
    required argument that we ignore.
    """

    def __init__(self, name: str):
        super().__init__(name)
        self.has_default = True

    def get_default(self, _) -> None:
        return None

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> None:
        return None


class NumberRange(FunctionArg):
    def __init__(self, name: str, start: Optional[float], end: Optional[float]):
        super().__init__(name)
        self.start = start
        self.end = end

    def normalize(
        self, value: str, params: ParamsType, combinator: Optional[Combinator]
    ) -> Optional[float]:
        try:
            normalized_value = float(value)
        except ValueError:
            raise InvalidFunctionArgument(f"{value} is not a number")

        if self.start and normalized_value < self.start:
            raise InvalidFunctionArgument(
                f"{normalized_value:g} must be greater than or equal to {self.start:g}"
            )
        elif self.end and normalized_value >= self.end:
            raise InvalidFunctionArgument(f"{normalized_value:g} must be less than {self.end:g}")
        return normalized_value


class NullableNumberRange(NumberRange):
    def __init__(self, name: str, start: Optional[float], end: Optional[float]):
        super().__init__(name, start, end)
        self.has_default = True

    def get_default(self, _) -> None:
        return None

    def normalize(
        self, value: str, params: ParamsType, combinator: Optional[Combinator]
    ) -> Optional[float]:
        if value is None:
            return value
        return super().normalize(value, params, combinator)


class IntervalDefault(NumberRange):
    def __init__(self, name: str, start: Optional[float], end: Optional[float]):
        super().__init__(name, start, end)
        self.has_default = True

    def get_default(self, params: ParamsType) -> int:
        if not params or not params.get("start") or not params.get("end"):
            raise InvalidFunctionArgument("function called without default")
        elif not isinstance(params.get("start"), datetime) or not isinstance(
            params.get("end"), datetime
        ):
            raise InvalidFunctionArgument("function called with invalid default")

        interval = (params["end"] - params["start"]).total_seconds()
        return int(interval)


class ColumnArg(FunctionArg):
    """Parent class to any function argument that should eventually resolve to a
    column
    """

    def __init__(
        self,
        name: str,
        allowed_columns: Optional[Sequence[str]] = None,
        validate_only: Optional[bool] = True,
    ):
        """
        :param name: The name of the function, this refers to the name to invoke.
        :param allowed_columns: Optional list of columns to allowlist, an empty sequence
        or None means allow all columns
        :param validate_only: Run normalize, and raise any errors involved but don't change
        the value in any way and return it as-is
        """
        super().__init__(name)
        # make sure to map the allowed columns to their snuba names
        self.allowed_columns = (
            {SEARCH_MAP.get(col) for col in allowed_columns} if allowed_columns else set()
        )
        # Normalize the value to check if it is valid, but return the value as-is
        self.validate_only = validate_only

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        snuba_column = SEARCH_MAP.get(value)
        if len(self.allowed_columns) > 0:
            if (
                value in self.allowed_columns or snuba_column in self.allowed_columns
            ) and snuba_column is not None:
                if self.validate_only:
                    return value
                else:
                    return snuba_column
            else:
                raise InvalidFunctionArgument(f"{value} is not an allowed column")
        if not snuba_column:
            raise InvalidFunctionArgument(f"{value} is not a valid column")

        if self.validate_only:
            return value
        else:
            return snuba_column


class ColumnTagArg(ColumnArg):
    """Validate that the argument is either a column or a valid tag"""

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        if TAG_KEY_RE.match(value) or VALID_FIELD_PATTERN.match(value):
            return value
        return super().normalize(value, params, combinator)


class CountColumn(ColumnArg):
    def __init__(self, name: str, **kwargs):
        super().__init__(name, **kwargs)
        self.has_default = True

    def get_default(self, _) -> None:
        return None

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
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

    def get_type(self, value: str) -> str:
        if is_duration_measurement(value) or is_span_op_breakdown(value):
            return "duration"
        elif value == "transaction.duration":
            return "duration"
        elif value == "timestamp":
            return "date"
        return "string"


class NumericColumn(ColumnArg):
    measurement_aliases = {
        MEASUREMENTS_FRAMES_SLOW_RATE,
        MEASUREMENTS_FRAMES_FROZEN_RATE,
        MEASUREMENTS_STALL_PERCENTAGE,
    }

    numeric_array_columns = {
        "measurements_value",
        "span_op_breakdowns_value",
        "spans_exclusive_time",
    }

    def __init__(self, name: str, allow_array_value: Optional[bool] = False, **kwargs):
        super().__init__(name, **kwargs)
        self.allow_array_value = allow_array_value

    def _normalize(self, value: str) -> str:
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

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        snuba_column = None

        if combinator is not None and combinator.validate_argument(value):
            snuba_column = value

        # `measurement_value` and `span_op_breakdowns_value` are actually an
        # array of Float64s. But when used in this context, we always want to
        # expand it using `arrayJoin`. The resulting column will be a numeric
        # column of type Float64.
        if self.allow_array_value:
            if value in self.numeric_array_columns:
                snuba_column = value

        if snuba_column is None:
            snuba_column = self._normalize(value)

        if self.validate_only:
            return value
        else:
            return snuba_column

    def get_type(self, value: str) -> str:
        if isinstance(value, str) and value in self.numeric_array_columns:
            return "number"

        # `measurements.frames_frozen_rate` and `measurements.frames_slow_rate` are aliases
        # to a percentage value, since they are expressions rather than columns, we special
        # case them here
        # TODO: These are no longer expressions with SnQL, this should be removed once the
        # migration is done
        if isinstance(value, list):
            for name in self.measurement_aliases:
                field = FIELD_ALIASES[name]
                expression = field.get_expression(None)
                if expression == value:
                    return field.result_type

        if value in self.measurement_aliases:
            return "percentage"
        snuba_column = self._normalize(value)
        if is_duration_measurement(snuba_column) or is_span_op_breakdown(snuba_column):
            return "duration"
        elif snuba_column == "duration":
            return "duration"
        elif snuba_column == "timestamp":
            return "date"
        return "number"


class DurationColumn(ColumnArg):
    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        snuba_column = SEARCH_MAP.get(value)
        if not snuba_column and is_duration_measurement(value):
            return value
        if not snuba_column and is_span_op_breakdown(value):
            return value
        if not snuba_column:
            raise InvalidFunctionArgument(f"{value} is not a valid column")
        elif snuba_column != "duration":
            raise InvalidFunctionArgument(f"{value} is not a duration column")

        if self.validate_only:
            return value
        else:
            return snuba_column


class StringArrayColumn(ColumnArg):
    string_array_columns = {
        "tags.key",
        "tags.value",
        "measurements_key",
        "span_op_breakdowns_key",
        "spans_op",
        "spans_group",
    }

    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        if value in self.string_array_columns:
            return value
        raise InvalidFunctionArgument(f"{value} is not a valid string array column")


class SessionColumnArg(ColumnArg):
    # XXX(ahmed): hack to get this to work with crash rate alerts over the sessions dataset until
    # we deprecate the logic that is tightly coupled with the events dataset. At which point,
    # we will just rely on dataset specific logic and refactor this class out
    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        if value in SESSIONS_SNUBA_MAP:
            return value
        raise InvalidFunctionArgument(f"{value} is not a valid sessions dataset column")


def with_default(default, argument):
    argument.has_default = True
    argument.get_default = lambda *_: default
    return argument


# TODO(snql-migration): Remove these Arg classes in favour for their
# non SnQL specific types
class SnQLStringArg(StringArg):
    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        value = super().normalize(value, params, combinator)
        # SnQL interprets string types as string, so strip the
        # quotes added in StringArg.normalize.
        return value[1:-1]


class SnQLDateArg(DateArg):
    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        value = super().normalize(value, params, combinator)
        # SnQL interprets string types as string, so strip the
        # quotes added in StringArg.normalize.
        return value[1:-1]


class SnQLFieldColumn(FieldColumn):
    def normalize(self, value: str, params: ParamsType, combinator: Optional[Combinator]) -> str:
        if value is None:
            raise InvalidFunctionArgument("a column is required")

        return value


class DiscoverFunction:
    def __init__(
        self,
        name,
        required_args=None,
        optional_args=None,
        calculated_args=None,
        column=None,
        aggregate=None,
        transform=None,
        conditional_transform=None,
        result_type_fn=None,
        default_result_type=None,
        redundant_grouping=False,
        combinators=None,
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
        :param ConditionalFunction conditional_transform: Tuple of the condition to be evaluated, the
            transform string if the condition is met and the transform string if the condition
            is not met.
        :param str result_type_fn: A function to call with in order to determine the result type.
            This function will be passed the list of argument classes and argument values. This should
            be tried first as the source of truth if available.
        :param str default_result_type: The default resulting type of this function. Must be a type
            defined by RESULTS_TYPES.
        :param bool redundant_grouping: This function will result in redundant grouping if its column
            is included as a field as well.
        :param list[Combinator] combinators: This is a list of combinators supported by this function.
        :param bool private: Whether or not this function should be disabled for general use.
        """

        self.name: str = name
        self.required_args = [] if required_args is None else required_args
        self.optional_args = [] if optional_args is None else optional_args
        self.calculated_args = [] if calculated_args is None else calculated_args
        self.column = column
        self.aggregate = aggregate
        self.transform = transform
        self.conditional_transform = conditional_transform
        self.result_type_fn = result_type_fn
        self.default_result_type = default_result_type
        self.redundant_grouping = redundant_grouping
        self.combinators = combinators
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

    def add_default_arguments(
        self, field: str, columns: List[str], params: ParamsType
    ) -> List[str]:
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

    def format_as_arguments(
        self,
        field: str,
        columns: List[str],
        params: ParamsType,
        combinator: Optional[Combinator] = None,
    ) -> Mapping[str, NormalizedArg]:
        columns = self.add_default_arguments(field, columns, params)

        arguments = {}

        # normalize the arguments before putting them in a dict
        for argument, column in zip(self.args, columns):
            try:
                normalized_value = argument.normalize(column, params, combinator)
                if not isinstance(self, SnQLFunction) and isinstance(argument, NumericColumn):
                    if normalized_value in argument.measurement_aliases:
                        field = FIELD_ALIASES[normalized_value]
                        normalized_value = field.get_expression(params)
                    elif normalized_value in NumericColumn.numeric_array_columns:
                        normalized_value = ["arrayJoin", [normalized_value]]
                arguments[argument.name] = normalized_value
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
            sum(
                [
                    self.column is not None,
                    self.aggregate is not None,
                    self.transform is not None,
                    self.conditional_transform is not None,
                ]
            )
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

    def validate_argument_count(self, field: str, arguments: List[str]) -> None:
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

    def is_accessible(
        self,
        acl: Optional[List[str]] = None,
        combinator: Optional[Combinator] = None,
    ) -> bool:
        name = self.name
        is_combinator_private = False

        if combinator is not None:
            is_combinator_private = combinator.private
            name = f"{name}{combinator.kind}"

        # a function is only public if both the function
        # and the specified combinator is public
        if not is_combinator_private and not self.private:
            return True

        if not acl:
            return False

        return name in acl

    def find_combinator(self, kind: Optional[str]) -> Optional[Combinator]:
        if kind is None or self.combinators is None:
            return None

        for combinator in self.combinators:
            if combinator.kind == kind:
                return combinator

        return None


# When updating this list, also check if the following need to be updated:
# - convert_search_filter_to_snuba_query
# - static/app/utils/discover/fields.tsx FIELDS (for discover column list and search box autocomplete)
FUNCTIONS = {
    function.name: function
    for function in [
        DiscoverFunction(
            "percentile",
            required_args=[NumericColumn("column"), NumberRange("percentile", 0, 1)],
            aggregate=["quantile({percentile:g})", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "p50",
            optional_args=[with_default("transaction.duration", NumericColumn("column"))],
            aggregate=["quantile(0.5)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "p75",
            optional_args=[with_default("transaction.duration", NumericColumn("column"))],
            aggregate=["quantile(0.75)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "p95",
            optional_args=[with_default("transaction.duration", NumericColumn("column"))],
            aggregate=["quantile(0.95)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "p99",
            optional_args=[with_default("transaction.duration", NumericColumn("column"))],
            aggregate=["quantile(0.99)", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "p100",
            optional_args=[with_default("transaction.duration", NumericColumn("column"))],
            aggregate=["max", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "eps",
            optional_args=[IntervalDefault("interval", 1, None)],
            transform="divide(count(), {interval:g})",
            default_result_type="number",
        ),
        DiscoverFunction(
            "epm",
            optional_args=[IntervalDefault("interval", 1, None)],
            transform="divide(count(), divide({interval:g}, 60))",
            default_result_type="number",
        ),
        DiscoverFunction(
            "last_seen",
            aggregate=["max", "timestamp", "last_seen"],
            default_result_type="date",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "latest_event",
            aggregate=["argMax", ["id", "timestamp"], "latest_event"],
            default_result_type="string",
        ),
        DiscoverFunction(
            "apdex",
            optional_args=[NullableNumberRange("satisfaction", 0, None)],
            conditional_transform=ConditionalFunction(
                ArgValue("satisfaction"),
                "apdex(duration, {satisfaction:g})",
                """
                apdex(
                    multiIf(
                        equals(
                            tupleElement(project_threshold_config, 1),
                            'lcp'
                        ),
                        if(
                            has(measurements.key, 'lcp'),
                            arrayElement(measurements.value, indexOf(measurements.key, 'lcp')),
                            NULL
                        ),
                        duration
                    ),
                    tupleElement(project_threshold_config, 2)
                )
            """.replace(
                    "\n", ""
                ).replace(
                    " ", ""
                ),
            ),
            default_result_type="number",
        ),
        DiscoverFunction(
            "count_miserable",
            required_args=[CountColumn("column")],
            optional_args=[NullableNumberRange("satisfaction", 0, None)],
            calculated_args=[
                {
                    "name": "tolerated",
                    "fn": lambda args: args["satisfaction"] * 4.0
                    if args["satisfaction"] is not None
                    else None,
                }
            ],
            conditional_transform=ConditionalFunction(
                ArgValue("satisfaction"),
                "uniqIf(user, greater(duration, {tolerated:g}))",
                """
                uniqIf(user, greater(
                    multiIf(
                        equals(tupleElement(project_threshold_config, 1), 'lcp'),
                        if(has(measurements.key, 'lcp'), arrayElement(measurements.value, indexOf(measurements.key, 'lcp')), NULL),
                        duration
                    ),
                    multiply(tupleElement(project_threshold_config, 2), 4)
                ))
                """.replace(
                    "\n", ""
                ).replace(
                    " ", ""
                ),
            ),
            default_result_type="integer",
        ),
        DiscoverFunction(
            "user_misery",
            # To correct for sensitivity to low counts, User Misery is modeled as a Beta Distribution Function.
            # With prior expectations, we have picked the expected mean user misery to be 0.05 and variance
            # to be 0.0004. This allows us to calculate the alpha (5.8875) and beta (111.8625) parameters,
            # with the user misery being adjusted for each fast/slow unique transaction. See:
            # https://stats.stackexchange.com/questions/47771/what-is-the-intuition-behind-beta-distribution
            # for an intuitive explanation of the Beta Distribution Function.
            optional_args=[
                NullableNumberRange("satisfaction", 0, None),
                with_default(5.8875, NumberRange("alpha", 0, None)),
                with_default(111.8625, NumberRange("beta", 0, None)),
            ],
            calculated_args=[
                {
                    "name": "tolerated",
                    "fn": lambda args: args["satisfaction"] * 4.0
                    if args["satisfaction"] is not None
                    else None,
                },
                {"name": "parameter_sum", "fn": lambda args: args["alpha"] + args["beta"]},
            ],
            conditional_transform=ConditionalFunction(
                ArgValue("satisfaction"),
                "ifNull(divide(plus(uniqIf(user, greater(duration, {tolerated:g})), {alpha}), plus(uniq(user), {parameter_sum})), 0)",
                """
                ifNull(
                    divide(
                        plus(
                            uniqIf(user, greater(
                                multiIf(
                                    equals(tupleElement(project_threshold_config, 1), 'lcp'),
                                    if(has(measurements.key, 'lcp'), arrayElement(measurements.value, indexOf(measurements.key, 'lcp')), NULL),
                                    duration
                                ),
                                multiply(tupleElement(project_threshold_config, 2), 4)
                            )),
                            {alpha}
                        ),
                        plus(uniq(user), {parameter_sum})
                    ),
                0)
            """.replace(
                    " ", ""
                ).replace(
                    "\n", ""
                ),
            ),
            default_result_type="number",
        ),
        DiscoverFunction(
            "failure_rate", transform="failure_rate()", default_result_type="percentage"
        ),
        DiscoverFunction(
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
                                    "transaction.status",
                                ],
                            ],
                        ],
                    ],
                ],
                None,
            ],
            default_result_type="integer",
        ),
        DiscoverFunction(
            "array_join",
            required_args=[StringArrayColumn("column")],
            column=["arrayJoin", [ArgValue("column")], None],
            default_result_type="string",
            private=True,
        ),
        DiscoverFunction(
            "histogram",
            required_args=[
                NumericColumn("column", allow_array_value=True),
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
        DiscoverFunction(
            "count_unique",
            optional_args=[CountColumn("column")],
            aggregate=["uniq", ArgValue("column"), None],
            default_result_type="integer",
        ),
        DiscoverFunction(
            "count",
            optional_args=[NullColumn("column")],
            aggregate=["count", None, None],
            default_result_type="integer",
        ),
        DiscoverFunction(
            "count_at_least",
            required_args=[NumericColumn("column"), NumberRange("threshold", 0, None)],
            aggregate=[
                "countIf",
                [["greaterOrEquals", [ArgValue("column"), ArgValue("threshold")]]],
                None,
            ],
            default_result_type="integer",
        ),
        DiscoverFunction(
            "min",
            required_args=[NumericColumn("column")],
            aggregate=["min", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "max",
            required_args=[NumericColumn("column")],
            aggregate=["max", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "avg",
            required_args=[NumericColumn("column")],
            aggregate=["avg", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "var",
            required_args=[NumericColumn("column")],
            aggregate=["varSamp", ArgValue("column"), None],
            default_result_type="number",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "stddev",
            required_args=[NumericColumn("column")],
            aggregate=["stddevSamp", ArgValue("column"), None],
            default_result_type="number",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "cov",
            required_args=[NumericColumn("column1"), NumericColumn("column2")],
            aggregate=["covarSamp", [ArgValue("column1"), ArgValue("column2")], None],
            default_result_type="number",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "corr",
            required_args=[NumericColumn("column1"), NumericColumn("column2")],
            aggregate=["corr", [ArgValue("column1"), ArgValue("column2")], None],
            default_result_type="number",
            redundant_grouping=True,
        ),
        DiscoverFunction(
            "sum",
            required_args=[NumericColumn("column")],
            aggregate=["sum", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            default_result_type="duration",
        ),
        DiscoverFunction(
            "any",
            required_args=[FieldColumn("column")],
            aggregate=["min", ArgValue("column"), None],
            result_type_fn=reflective_result_type(),
            redundant_grouping=True,
        ),
        # These range functions for performance trends, these aren't If functions
        # to avoid allowing arbitrary if statements
        # Not yet supported in Discover, and shouldn't be added to fields.tsx
        DiscoverFunction(
            "percentile_range",
            required_args=[
                NumericColumn("column"),
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
        DiscoverFunction(
            "avg_range",
            required_args=[
                NumericColumn("column"),
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
        DiscoverFunction(
            "variance_range",
            required_args=[
                NumericColumn("column"),
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
        DiscoverFunction(
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
        DiscoverFunction(
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
        DiscoverFunction(
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
        DiscoverFunction(
            "minus",
            required_args=[FunctionArg("minuend"), FunctionArg("subtrahend")],
            aggregate=["minus", [ArgValue("minuend"), ArgValue("subtrahend")], None],
            default_result_type="duration",
        ),
        DiscoverFunction(
            "absolute_correlation",
            aggregate=[
                "abs",
                [["corr", [["toUnixTimestamp", ["timestamp"]], "transaction.duration"]]],
                None,
            ],
            default_result_type="number",
        ),
        # The calculated arg will cast the string value according to the value in the column
        DiscoverFunction(
            "count_if",
            required_args=[
                # This is a FunctionArg cause the column can be a tag as well
                FunctionArg("column"),
                ConditionArg("condition"),
                StringArg("value", unquote=True, unescape_quotes=True, optional_unquote=True),
            ],
            calculated_args=[
                {
                    "name": "typed_value",
                    "fn": normalize_count_if_value,
                }
            ],
            aggregate=[
                "countIf",
                [
                    [
                        ArgValue("condition"),
                        [
                            ArgValue("column"),
                            ArgValue("typed_value"),
                        ],
                    ]
                ],
                None,
            ],
            default_result_type="integer",
        ),
        DiscoverFunction(
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
        DiscoverFunction(
            "to_other",
            required_args=[
                ColumnArg("column", allowed_columns=["release", "trace.parent_span"]),
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
        DiscoverFunction(
            "identity",
            required_args=[SessionColumnArg("column")],
            aggregate=["identity", ArgValue("column"), None],
            private=True,
        ),
    ]
}

for alias, name in FUNCTION_ALIASES.items():
    FUNCTIONS[alias] = FUNCTIONS[name].alias_as(alias)


FUNCTION_ALIAS_PATTERN = re.compile(r"^({}).*".format("|".join(list(FUNCTIONS.keys()))))


def normalize_percentile_alias(args: Mapping[str, str]) -> str:
    # The compare_numeric_aggregate SnQL function accepts a percentile
    # alias which is resolved to the percentile function call here
    # to maintain backward compatibility with the legacy compare_numeric_aggregate
    # function signature. This function only accepts percentile
    # aliases.
    aggregate_alias = args["aggregate_alias"]
    match = re.match(r"(p\d{2,3})_?(\w+)?", aggregate_alias)

    if not match:
        raise InvalidFunctionArgument("Aggregate alias must be a percentile function.")

    # Translating an arg of the pattern `measurements_lcp`
    # to `measurements.lcp`.
    if match.group(2):
        aggregate_arg = ".".join(match.group(2).split("_"))
    # We default percentiles without an arg to duration
    else:
        aggregate_arg = "transaction.duration"

    return f"{match.group(1)}({aggregate_arg})"


class SnQLFunction(DiscoverFunction):
    def __init__(self, *args, **kwargs) -> None:
        self.snql_aggregate = kwargs.pop("snql_aggregate", None)
        self.snql_column = kwargs.pop("snql_column", None)
        super().__init__(*args, **kwargs)

    def validate(self) -> None:
        # assert that all optional args have defaults available
        for i, arg in enumerate(self.optional_args):
            assert (
                arg.has_default
            ), f"{self.name}: optional argument at index {i} does not have default"

        assert sum([self.snql_aggregate is not None, self.snql_column is not None]) == 1

        # assert that no duplicate argument names are used
        names = set()
        for arg in self.args:
            assert (
                arg.name not in names
            ), f"{self.name}: argument {arg.name} specified more than once"
            names.add(arg.name)

        self.validate_result_type(self.default_result_type)


class MetricsFunction(SnQLFunction):
    """Metrics needs to differentiate between aggregate types so we can send queries to the right table"""

    def __init__(self, *args, **kwargs) -> None:
        self.snql_distribution = kwargs.pop("snql_distribution", None)
        self.snql_set = kwargs.pop("snql_set", None)
        self.snql_counter = kwargs.pop("snql_counter", None)
        super().__init__(*args, **kwargs)

    def validate(self) -> None:
        # assert that all optional args have defaults available
        for i, arg in enumerate(self.optional_args):
            assert (
                arg.has_default
            ), f"{self.name}: optional argument at index {i} does not have default"

        assert (
            sum(
                [
                    self.snql_distribution is not None,
                    self.snql_set is not None,
                    self.snql_counter is not None,
                    self.snql_column is not None,
                ]
            )
            == 1
        )

        # assert that no duplicate argument names are used
        names = set()
        for arg in self.args:
            assert (
                arg.name not in names
            ), f"{self.name}: argument {arg.name} specified more than once"
            names.add(arg.name)

        self.validate_result_type(self.default_result_type)


class FunctionDetails(NamedTuple):
    field: str
    instance: SnQLFunction
    arguments: Mapping[str, NormalizedArg]

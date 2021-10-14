import re
from collections import defaultdict, namedtuple
from copy import deepcopy
from datetime import datetime
from typing import Any, Callable, Dict, List, Mapping, Match, Optional, Sequence, Set, Tuple, Union

import sentry_sdk
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy

from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project, ProjectTeam, ProjectTransactionThreshold
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThresholdOverride,
)
from sentry.search.events.base import QueryBase
from sentry.search.events.constants import (
    ALIAS_PATTERN,
    ARRAY_FIELDS,
    DEFAULT_PROJECT_THRESHOLD,
    DEFAULT_PROJECT_THRESHOLD_METRIC,
    DURATION_PATTERN,
    ERROR_UNHANDLED_ALIAS,
    FUNCTION_ALIASES,
    FUNCTION_PATTERN,
    ISSUE_ALIAS,
    ISSUE_ID_ALIAS,
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
    TIMESTAMP_TO_DAY_ALIAS,
    TIMESTAMP_TO_HOUR_ALIAS,
    USER_DISPLAY_ALIAS,
    VALID_FIELD_PATTERN,
)
from sentry.search.events.types import NormalizedArg, ParamsType, SelectType
from sentry.search.utils import InvalidQuery, parse_duration
from sentry.utils.compat import zip
from sentry.utils.numbers import format_grouped_length
from sentry.utils.snuba import (
    SESSIONS_SNUBA_MAP,
    Dataset,
    get_json_type,
    is_duration_measurement,
    is_measurement,
    is_span_op_breakdown,
)

MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS = 500
MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 500

ConditionalFunction = namedtuple("ConditionalFunction", "condition match fallback")
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
            expression=["coalesce", ["user.email", "user.username", "user.ip"]],
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
        if isinstance(value, list):
            for name in self.measurement_aliases:
                field = FIELD_ALIASES[name]
                expression = field.get_expression(None)
                if expression == value:
                    return field.result_type

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

        self.name = name
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
            default_result_type="number",
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
        # Currently only being used by the baseline PoC
        DiscoverFunction(
            "absolute_delta",
            required_args=[DurationColumn("column"), NumberRange("target", 0, None)],
            column=["abs", [["minus", [ArgValue("column"), ArgValue("target")]]], None],
            default_result_type="duration",
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
    match = re.match(r"(p\d{2,3})_(\w+)", aggregate_alias)

    if not match:
        raise InvalidFunctionArgument("Aggregate alias must be a percentile function.")

    # Translating an arg of the pattern `measurements_lcp`
    # to `measurements.lcp`.
    aggregate_arg = ".".join(match.group(2).split("_"))

    return f"{match.group(1)}({aggregate_arg})"


class SnQLFunction(DiscoverFunction):
    def __init__(self, *args, **kwargs):
        self.snql_aggregate = kwargs.pop("snql_aggregate", None)
        self.snql_column = kwargs.pop("snql_column", None)
        super().__init__(*args, **kwargs)

    def validate(self):
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


class QueryFields(QueryBase):
    """Field logic for a snql query"""

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        auto_fields: bool = False,
        functions_acl: Optional[List[str]] = None,
    ):
        super().__init__(dataset, params, auto_fields, functions_acl)

        self.function_alias_map: Dict[str, FunctionDetails] = {}
        self.field_alias_converter: Mapping[str, Callable[[str], SelectType]] = {
            # NOTE: `ISSUE_ALIAS` simply maps to the id, meaning that post processing
            # is required to insert the true issue short id into the response.
            ISSUE_ALIAS: self._resolve_issue_id_alias,
            ISSUE_ID_ALIAS: self._resolve_issue_id_alias,
            PROJECT_ALIAS: self._resolve_project_slug_alias,
            PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
            TIMESTAMP_TO_HOUR_ALIAS: self._resolve_timestamp_to_hour_alias,
            TIMESTAMP_TO_DAY_ALIAS: self._resolve_timestamp_to_day_alias,
            USER_DISPLAY_ALIAS: self._resolve_user_display_alias,
            PROJECT_THRESHOLD_CONFIG_ALIAS: self._resolve_project_threshold_config,
            ERROR_UNHANDLED_ALIAS: self._resolve_error_unhandled_alias,
            TEAM_KEY_TRANSACTION_ALIAS: self._resolve_team_key_transaction_alias,
            MEASUREMENTS_FRAMES_SLOW_RATE: self._resolve_measurements_frames_slow_rate,
            MEASUREMENTS_FRAMES_FROZEN_RATE: self._resolve_measurements_frames_frozen_rate,
            MEASUREMENTS_STALL_PERCENTAGE: self._resolve_measurements_stall_percentage,
        }

        self.function_converter: Mapping[str, SnQLFunction] = {
            function.name: function
            for function in [
                SnQLFunction(
                    "failure_count",
                    snql_aggregate=lambda _, alias: Function(
                        "countIf",
                        [
                            Function(
                                "notIn",
                                [
                                    self.column("transaction.status"),
                                    (
                                        SPAN_STATUS_NAME_TO_CODE["ok"],
                                        SPAN_STATUS_NAME_TO_CODE["cancelled"],
                                        SPAN_STATUS_NAME_TO_CODE["unknown"],
                                    ),
                                ],
                            )
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "apdex",
                    optional_args=[NullableNumberRange("satisfaction", 0, None)],
                    snql_aggregate=self._resolve_apdex_function,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "count_miserable",
                    required_args=[ColumnTagArg("column")],
                    optional_args=[NullableNumberRange("satisfaction", 0, None)],
                    calculated_args=[
                        {
                            "name": "tolerated",
                            "fn": lambda args: args["satisfaction"] * 4.0
                            if args["satisfaction"] is not None
                            else None,
                        }
                    ],
                    snql_aggregate=self._resolve_count_miserable_function,
                    default_result_type="integer",
                ),
                SnQLFunction(
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
                    snql_aggregate=self._resolve_user_misery_function,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "count",
                    optional_args=[NullColumn("column")],
                    snql_aggregate=lambda _, alias: Function(
                        "count",
                        [],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "last_seen",
                    snql_aggregate=lambda _, alias: Function(
                        "max",
                        [self.column("timestamp")],
                        alias,
                    ),
                    default_result_type="date",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "latest_event",
                    snql_aggregate=lambda _, alias: Function(
                        "argMax",
                        [self.column("id"), self.column("timestamp")],
                        alias,
                    ),
                    default_result_type="string",
                ),
                SnQLFunction(
                    "failure_rate",
                    snql_aggregate=lambda _, alias: Function(
                        "failure_rate",
                        [],
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                SnQLFunction(
                    "percentile",
                    required_args=[
                        NumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                    ],
                    snql_aggregate=self._resolve_percentile,
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p50",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.5),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p75",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.75),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p95",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.95),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p99",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.99),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p100",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 1),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "to_other",
                    required_args=[
                        ColumnArg("column", allowed_columns=["release", "trace.parent_span"]),
                        SnQLStringArg("value", unquote=True, unescape_quotes=True),
                    ],
                    optional_args=[
                        with_default("that", SnQLStringArg("that")),
                        with_default("this", SnQLStringArg("this")),
                    ],
                    snql_column=lambda args, alias: Function(
                        "if",
                        [
                            Function("equals", [args["column"], args["value"]]),
                            args["this"],
                            args["that"],
                        ],
                        alias,
                    ),
                ),
                SnQLFunction(
                    "percentile_range",
                    required_args=[
                        NumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                        ConditionArg("condition"),
                        SnQLDateArg("middle"),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        f"quantileIf({args['percentile']:.2f})",
                        [
                            args["column"],
                            # This condition is written in this seemingly backwards way because of limitations
                            # in the json query syntax.
                            # TODO(snql-migration): Once the trends endpoint is using snql, we should update it
                            # and flip these conditions back
                            Function(args["condition"], [args["middle"], self.column("timestamp")]),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "avg_range",
                    required_args=[
                        NumericColumn("column"),
                        ConditionArg("condition"),
                        SnQLDateArg("middle"),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "avgIf",
                        [
                            args["column"],
                            # see `percentile_range` for why this condition feels backwards
                            Function(
                                args["condition"],
                                [args["middle"], self.column("timestamp")],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "variance_range",
                    required_args=[
                        NumericColumn("column"),
                        ConditionArg("condition"),
                        SnQLDateArg("middle"),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "varSampIf",
                        [
                            args["column"],
                            # see `percentile_range` for why this condition feels backwards
                            Function(
                                args["condition"],
                                [args["middle"], self.column("timestamp")],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "count_range",
                    required_args=[ConditionArg("condition"), SnQLDateArg("middle")],
                    snql_aggregate=lambda args, alias: Function(
                        "countIf",
                        [
                            # see `percentile_range` for why this condition feels backwards
                            Function(
                                args["condition"],
                                [args["middle"], self.column("timestamp")],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_if",
                    required_args=[
                        ColumnTagArg("column"),
                        ConditionArg("condition"),
                        SnQLStringArg(
                            "value", unquote=True, unescape_quotes=True, optional_unquote=True
                        ),
                    ],
                    calculated_args=[
                        {
                            "name": "typed_value",
                            "fn": normalize_count_if_value,
                        }
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "countIf",
                        [
                            Function(
                                args["condition"],
                                [
                                    args["column"],
                                    args["typed_value"],
                                ],
                            )
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_unique",
                    required_args=[ColumnTagArg("column")],
                    snql_aggregate=lambda args, alias: Function("uniq", [args["column"]], alias),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_at_least",
                    required_args=[NumericColumn("column"), NumberRange("threshold", 0, None)],
                    snql_aggregate=lambda args, alias: Function(
                        "countIf",
                        [Function("greaterOrEquals", [args["column"], args["threshold"]])],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "min",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "max",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("max", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "avg",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("max", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "var",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("varSamp", [args["column"]], alias),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "stddev",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function(
                        "stddevSamp", [args["column"]], alias
                    ),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "cov",
                    required_args=[NumericColumn("column1"), NumericColumn("column2")],
                    snql_aggregate=lambda args, alias: Function(
                        "covarSamp", [args["column1"], args["column2"]], alias
                    ),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "corr",
                    required_args=[NumericColumn("column1"), NumericColumn("column2")],
                    snql_aggregate=lambda args, alias: Function(
                        "corr", [args["column1"], args["column2"]], alias
                    ),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "sum",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("sum", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    combinators=[
                        SnQLArrayCombinator("column", NumericColumn.numeric_array_columns)
                    ],
                ),
                SnQLFunction(
                    "any",
                    required_args=[FieldColumn("column")],
                    # Not actually using `any` so that this function returns consistent results
                    snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "absolute_delta",
                    required_args=[DurationColumn("column"), NumberRange("target", 0, None)],
                    snql_column=lambda args, alias: Function(
                        "abs", [Function("minus", [args["column"], args["target"]])], alias
                    ),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "eps",
                    snql_aggregate=lambda args, alias: Function(
                        "divide", [Function("count", []), args["interval"]], alias
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
                SnQLFunction(
                    "epm",
                    snql_aggregate=lambda args, alias: Function(
                        "divide",
                        [Function("count", []), Function("divide", [args["interval"], 60])],
                        alias,
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
                SnQLFunction(
                    "compare_numeric_aggregate",
                    required_args=[
                        FunctionAliasArg("aggregate_alias"),
                        ConditionArg("condition"),
                        NumberRange("value", 0, None),
                    ],
                    calculated_args=[
                        {
                            "name": "aggregate_function",
                            "fn": normalize_percentile_alias,
                        }
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        args["condition"],
                        [self.resolve_function(args["aggregate_function"]), args["value"]],
                        alias,
                    ),
                    default_result_type="number",
                ),
                SnQLFunction(
                    "array_join",
                    required_args=[StringArrayColumn("column")],
                    snql_column=lambda args, alias: Function("arrayJoin", [args["column"]], alias),
                    default_result_type="string",
                    private=True,
                ),
                # TODO: implement these
                SnQLFunction("histogram", snql_aggregate=self._resolve_unimplemented_function),
                SnQLFunction("percentage", snql_aggregate=self._resolve_unimplemented_function),
                SnQLFunction("t_test", snql_aggregate=self._resolve_unimplemented_function),
                SnQLFunction("minus", snql_aggregate=self._resolve_unimplemented_function),
                SnQLFunction("absolute_delta", snql_aggregate=self._resolve_unimplemented_function),
            ]
        }

        for alias, name in FUNCTION_ALIASES.items():
            self.function_converter[alias] = self.function_converter[name].alias_as(alias)

    def resolve_select(self, selected_columns: Optional[List[str]]) -> List[SelectType]:
        """Given a public list of discover fields, construct the corresponding
        list of Snql Columns or Functions. Duplicate columns are ignored
        """
        if selected_columns is None:
            return []

        resolved_columns = []
        stripped_columns = [column.strip() for column in selected_columns]

        # Add threshold config alias if there's a function that depends on it
        # TODO: this should be replaced with an explicit request for the project_threshold_config as a column
        for column in {
            "apdex()",
            "count_miserable(user)",
            "user_misery()",
        }:
            if (
                column in stripped_columns
                and PROJECT_THRESHOLD_CONFIG_ALIAS not in stripped_columns
            ):
                stripped_columns.append(PROJECT_THRESHOLD_CONFIG_ALIAS)
                break

        for column in stripped_columns:
            if column == "":
                continue
            # need to make sure the column is resolved with the appropriate alias
            # because the resolved snuba name may be different
            resolved_column = self.resolve_column(column, alias=True)
            if resolved_column not in self.columns:
                resolved_columns.append(resolved_column)

        # Happens after resolving columns to check if there any aggregates
        if self.auto_fields and not self.aggregates:
            # Ensure fields we require to build a functioning interface
            # are present.
            if "id" not in stripped_columns:
                resolved_columns.append(self.resolve_column("id", alias=True))
            if "project.id" not in stripped_columns:
                resolved_columns.append(self.resolve_column("project.id", alias=True))

        return resolved_columns

    def resolve_column(self, field: str, alias: bool = False) -> SelectType:
        """Given a public field, construct the corresponding Snql, this
        function will determine the type of the field alias, whether its a
        column, field alias or function and call the corresponding resolver

        :param field: The public field string to resolve into Snql. This may
                      be a column, field alias, or even a function.
        :param alias: Whether or not the resolved column is aliased to the
                      original name. If false, it may still have an alias
                      but is not guaranteed.
        """
        match = is_function(field)
        if match:
            return self.resolve_function(field, match)
        elif self.is_field_alias(field):
            return self.resolve_field_alias(field)
        else:
            return self.resolve_field(field, alias=alias)

    def resolve_field(self, raw_field: str, alias: bool = False) -> Column:
        """Given a public field, resolve the alias based on the Query's
        dataset and return the Snql Column
        """
        tag_match = TAG_KEY_RE.search(raw_field)
        field = tag_match.group("tag") if tag_match else raw_field

        if VALID_FIELD_PATTERN.match(field):
            return self.aliased_column(field, raw_field) if alias else self.column(field)
        else:
            raise InvalidSearchQuery(f"Invalid characters in field {field}")

    def resolve_orderby(self, orderby: Optional[Union[List[str], str]]) -> List[OrderBy]:
        """Given a list of public aliases, optionally prefixed by a `-` to
        represent direction, construct a list of Snql Orderbys
        """
        validated: List[OrderBy] = []

        if orderby is None:
            return validated

        if isinstance(orderby, str):
            if not orderby:
                return validated

            orderby = [orderby]

        orderby_columns: List[str] = orderby if orderby else []

        for orderby in orderby_columns:
            bare_orderby = orderby.lstrip("-")
            try:
                resolved_orderby = self.resolve_column(bare_orderby)
            except NotImplementedError:
                resolved_orderby = None

            direction = Direction.DESC if orderby.startswith("-") else Direction.ASC

            if is_function(bare_orderby):
                bare_orderby = resolved_orderby.alias

            for selected_column in self.columns:
                if isinstance(selected_column, Column) and selected_column == resolved_orderby:
                    validated.append(OrderBy(selected_column, direction))
                    break

                elif (
                    isinstance(selected_column, AliasedExpression)
                    and selected_column.alias == bare_orderby
                ):
                    # We cannot directly order by an `AliasedExpression`.
                    # Instead, we order by the column inside.
                    validated.append(OrderBy(selected_column.exp, direction))
                    break

                elif (
                    isinstance(selected_column, Function) and selected_column.alias == bare_orderby
                ):
                    validated.append(OrderBy(selected_column, direction))
                    break

        if len(validated) == len(orderby_columns):
            return validated

        # TODO: This is no longer true, can order by fields that aren't selected, keeping
        # for now so we're consistent with the existing functionality
        raise InvalidSearchQuery("Cannot order by a field that is not selected.")

    def is_field_alias(self, field: str) -> bool:
        """Given a public field, check if it's a field alias"""
        return field in self.field_alias_converter

    def resolve_field_alias(self, alias: str) -> SelectType:
        """Given a field alias, convert it to its corresponding snql"""
        converter = self.field_alias_converter.get(alias)
        if not converter:
            raise NotImplementedError(f"{alias} not implemented in snql field parsing yet")
        return converter(alias)

    def is_function(self, function: str) -> bool:
        """ "Given a public field, check if it's a supported function"""
        return function in self.function_converter

    def resolve_function(self, function: str, match: Optional[Match[str]] = None) -> SelectType:
        """Given a public function, resolve to the corresponding Snql
        function
        """
        if match is None:
            match = is_function(function)

        if not match:
            raise InvalidSearchQuery(f"Invalid characters in field {function}")

        if function in self.params.get("aliases", {}):
            raise NotImplementedError("Aggregate aliases not implemented in snql field parsing yet")

        name, combinator_name, arguments, alias = self.parse_function(match)
        snql_function = self.function_converter[name]

        combinator = snql_function.find_combinator(combinator_name)

        if combinator_name is not None and combinator is None:
            raise InvalidSearchQuery(
                f"{snql_function.name}: no support for the -{combinator_name} combinator"
            )

        if not snql_function.is_accessible(self.functions_acl, combinator):
            raise InvalidSearchQuery(f"{snql_function.name}: no access to private function")

        combinator_applied = False

        arguments = snql_function.format_as_arguments(name, arguments, self.params, combinator)

        self.function_alias_map[alias] = FunctionDetails(function, snql_function, arguments.copy())

        for arg in snql_function.args:
            if isinstance(arg, ColumnArg):
                arguments[arg.name] = self.resolve_column(arguments[arg.name])
            if combinator is not None and combinator.is_applicable(arg.name):
                arguments[arg.name] = combinator.apply(arguments[arg.name])
                combinator_applied = True

        if combinator and not combinator_applied:
            raise InvalidSearchQuery("Invalid combinator: Arguments passed were incompatible")

        if snql_function.snql_aggregate is not None:
            self.aggregates.append(snql_function.snql_aggregate(arguments, alias))
            return snql_function.snql_aggregate(arguments, alias)

        return snql_function.snql_column(arguments, alias)

    def parse_function(self, match: Match[str]) -> Tuple[str, Optional[str], List[str], str]:
        """Given a FUNCTION_PATTERN match, seperate the function name, arguments
        and alias out
        """
        raw_function = match.group("function")
        function, combinator = parse_combinator(raw_function)

        if not self.is_function(function):
            raise InvalidSearchQuery(f"{function} is not a valid function")

        arguments = parse_arguments(function, match.group("columns"))
        alias = match.group("alias")

        if alias is None:
            alias = get_function_alias_with_columns(raw_function, arguments)

        return (function, combinator, arguments, alias)

    # Field Aliases
    def _resolve_issue_id_alias(self, _: str) -> SelectType:
        """The state of having no issues is represented differently on transactions vs
        other events. On the transactions table, it is represented by 0 whereas it is
        represented by NULL everywhere else. We use coalesce here so we can treat this
        consistently
        """
        return Function("coalesce", [self.column("issue.id"), 0], ISSUE_ID_ALIAS)

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        project_ids = {
            project_id
            for project_id in self.params.get("project_id", [])
            if isinstance(project_id, int)
        }

        # Try to reduce the size of the transform by using any existing conditions on projects
        if len(self.projects_to_filter) > 0:
            project_ids &= self.projects_to_filter

        projects = Project.objects.filter(id__in=project_ids).values("slug", "id")

        return Function(
            "transform",
            [
                self.column("project.id"),
                [project["id"] for project in projects],
                [project["slug"] for project in projects],
                "",
            ],
            alias,
        )

    def _resolve_timestamp_to_hour_alias(self, _: str) -> SelectType:
        return Function("toStartOfHour", [self.column("timestamp")], TIMESTAMP_TO_HOUR_ALIAS)

    def _resolve_timestamp_to_day_alias(self, _: str) -> SelectType:
        return Function("toStartOfDay", [self.column("timestamp")], TIMESTAMP_TO_DAY_ALIAS)

    def _resolve_user_display_alias(self, _: str) -> SelectType:
        columns = ["user.email", "user.username", "user.ip"]
        return Function("coalesce", [self.column(column) for column in columns], USER_DISPLAY_ALIAS)

    def _resolve_project_threshold_config(self, _: str) -> SelectType:
        org_id = self.params.get("organization_id")
        project_ids = self.params.get("project_id")

        project_threshold_configs = (
            ProjectTransactionThreshold.objects.filter(
                organization_id=org_id,
                project_id__in=project_ids,
            )
            .order_by("project_id")
            .values_list("project_id", "threshold", "metric")
        )

        transaction_threshold_configs = (
            ProjectTransactionThresholdOverride.objects.filter(
                organization_id=org_id,
                project_id__in=project_ids,
            )
            .order_by("project_id")
            .values_list("transaction", "project_id", "threshold", "metric")
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

        if (
            num_project_thresholds + num_transaction_thresholds
            > MAX_QUERYABLE_TRANSACTION_THRESHOLDS
        ):
            raise InvalidSearchQuery(
                f"Exceeded {MAX_QUERYABLE_TRANSACTION_THRESHOLDS} configured transaction thresholds limit, try with fewer Projects."
            )

        # Arrays need to have toUint64 casting because clickhouse will define the type as the narrowest possible type
        # that can store listed argument types, which means the comparison will fail because of mismatched types
        project_threshold_config_keys = []
        project_threshold_config_values = []
        for project_id, threshold, metric in project_threshold_configs:
            project_threshold_config_keys.append(Function("toUInt64", [project_id]))
            project_threshold_config_values.append((TRANSACTION_METRICS[metric], threshold))

        project_threshold_override_config_keys = []
        project_threshold_override_config_values = []
        for transaction, project_id, threshold, metric in transaction_threshold_configs:
            project_threshold_override_config_keys.append(
                (Function("toUInt64", [project_id]), transaction)
            )
            project_threshold_override_config_values.append(
                (TRANSACTION_METRICS[metric], threshold)
            )

        project_threshold_config_index: SelectType = Function(
            "indexOf",
            [
                project_threshold_config_keys,
                self.column("project_id"),
            ],
            PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
        )

        project_threshold_override_config_index: SelectType = Function(
            "indexOf",
            [
                project_threshold_override_config_keys,
                (self.column("project_id"), self.column("transaction")),
            ],
            PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
        )

        def _project_threshold_config(alias: Optional[str] = None) -> SelectType:
            return (
                Function(
                    "if",
                    [
                        Function(
                            "equals",
                            [
                                project_threshold_config_index,
                                0,
                            ],
                        ),
                        (DEFAULT_PROJECT_THRESHOLD_METRIC, DEFAULT_PROJECT_THRESHOLD),
                        Function(
                            "arrayElement",
                            [
                                project_threshold_config_values,
                                project_threshold_config_index,
                            ],
                        ),
                    ],
                    alias,
                )
                if project_threshold_configs
                else Function(
                    "tuple",
                    [DEFAULT_PROJECT_THRESHOLD_METRIC, DEFAULT_PROJECT_THRESHOLD],
                    alias,
                )
            )

        if transaction_threshold_configs:
            return Function(
                "if",
                [
                    Function(
                        "equals",
                        [
                            project_threshold_override_config_index,
                            0,
                        ],
                    ),
                    _project_threshold_config(),
                    Function(
                        "arrayElement",
                        [
                            project_threshold_override_config_values,
                            project_threshold_override_config_index,
                        ],
                    ),
                ],
                PROJECT_THRESHOLD_CONFIG_ALIAS,
            )

        return _project_threshold_config(PROJECT_THRESHOLD_CONFIG_ALIAS)

    def _resolve_team_key_transaction_alias(self, _: str) -> SelectType:
        org_id = self.params.get("organization_id")
        project_ids = self.params.get("project_id")
        team_ids = self.params.get("team_id")

        if org_id is None or team_ids is None or project_ids is None:
            raise TypeError("Team key transactions parameters cannot be None")

        team_key_transactions = list(
            TeamKeyTransaction.objects.filter(
                organization_id=org_id,
                project_team__in=ProjectTeam.objects.filter(
                    project_id__in=project_ids, team_id__in=team_ids
                ),
            )
            .order_by("transaction", "project_team__project_id")
            .values_list("project_team__project_id", "transaction")
            .distinct("transaction", "project_team__project_id")[
                :MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS
            ]
        )

        count = len(team_key_transactions)

        # NOTE: this raw count is not 100% accurate because if it exceeds
        # `MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS`, it will not be reflected
        sentry_sdk.set_tag("team_key_txns.count", count)
        sentry_sdk.set_tag(
            "team_key_txns.count.grouped", format_grouped_length(count, [10, 100, 250, 500])
        )

        if count == 0:
            return Function("toInt8", [0], TEAM_KEY_TRANSACTION_ALIAS)

        return Function(
            "in",
            [(self.column("project_id"), self.column("transaction")), team_key_transactions],
            TEAM_KEY_TRANSACTION_ALIAS,
        )

    def _resolve_error_unhandled_alias(self, _: str) -> SelectType:
        return Function("notHandled", [], ERROR_UNHANDLED_ALIAS)

    def _project_threshold_multi_if_function(self) -> SelectType:
        """Accessed by `_resolve_apdex_function` and `_resolve_count_miserable_function`,
        this returns the right duration value (for example, lcp or duration) based
        on project or transaction thresholds that have been configured by the user.
        """

        return Function(
            "multiIf",
            [
                Function(
                    "equals",
                    [
                        Function(
                            "tupleElement",
                            [self.resolve_field_alias("project_threshold_config"), 1],
                        ),
                        "lcp",
                    ],
                ),
                self.column("measurements.lcp"),
                self.column("transaction.duration"),
            ],
        )

    def _resolve_apdex_function(self, args: Mapping[str, str], alias: str) -> SelectType:
        if args["satisfaction"]:
            function_args = [self.column("transaction.duration"), int(args["satisfaction"])]
        else:
            function_args = [
                self._project_threshold_multi_if_function(),
                Function("tupleElement", [self.resolve_field_alias("project_threshold_config"), 2]),
            ]

        return Function("apdex", function_args, alias)

    def _resolve_count_miserable_function(self, args: Mapping[str, str], alias: str) -> SelectType:
        if args["satisfaction"]:
            lhs = self.column("transaction.duration")
            rhs = int(args["tolerated"])
        else:
            lhs = self._project_threshold_multi_if_function()
            rhs = Function(
                "multiply",
                [
                    Function(
                        "tupleElement",
                        [self.resolve_field_alias("project_threshold_config"), 2],
                    ),
                    4,
                ],
            )
        col = args["column"]

        return Function("uniqIf", [col, Function("greater", [lhs, rhs])], alias)

    def _resolve_user_misery_function(self, args: Mapping[str, str], alias: str) -> SelectType:
        if args["satisfaction"]:
            count_miserable_agg = self.resolve_function(
                f"count_miserable(user,{args['satisfaction']})"
            )
        else:
            count_miserable_agg = self.resolve_function("count_miserable(user)")

        return Function(
            "ifNull",
            [
                Function(
                    "divide",
                    [
                        Function(
                            "plus",
                            [
                                count_miserable_agg,
                                args["alpha"],
                            ],
                        ),
                        Function(
                            "plus",
                            [
                                Function("uniq", [self.column("user")]),
                                args["parameter_sum"],
                            ],
                        ),
                    ],
                ),
                0,
            ],
            alias,
        )

    def _resolve_percentile(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
        fixed_percentile: float = None,
    ) -> SelectType:
        return (
            Function(
                "max",
                [args["column"]],
                alias,
            )
            if fixed_percentile == 1
            else Function(
                f'quantile({fixed_percentile if fixed_percentile is not None else args["percentile"]})',
                [args["column"]],
                alias,
            )
        )

    def _resolve_division(self, dividend: str, divisor: str, alias: str) -> SelectType:
        return Function(
            "if",
            [
                Function(
                    "greater",
                    [self.column(divisor), 0],
                ),
                Function(
                    "divide",
                    [
                        self.column(dividend),
                        self.column(divisor),
                    ],
                ),
                None,
            ],
            alias,
        )

    def _resolve_measurements_frames_slow_rate(self, _: str) -> SelectType:
        return self._resolve_division(
            "measurements.frames_slow", "measurements.frames_total", MEASUREMENTS_FRAMES_SLOW_RATE
        )

    def _resolve_measurements_frames_frozen_rate(self, _: str) -> SelectType:
        return self._resolve_division(
            "measurements.frames_frozen",
            "measurements.frames_total",
            MEASUREMENTS_FRAMES_FROZEN_RATE,
        )

    def _resolve_measurements_stall_percentage(self, _: str) -> SelectType:
        return self._resolve_division(
            "measurements.stall_total_time", "transaction.duration", MEASUREMENTS_STALL_PERCENTAGE
        )

    def _resolve_unimplemented_function(
        self,
        _: List[str],
        alias: str,
    ) -> SelectType:
        """Used in the interim as a stub for ones that have not be implemented in SnQL yet.
        Can be deleted once all functions have been implemented.
        """
        raise NotImplementedError(f"{alias} not implemented in snql field parsing yet")

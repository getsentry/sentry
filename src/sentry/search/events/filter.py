from datetime import datetime
from typing import Callable, List, Mapping, Optional, Sequence, Tuple, Union

from parsimonious.exceptions import ParseError
from sentry_relay import parse_release as parse_release_relay
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from snuba_sdk.conditions import And, Condition, Op, Or
from snuba_sdk.function import Function

from sentry import eventstore
from sentry.api.event_search import (
    AggregateFilter,
    ParenExpression,
    SearchBoolean,
    SearchFilter,
    SearchKey,
    SearchValue,
    parse_search_query,
)
from sentry.api.release_search import INVALID_SEMVER_MESSAGE
from sentry.constants import SEMVER_FAKE_PACKAGE
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Environment, Organization, Project, Release, SemverFilter
from sentry.models.group import Group
from sentry.search.events.constants import (
    ARRAY_FIELDS,
    EQUALITY_OPERATORS,
    ERROR_HANDLED_ALIAS,
    ERROR_UNHANDLED_ALIAS,
    ISSUE_ALIAS,
    ISSUE_ID_ALIAS,
    MAX_SEARCH_RELEASES,
    NO_CONVERSION_FIELDS,
    OPERATOR_NEGATION_MAP,
    OPERATOR_TO_DJANGO,
    PROJECT_ALIAS,
    PROJECT_NAME_ALIAS,
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_EMPTY_RELEASE,
    SEMVER_PACKAGE_ALIAS,
    SEMVER_WILDCARDS,
    TEAM_KEY_TRANSACTION_ALIAS,
    TRANSACTION_STATUS_ALIAS,
    USER_DISPLAY_ALIAS,
)
from sentry.search.events.fields import FIELD_ALIASES, FUNCTIONS, QueryFields, resolve_field
from sentry.search.events.types import ParamsType, WhereType
from sentry.search.utils import parse_release
from sentry.utils.compat import filter
from sentry.utils.dates import outside_retention_with_modified_start, to_timestamp
from sentry.utils.snuba import (
    FUNCTION_TO_OPERATOR,
    OPERATOR_TO_FUNCTION,
    SNUBA_AND,
    SNUBA_OR,
    Dataset,
    QueryOutsideRetentionError,
)
from sentry.utils.validators import INVALID_ID_DETAILS


def is_condition(term):
    return isinstance(term, (tuple, list)) and len(term) == 3 and term[1] in OPERATOR_TO_FUNCTION


def translate_transaction_status(val):
    if val not in SPAN_STATUS_NAME_TO_CODE:
        raise InvalidSearchQuery(
            f"Invalid value {val} for transaction.status condition. Accepted "
            f"values are {', '.join(SPAN_STATUS_NAME_TO_CODE.keys())}"
        )
    return SPAN_STATUS_NAME_TO_CODE[val]


def to_list(value: Union[List[str], str]) -> List[str]:
    if isinstance(value, list):
        return value
    return [value]


def convert_condition_to_function(cond):
    if len(cond) != 3:
        return cond
    function = OPERATOR_TO_FUNCTION.get(cond[1])
    if not function:
        # It's hard to make this error more specific without exposing internals to the end user
        raise InvalidSearchQuery(f"Operator {cond[1]} is not a valid condition operator.")

    return [function, [cond[0], cond[2]]]


def convert_array_to_tree(operator, terms):
    """
    Convert an array of conditions into a binary tree joined by the operator.
    """
    if len(terms) == 1:
        return terms[0]
    elif len(terms) == 2:
        return [operator, terms]
    elif terms[1] in ["IN", "NOT IN"]:
        return terms

    return [operator, [terms[0], convert_array_to_tree(operator, terms[1:])]]


def convert_aggregate_filter_to_snuba_query(aggregate_filter, params):
    name = aggregate_filter.key.name
    value = aggregate_filter.value.value

    if params is not None and name in params.get("aliases", {}):
        return params["aliases"][name].converter(aggregate_filter)

    value = (
        int(to_timestamp(value)) if isinstance(value, datetime) and name != "timestamp" else value
    )

    if aggregate_filter.operator in ("=", "!=") and aggregate_filter.value.value == "":
        return [["isNull", [name]], aggregate_filter.operator, 1]

    function = resolve_field(name, params, functions_acl=FUNCTIONS.keys())
    if function.aggregate is not None:
        name = function.aggregate[-1]

    return [name, aggregate_filter.operator, value]


def convert_function_to_condition(func):
    if len(func) != 2:
        return func
    operator = FUNCTION_TO_OPERATOR.get(func[0])
    if not operator:
        return [func, "=", 1]

    return [func[1][0], operator, func[1][1]]


def _environment_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
):
    # conditions added to env_conditions are OR'd
    env_conditions = []
    value = search_filter.value.value
    values = set(value if isinstance(value, (list, tuple)) else [value])
    # the "no environment" environment is null in snuba
    if "" in values:
        values.remove("")
        operator = "IS NULL" if search_filter.operator == "=" else "IS NOT NULL"
        env_conditions.append(["environment", operator, None])
    if len(values) == 1:
        operator = "=" if search_filter.operator in EQUALITY_OPERATORS else "!="
        env_conditions.append(["environment", operator, values.pop()])
    elif values:
        operator = "IN" if search_filter.operator in EQUALITY_OPERATORS else "NOT IN"
        env_conditions.append(["environment", operator, values])
    return env_conditions


def _message_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
):
    value = search_filter.value.value
    if search_filter.value.is_wildcard():
        # XXX: We don't want the '^$' values at the beginning and end of
        # the regex since we want to find the pattern anywhere in the
        # message. Strip off here
        value = search_filter.value.value[1:-1]
        return [["match", ["message", f"'(?i){value}'"]], search_filter.operator, 1]
    elif value == "":
        operator = "=" if search_filter.operator == "=" else "!="
        return [["equals", ["message", f"{value}"]], operator, 1]
    else:
        # https://clickhouse.yandex/docs/en/query_language/functions/string_search_functions/#position-haystack-needle
        # positionCaseInsensitive returns 0 if not found and an index of 1 or more if found
        # so we should flip the operator here
        operator = "!=" if search_filter.operator in EQUALITY_OPERATORS else "="
        if search_filter.is_in_filter:
            # XXX: This `toString` usage is unnecessary, but we need it in place to
            # trick the legacy Snuba language into not treating `message` as a
            # function. Once we switch over to snql it can be removed.
            return [
                [
                    "multiSearchFirstPositionCaseInsensitive",
                    [["toString", ["message"]], ["array", [f"'{v}'" for v in value]]],
                ],
                operator,
                0,
            ]

        # make message search case insensitive
        return [["positionCaseInsensitive", ["message", f"'{value}'"]], operator, 0]


def _transaction_status_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
):
    # Handle "has" queries
    if search_filter.value.raw_value == "":
        return [["isNull", [name]], search_filter.operator, 1]

    if search_filter.is_in_filter:
        internal_value = [
            translate_transaction_status(val) for val in search_filter.value.raw_value
        ]
    else:
        internal_value = translate_transaction_status(search_filter.value.raw_value)

    return [name, search_filter.operator, internal_value]


def _issue_id_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
):
    value = search_filter.value.value
    # Handle "has" queries
    if (
        search_filter.value.raw_value == ""
        or search_filter.is_in_filter
        and [v for v in value if not v]
    ):
        # The state of having no issues is represented differently on transactions vs
        # other events. On the transactions table, it is represented by 0 whereas it is
        # represented by NULL everywhere else. We use coalesce here so we can treat this
        # consistently
        name = ["coalesce", [name, 0]]
        if search_filter.is_in_filter:
            value = [v if v else 0 for v in value]
        else:
            value = 0

    # Skip isNull check on group_id value as we want to
    # allow snuba's prewhere optimizer to find this condition.
    return [name, search_filter.operator, value]


def _user_display_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
):
    value = search_filter.value.value
    user_display_expr = FIELD_ALIASES[USER_DISPLAY_ALIAS].get_expression(params)

    # Handle 'has' condition
    if search_filter.value.raw_value == "":
        return [["isNull", [user_display_expr]], search_filter.operator, 1]
    if search_filter.value.is_wildcard():
        return [
            ["match", [user_display_expr, f"'(?i){value}'"]],
            search_filter.operator,
            1,
        ]
    return [user_display_expr, search_filter.operator, value]


def _error_unhandled_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
):
    value = search_filter.value.value
    # This field is the inversion of error.handled, otherwise the logic is the same.
    if search_filter.value.raw_value == "":
        output = 0 if search_filter.operator == "!=" else 1
        return [["isHandled", []], "=", output]
    if value in ("1", 1):
        return [["notHandled", []], "=", 1]
    if value in ("0", 0):
        return [["isHandled", []], "=", 1]
    raise InvalidSearchQuery(
        "Invalid value for error.unhandled condition. Accepted values are 1, 0"
    )


def _error_handled_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
):
    value = search_filter.value.value
    # Treat has filter as equivalent to handled
    if search_filter.value.raw_value == "":
        output = 1 if search_filter.operator == "!=" else 0
        return [["isHandled", []], "=", output]
    # Null values and 1 are the same, and both indicate a handled error.
    if value in ("1", 1):
        return [["isHandled", []], "=", 1]
    if value in ("0", 0):
        return [["notHandled", []], "=", 1]
    raise InvalidSearchQuery("Invalid value for error.handled condition. Accepted values are 1, 0")


def _team_key_transaction_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
):
    value = search_filter.value.value
    key_transaction_expr = FIELD_ALIASES[TEAM_KEY_TRANSACTION_ALIAS].get_field(params)

    if search_filter.value.raw_value == "":
        operator = "!=" if search_filter.operator == "!=" else "="
        return [key_transaction_expr, operator, 0]
    if value in ("1", 1):
        return [key_transaction_expr, "=", 1]
    if value in ("0", 0):
        return [key_transaction_expr, "=", 0]
    raise InvalidSearchQuery(
        "Invalid value for team_key_transaction condition. Accepted values are 1, 0"
    )


def _flip_field_sort(field: str):
    return field[1:] if field.startswith("-") else f"-{field}"


def _release_stage_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
) -> Tuple[str, str, Sequence[str]]:
    """
    Parses a release stage search and returns a snuba condition to filter to the
    requested releases.
    """
    # TODO: Filter by project here as well. It's done elsewhere, but could critcally limit versions
    # for orgs with thousands of projects, each with their own releases (potentailly drowning out ones we care about)

    if not params or "organization_id" not in params:
        raise ValueError("organization_id is a required param")

    organization_id: int = params["organization_id"]
    project_ids: Optional[list[int]] = params.get("project_id")
    environments: Optional[list[int]] = params.get("environment")
    qs = (
        Release.objects.filter_by_stage(
            organization_id,
            search_filter.operator,
            search_filter.value.value,
            project_ids=project_ids,
            environments=environments,
        )
        .values_list("version", flat=True)
        .order_by("date_added")[:MAX_SEARCH_RELEASES]
    )
    versions = list(qs)
    final_operator = "IN"

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [SEMVER_EMPTY_RELEASE]

    return ["release", final_operator, versions]


def _semver_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
) -> Tuple[str, str, Sequence[str]]:
    """
    Parses a semver query search and returns a snuba condition to filter to the
    requested releases.

    Since we only have semver information available in Postgres currently, we query
    Postgres and return a list of versions to include/exclude. For most customers this
    will work well, however some have extremely large numbers of releases, and we can't
    pass them all to Snuba. To try and serve reasonable results, we:
     - Attempt to query based on the initial semver query. If this returns
       MAX_SEMVER_SEARCH_RELEASES results, we invert the query and see if it returns
       fewer results. If so, we use a `NOT IN` snuba condition instead of an `IN`.
     - Order the results such that the versions we return are semantically closest to
       the passed filter. This means that when searching for `>= 1.0.0`, we'll return
       version 1.0.0, 1.0.1, 1.1.0 before 9.x.x.
    """
    if not params or "organization_id" not in params:
        raise ValueError("organization_id is a required param")

    organization_id: int = params["organization_id"]
    project_ids: Optional[list[int]] = params.get("project_id")
    # We explicitly use `raw_value` here to avoid converting wildcards to shell values
    version: str = search_filter.value.raw_value
    operator: str = search_filter.operator

    # Note that we sort this such that if we end up fetching more than
    # MAX_SEMVER_SEARCH_RELEASES, we will return the releases that are closest to
    # the passed filter.
    order_by = Release.SEMVER_COLS
    if operator.startswith("<"):
        order_by = list(map(_flip_field_sort, order_by))
    qs = (
        Release.objects.filter_by_semver(
            organization_id,
            parse_semver(version, operator),
            project_ids=project_ids,
        )
        .values_list("version", flat=True)
        .order_by(*order_by)[:MAX_SEARCH_RELEASES]
    )
    versions = list(qs)
    final_operator = "IN"
    if len(versions) == MAX_SEARCH_RELEASES:
        # We want to limit how many versions we pass through to Snuba. If we've hit
        # the limit, make an extra query and see whether the inverse has fewer ids.
        # If so, we can do a NOT IN query with these ids instead. Otherwise, we just
        # do our best.
        operator = OPERATOR_NEGATION_MAP[operator]
        # Note that the `order_by` here is important for index usage. Postgres seems
        # to seq scan with this query if the `order_by` isn't included, so we
        # include it even though we don't really care about order for this query
        qs_flipped = (
            Release.objects.filter_by_semver(organization_id, parse_semver(version, operator))
            .order_by(*map(_flip_field_sort, order_by))
            .values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
        )

        exclude_versions = list(qs_flipped)
        if exclude_versions and len(exclude_versions) < len(versions):
            # Do a negative search instead
            final_operator = "NOT IN"
            versions = exclude_versions

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [SEMVER_EMPTY_RELEASE]

    return ["release", final_operator, versions]


def _semver_package_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
) -> Tuple[str, str, Sequence[str]]:
    """
    Applies a semver package filter to the search. Note that if the query returns more than
    `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
    """
    if not params or "organization_id" not in params:
        raise ValueError("organization_id is a required param")

    organization_id: int = params["organization_id"]
    project_ids: Optional[list[int]] = params.get("project_id")
    package: str = search_filter.value.raw_value

    versions = list(
        Release.objects.filter_by_semver(
            organization_id,
            SemverFilter("exact", [], package),
            project_ids=project_ids,
        ).values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
    )

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [SEMVER_EMPTY_RELEASE]

    return ["release", "IN", versions]


def _semver_build_filter_converter(
    search_filter: SearchFilter,
    name: str,
    params: Optional[Mapping[str, Union[int, str, datetime]]],
) -> Tuple[str, str, Sequence[str]]:
    """
    Applies a semver build filter to the search. Note that if the query returns more than
    `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
    """
    if not params or "organization_id" not in params:
        raise ValueError("organization_id is a required param")

    organization_id: int = params["organization_id"]
    project_ids: Optional[list[int]] = params.get("project_id")
    build: str = search_filter.value.raw_value

    operator, negated = handle_operator_negation(search_filter.operator)
    versions = list(
        Release.objects.filter_by_semver_build(
            organization_id,
            OPERATOR_TO_DJANGO[operator],
            build,
            project_ids=project_ids,
            negated=negated,
        ).values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
    )

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [SEMVER_EMPTY_RELEASE]

    return ["release", "IN", versions]


def handle_operator_negation(operator):
    negated = False
    if operator == "!=":
        negated = True
        operator = "="
    return operator, negated


def parse_semver(version, operator) -> Optional[SemverFilter]:
    """
    Attempts to parse a release version using our semver syntax. version should be in
    format `<package_name>@<version>` or `<version>`, where package_name is a string and
    version is a version string matching semver format (https://semver.org/). We've
    slightly extended this format to allow up to 4 integers. EG
     - sentry@1.2.3.4
     - sentry@1.2.3.4-alpha
     - 1.2.3.4
     - 1.2.3.4-alpha
     - 1.*
    """
    (operator, negated) = handle_operator_negation(operator)
    operator = OPERATOR_TO_DJANGO[operator]
    version = version if "@" in version else f"{SEMVER_FAKE_PACKAGE}@{version}"
    parsed = parse_release_relay(version)
    parsed_version = parsed.get("version_parsed")
    if parsed_version:
        # Convert `pre` to always be a string
        prerelease = parsed_version["pre"] if parsed_version["pre"] else ""
        semver_filter = SemverFilter(
            operator,
            [
                parsed_version["major"],
                parsed_version["minor"],
                parsed_version["patch"],
                parsed_version["revision"],
                0 if prerelease else 1,
                prerelease,
            ],
            negated=negated,
        )
        if parsed["package"] and parsed["package"] != SEMVER_FAKE_PACKAGE:
            semver_filter.package = parsed["package"]
        return semver_filter
    else:
        # Try to parse as a wildcard match
        package, version = version.split("@", 1)
        version_parts = []
        if version:
            for part in version.split(".", 3):
                if part in SEMVER_WILDCARDS:
                    break
                try:
                    # We assume all ints for a wildcard match - not handling prerelease as
                    # part of these
                    version_parts.append(int(part))
                except ValueError:
                    raise InvalidSearchQuery(INVALID_SEMVER_MESSAGE)

        package = package if package and package != SEMVER_FAKE_PACKAGE else None
        return SemverFilter("exact", version_parts, package, negated)


key_conversion_map: Mapping[
    str,
    Callable[[SearchFilter, str, Mapping[str, Union[int, str, datetime]]], Optional[Sequence[any]]],
] = {
    "environment": _environment_filter_converter,
    "message": _message_filter_converter,
    TRANSACTION_STATUS_ALIAS: _transaction_status_filter_converter,
    "issue.id": _issue_id_filter_converter,
    USER_DISPLAY_ALIAS: _user_display_filter_converter,
    ERROR_UNHANDLED_ALIAS: _error_unhandled_filter_converter,
    "error.handled": _error_handled_filter_converter,
    TEAM_KEY_TRANSACTION_ALIAS: _team_key_transaction_filter_converter,
    RELEASE_STAGE_ALIAS: _release_stage_filter_converter,
    SEMVER_ALIAS: _semver_filter_converter,
    SEMVER_PACKAGE_ALIAS: _semver_package_filter_converter,
    SEMVER_BUILD_ALIAS: _semver_build_filter_converter,
}


def convert_search_filter_to_snuba_query(
    search_filter: SearchFilter,
    key: Optional[str] = None,
    params: Optional[Mapping[str, Union[int, str, datetime]]] = None,
) -> Optional[Sequence[any]]:
    name = search_filter.key.name if key is None else key
    value = search_filter.value.value

    # We want to use group_id elsewhere so shouldn't be removed from the dataset
    # but if a user has a tag with the same name we want to make sure that works
    if name in {"group_id"}:
        name = f"tags[{name}]"

    if name in NO_CONVERSION_FIELDS:
        return
    elif name in key_conversion_map:
        return key_conversion_map[name](search_filter, name, params)
    elif name in ARRAY_FIELDS and search_filter.value.is_wildcard():
        # Escape and convert meta characters for LIKE expressions.
        raw_value = search_filter.value.raw_value
        # TODO: There are rare cases where this chaining don't
        # work. For example, a wildcard like '\**' will incorrectly
        # be replaced with '\%%'.
        like_value = (
            # Slashes have to be double escaped so they are
            # interpreted as a string literal.
            raw_value.replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
            .replace("*", "%")
        )
        operator = "LIKE" if search_filter.operator == "=" else "NOT LIKE"
        return [name, operator, like_value]
    elif name in ARRAY_FIELDS and search_filter.is_in_filter:
        operator = "=" if search_filter.operator == "IN" else "!="
        # XXX: This `arrayConcat` usage is unnecessary, but we need it in place to
        # trick the legacy Snuba language into not treating `name` as a
        # function. Once we switch over to snql it can be removed.
        return [
            ["hasAny", [["arrayConcat", [name]], ["array", [f"'{v}'" for v in value]]]],
            operator,
            1,
        ]
    elif name in ARRAY_FIELDS and search_filter.value.raw_value == "":
        return [["notEmpty", [name]], "=", 1 if search_filter.operator == "!=" else 0]
    else:
        # timestamp{,.to_{hour,day}} need a datetime string
        # last_seen needs an integer
        if isinstance(value, datetime) and name not in {
            "timestamp",
            "timestamp.to_hour",
            "timestamp.to_day",
        }:
            value = int(to_timestamp(value)) * 1000

        # Validate event ids and trace ids are uuids
        if name in {"id", "trace"}:
            if search_filter.value.is_wildcard():
                raise InvalidSearchQuery(
                    f"Wildcard conditions are not permitted on `{name}` field."
                )
            elif not search_filter.value.is_event_id():
                label = "Filter ID" if name == "id" else "Filter Trace ID"
                raise InvalidSearchQuery(INVALID_ID_DETAILS.format(label))

        # most field aliases are handled above but timestamp.to_{hour,day} are
        # handled here
        if name in FIELD_ALIASES:
            name = FIELD_ALIASES[name].get_expression(params)

        # Tags are never null, but promoted tags are columns and so can be null.
        # To handle both cases, use `ifNull` to convert to an empty string and
        # compare so we need to check for empty values.
        if search_filter.key.is_tag:
            name = ["ifNull", [name, "''"]]

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            if search_filter.key.is_tag:
                return [name, search_filter.operator, value]
            else:
                # If not a tag, we can just check that the column is null.
                return [["isNull", [name]], search_filter.operator, 1]

        is_null_condition = None
        # TODO(wmak): Skip this for all non-nullable keys not just event.type
        if (
            search_filter.operator in ("!=", "NOT IN")
            and not search_filter.key.is_tag
            and name != "event.type"
        ):
            # Handle null columns on inequality comparisons. Any comparison
            # between a value and a null will result to null, so we need to
            # explicitly check for whether the condition is null, and OR it
            # together with the inequality check.
            # We don't need to apply this for tags, since if they don't exist
            # they'll always be an empty string.
            is_null_condition = [["isNull", [name]], "=", 1]

        if search_filter.value.is_wildcard():
            condition = [["match", [name, f"'(?i){value}'"]], search_filter.operator, 1]
        else:
            condition = [name, search_filter.operator, value]

        # We only want to return as a list if we have the check for null
        # present. Returning as a list causes these conditions to be ORed
        # together. Otherwise just return the raw condition, so that it can be
        # used correctly in aggregates.
        if is_null_condition:
            return [is_null_condition, condition]
        else:
            return condition


def flatten_condition_tree(tree, condition_function):
    """
    Take a binary tree of conditions, and flatten all of the terms using the condition function.
    E.g. f( and(and(b, c), and(d, e)), and ) -> [b, c, d, e]
    """
    stack = [tree]
    flattened = []
    while len(stack) > 0:
        item = stack.pop(0)
        if item[0] == condition_function:
            stack.extend(item[1])
        else:
            flattened.append(item)

    return flattened


def convert_snuba_condition_to_function(term, params=None):
    if isinstance(term, ParenExpression):
        return convert_search_boolean_to_snuba_query(term.children, params)

    group_ids = []
    projects_to_filter = []
    if isinstance(term, SearchFilter):
        conditions, projects_to_filter, group_ids = format_search_filter(term, params)
        group_ids = group_ids if group_ids else []
        if conditions:
            conditions_to_and = []
            for cond in conditions:
                if is_condition(cond):
                    conditions_to_and.append(convert_condition_to_function(cond))
                else:
                    conditions_to_and.append(
                        convert_array_to_tree(
                            SNUBA_OR, [convert_condition_to_function(c) for c in cond]
                        )
                    )

            condition_tree = None
            if len(conditions_to_and) == 1:
                condition_tree = conditions_to_and[0]
            elif len(conditions_to_and) > 1:
                condition_tree = convert_array_to_tree(SNUBA_AND, conditions_to_and)
            return condition_tree, None, projects_to_filter, group_ids
    elif isinstance(term, AggregateFilter):
        converted_filter = convert_aggregate_filter_to_snuba_query(term, params)
        return None, convert_condition_to_function(converted_filter), projects_to_filter, group_ids

    return None, None, projects_to_filter, group_ids


def convert_search_boolean_to_snuba_query(terms, params=None):
    if len(terms) == 1:
        return convert_snuba_condition_to_function(terms[0], params)

    # Filter out any ANDs since we can assume anything without an OR is an AND. Also do some
    # basic sanitization of the query: can't have two operators next to each other, and can't
    # start or end a query with an operator.
    prev = None
    new_terms = []
    term = None

    for term in terms:
        if prev:
            if SearchBoolean.is_operator(prev) and SearchBoolean.is_operator(term):
                raise InvalidSearchQuery(
                    f"Missing condition in between two condition operators: '{prev} {term}'"
                )
        else:
            if SearchBoolean.is_operator(term):
                raise InvalidSearchQuery(
                    f"Condition is missing on the left side of '{term}' operator"
                )

        if term != SearchBoolean.BOOLEAN_AND:
            new_terms.append(term)
        prev = term
    if term is not None and SearchBoolean.is_operator(term):
        raise InvalidSearchQuery(f"Condition is missing on the right side of '{term}' operator")
    terms = new_terms

    # We put precedence on AND, which sort of counter-intuitively means we have to split the query
    # on ORs first, so the ANDs are grouped together. Search through the query for ORs and split the
    # query on each OR.
    # We want to maintain a binary tree, so split the terms on the first OR we can find and recurse on
    # the two sides. If there is no OR, split the first element out to AND
    index = None
    lhs, rhs = None, None
    operator = None
    try:
        index = terms.index(SearchBoolean.BOOLEAN_OR)
        lhs, rhs = terms[:index], terms[index + 1 :]
        operator = SNUBA_OR
    except Exception:
        lhs, rhs = terms[:1], terms[1:]
        operator = SNUBA_AND

    (
        lhs_condition,
        lhs_having,
        projects_to_filter,
        group_ids,
    ) = convert_search_boolean_to_snuba_query(lhs, params)
    (
        rhs_condition,
        rhs_having,
        rhs_projects_to_filter,
        rhs_group_ids,
    ) = convert_search_boolean_to_snuba_query(rhs, params)

    projects_to_filter.extend(rhs_projects_to_filter)
    group_ids.extend(rhs_group_ids)

    if operator == SNUBA_OR and (lhs_condition or rhs_condition) and (lhs_having or rhs_having):
        raise InvalidSearchQuery(
            "Having an OR between aggregate filters and normal filters is invalid."
        )

    condition, having = None, None
    if lhs_condition or rhs_condition:
        args = filter(None, [lhs_condition, rhs_condition])
        if not args:
            condition = None
        elif len(args) == 1:
            condition = args[0]
        else:
            condition = [operator, args]

    if lhs_having or rhs_having:
        args = filter(None, [lhs_having, rhs_having])
        if not args:
            having = None
        elif len(args) == 1:
            having = args[0]
        else:
            having = [operator, args]

    return condition, having, projects_to_filter, group_ids


def get_filter(query=None, params=None):
    """
    Returns an eventstore filter given the search text provided by the user and
    URL params
    """
    # NOTE: this function assumes project permissions check already happened
    parsed_terms = []
    if query is not None:
        try:
            parsed_terms = parse_search_query(query, params=params)
        except ParseError as e:
            raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")

    kwargs = {
        "start": None,
        "end": None,
        "conditions": [],
        "having": [],
        "user_id": None,
        "organization_id": None,
        "team_id": [],
        "project_ids": [],
        "group_ids": [],
        "condition_aggregates": [],
        "aliases": params.get("aliases", {}) if params is not None else {},
    }

    projects_to_filter = []
    if any(
        isinstance(term, ParenExpression) or SearchBoolean.is_operator(term)
        for term in parsed_terms
    ):
        (
            condition,
            having,
            found_projects_to_filter,
            group_ids,
        ) = convert_search_boolean_to_snuba_query(parsed_terms, params)

        if condition:
            and_conditions = flatten_condition_tree(condition, SNUBA_AND)
            for func in and_conditions:
                kwargs["conditions"].append(convert_function_to_condition(func))
        if having:
            kwargs["condition_aggregates"] = [
                term.key.name for term in parsed_terms if isinstance(term, AggregateFilter)
            ]
            and_having = flatten_condition_tree(having, SNUBA_AND)
            for func in and_having:
                kwargs["having"].append(convert_function_to_condition(func))
        if found_projects_to_filter:
            projects_to_filter = list(set(found_projects_to_filter))
        if group_ids is not None:
            kwargs["group_ids"].extend(list(set(group_ids)))
    else:
        projects_to_filter = set()
        for term in parsed_terms:
            if isinstance(term, SearchFilter):
                conditions, found_projects_to_filter, group_ids = format_search_filter(term, params)
                if len(conditions) > 0:
                    kwargs["conditions"].extend(conditions)
                if found_projects_to_filter:
                    projects_to_filter.update(found_projects_to_filter)
                if group_ids is not None:
                    kwargs["group_ids"].extend(group_ids)
            elif isinstance(term, AggregateFilter):
                converted_filter = convert_aggregate_filter_to_snuba_query(term, params)
                kwargs["condition_aggregates"].append(term.key.name)
                if converted_filter:
                    kwargs["having"].append(converted_filter)
        projects_to_filter = list(projects_to_filter)

    # Keys included as url params take precedent if same key is included in search
    # They are also considered safe and to have had access rules applied unlike conditions
    # from the query string.
    if params:
        for key in ("start", "end"):
            kwargs[key] = params.get(key, None)
        if "user_id" in params:
            kwargs["user_id"] = params["user_id"]
        if "organization_id" in params:
            kwargs["organization_id"] = params["organization_id"]
        if "team_id" in params:
            kwargs["team_id"] = params["team_id"]
        # OrganizationEndpoint.get_filter() uses project_id, but eventstore.Filter uses project_ids
        if "project_id" in params:
            if projects_to_filter:
                kwargs["project_ids"] = projects_to_filter
            else:
                kwargs["project_ids"] = params["project_id"]
        if "environment" in params:
            term = SearchFilter(SearchKey("environment"), "=", SearchValue(params["environment"]))
            kwargs["conditions"].append(convert_search_filter_to_snuba_query(term))
        if "group_ids" in params:
            kwargs["group_ids"] = to_list(params["group_ids"])
        # Deprecated alias, use `group_ids` instead
        if ISSUE_ID_ALIAS in params:
            kwargs["group_ids"] = to_list(params["issue.id"])

    return eventstore.Filter(**kwargs)


def format_search_filter(term, params):
    projects_to_filter = []  # Used to avoid doing multiple conditions on project ID
    conditions = []
    group_ids = None
    name = term.key.name
    value = term.value.value
    if name in (PROJECT_ALIAS, PROJECT_NAME_ALIAS):
        if term.operator == "=" and value == "":
            raise InvalidSearchQuery("Invalid query for 'has' search: 'project' cannot be empty.")
        slugs = to_list(value)
        projects = {
            p.slug: p.id
            for p in Project.objects.filter(id__in=params.get("project_id", []), slug__in=slugs)
        }
        missing = [slug for slug in slugs if slug not in projects]
        if missing and term.operator in EQUALITY_OPERATORS:
            raise InvalidSearchQuery(
                f"Invalid query. Project(s) {', '.join(missing)} do not exist or are not actively selected."
            )
        project_ids = list(sorted(projects.values()))
        if project_ids:
            # Create a new search filter with the correct values
            term = SearchFilter(
                SearchKey("project_id"),
                term.operator,
                SearchValue(project_ids if term.is_in_filter else project_ids[0]),
            )
            converted_filter = convert_search_filter_to_snuba_query(term)
            if converted_filter:
                if term.operator in EQUALITY_OPERATORS:
                    projects_to_filter = project_ids
                conditions.append(converted_filter)
    elif name == ISSUE_ID_ALIAS and value != "":
        # A blank term value means that this is a has filter
        group_ids = to_list(value)
    elif name == ISSUE_ALIAS:
        operator = term.operator
        value = to_list(value)
        # `unknown` is a special value for when there is no issue associated with the event
        group_short_ids = [v for v in value if v and v != "unknown"]
        filter_values = ["" for v in value if not v or v == "unknown"]

        if group_short_ids and params and "organization_id" in params:
            try:
                groups = Group.objects.by_qualified_short_id_bulk(
                    params["organization_id"],
                    group_short_ids,
                )
            except Exception:
                raise InvalidSearchQuery(f"Invalid value '{group_short_ids}' for 'issue:' filter")
            else:
                filter_values.extend(sorted(g.id for g in groups))

        term = SearchFilter(
            SearchKey("issue.id"),
            operator,
            SearchValue(filter_values if term.is_in_filter else filter_values[0]),
        )
        converted_filter = convert_search_filter_to_snuba_query(term)
        conditions.append(converted_filter)
    elif (
        name == RELEASE_ALIAS
        and params
        and (value == "latest" or term.is_in_filter and any(v == "latest" for v in value))
    ):
        value = [
            parse_release(
                v,
                params["project_id"],
                params.get("environment_objects"),
                params.get("organization_id"),
            )
            for v in to_list(value)
        ]

        converted_filter = convert_search_filter_to_snuba_query(
            SearchFilter(
                term.key,
                term.operator,
                SearchValue(value if term.is_in_filter else value[0]),
            )
        )
        if converted_filter:
            conditions.append(converted_filter)
    else:
        converted_filter = convert_search_filter_to_snuba_query(term, params=params)
        if converted_filter:
            conditions.append(converted_filter)

    return conditions, projects_to_filter, group_ids


# Not a part of search.events.types to avoid a circular loop
ParsedTerm = Union[SearchFilter, AggregateFilter]
ParsedTerms = Sequence[ParsedTerm]


class QueryFilter(QueryFields):
    """Filter logic for a snql query"""

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        auto_fields: bool = False,
        functions_acl: Optional[List[str]] = None,
    ):
        super().__init__(dataset, params, auto_fields, functions_acl)

        self.search_filter_converter: Mapping[
            str, Callable[[SearchFilter], Optional[WhereType]]
        ] = {
            "environment": self._environment_filter_converter,
            "message": self._message_filter_converter,
            PROJECT_ALIAS: self._project_slug_filter_converter,
            PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
            ISSUE_ALIAS: self._issue_filter_converter,
            TRANSACTION_STATUS_ALIAS: self._transaction_status_filter_converter,
            ISSUE_ID_ALIAS: self._issue_id_filter_converter,
            ERROR_HANDLED_ALIAS: self._error_handled_filter_converter,
            ERROR_UNHANDLED_ALIAS: self._error_unhandled_filter_converter,
            TEAM_KEY_TRANSACTION_ALIAS: self._key_transaction_filter_converter,
            RELEASE_STAGE_ALIAS: self._release_stage_filter_converter,
            SEMVER_ALIAS: self._semver_filter_converter,
            SEMVER_PACKAGE_ALIAS: self._semver_package_filter_converter,
            SEMVER_BUILD_ALIAS: self._semver_build_filter_converter,
        }

    def parse_query(self, query: Optional[str]) -> ParsedTerms:
        """Given a user's query, string construct a list of filters that can be
        then used to construct the conditions of the Query"""
        if query is None:
            return []

        try:
            parsed_terms = parse_search_query(query, params=self.params)
        except ParseError as e:
            raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")

        if not parsed_terms:
            return []

        return parsed_terms

    def resolve_conditions(
        self,
        query: Optional[str],
        use_aggregate_conditions: bool,
    ) -> Tuple[List[WhereType], List[WhereType]]:
        parsed_terms = self.parse_query(query)

        if any(
            isinstance(term, ParenExpression) or SearchBoolean.is_operator(term)
            for term in parsed_terms
        ):
            where, having = self.resolve_boolean_conditions(parsed_terms)
            if not use_aggregate_conditions:
                having = []
        else:
            where = self.resolve_where(parsed_terms)
            having = self.resolve_having(parsed_terms) if use_aggregate_conditions else []
        return where, having

    def resolve_boolean_conditions(
        self, terms: ParsedTerms
    ) -> Tuple[List[WhereType], List[WhereType]]:
        if len(terms) == 1:
            return self.resolve_boolean_condition(terms[0])

        # Filter out any ANDs since we can assume anything without an OR is an AND. Also do some
        # basic sanitization of the query: can't have two operators next to each other, and can't
        # start or end a query with an operator.
        prev = None
        new_terms = []
        term = None
        for term in terms:
            if prev:
                if SearchBoolean.is_operator(prev) and SearchBoolean.is_operator(term):
                    raise InvalidSearchQuery(
                        f"Missing condition in between two condition operators: '{prev} {term}'"
                    )
            else:
                if SearchBoolean.is_operator(term):
                    raise InvalidSearchQuery(
                        f"Condition is missing on the left side of '{term}' operator"
                    )

            if term != SearchBoolean.BOOLEAN_AND:
                new_terms.append(term)

            prev = term

        if term is not None and SearchBoolean.is_operator(term):
            raise InvalidSearchQuery(f"Condition is missing on the right side of '{term}' operator")
        terms = new_terms

        # We put precedence on AND, which sort of counter-intuitively means we have to split the query
        # on ORs first, so the ANDs are grouped together. Search through the query for ORs and split the
        # query on each OR.
        # We want to maintain a binary tree, so split the terms on the first OR we can find and recurse on
        # the two sides. If there is no OR, split the first element out to AND
        index = None
        lhs, rhs = None, None
        operator = None
        try:
            index = terms.index(SearchBoolean.BOOLEAN_OR)
            lhs, rhs = terms[:index], terms[index + 1 :]
            operator = Or
        except Exception:
            lhs, rhs = terms[:1], terms[1:]
            operator = And

        lhs_where, lhs_having = self.resolve_boolean_conditions(lhs)
        rhs_where, rhs_having = self.resolve_boolean_conditions(rhs)

        if operator == Or and (lhs_where or rhs_where) and (lhs_having or rhs_having):
            raise InvalidSearchQuery(
                "Having an OR between aggregate filters and normal filters is invalid."
            )

        where = self._combine_conditions(lhs_where, rhs_where, operator)
        having = self._combine_conditions(lhs_having, rhs_having, operator)

        return where, having

    def _combine_conditions(self, lhs, rhs, operator):
        combined_conditions = [
            conditions[0] if len(conditions) == 1 else And(conditions=conditions)
            for conditions in [lhs, rhs]
            if len(conditions) > 0
        ]
        length = len(combined_conditions)
        if length == 0:
            return []
        elif len(combined_conditions) == 1:
            return combined_conditions
        else:
            return [operator(conditions=combined_conditions)]

    def resolve_boolean_condition(
        self, term: ParsedTerm
    ) -> Tuple[List[WhereType], List[WhereType]]:
        if isinstance(term, ParenExpression):
            return self.resolve_boolean_conditions(term.children)

        where, having = [], []

        if isinstance(term, SearchFilter):
            where = self.resolve_where([term])
        elif isinstance(term, AggregateFilter):
            having = self.resolve_having([term])

        return where, having

    def resolve_where(self, parsed_terms: ParsedTerms) -> List[WhereType]:
        """Given a list of parsed terms, construct their equivalent snql where
        conditions. filtering out any aggregates"""
        where_conditions: List[WhereType] = []
        for term in parsed_terms:
            if isinstance(term, SearchFilter):
                condition = self.format_search_filter(term)
                if condition:
                    where_conditions.append(condition)

        return where_conditions

    def resolve_having(self, parsed_terms: ParsedTerms) -> List[WhereType]:
        """Given a list of parsed terms, construct their equivalent snql having
        conditions, filtering only for aggregate conditions"""

        having_conditions: List[WhereType] = []
        for term in parsed_terms:
            if isinstance(term, AggregateFilter):
                condition = self.convert_aggregate_filter_to_condition(term)
                if condition:
                    having_conditions.append(condition)

        return having_conditions

    def resolve_params(self) -> List[WhereType]:
        """Keys included as url params take precedent if same key is included in search
        They are also considered safe and to have had access rules applied unlike conditions
        from the query string.
        """
        conditions = []

        # start/end are required so that we can run a query in a reasonable amount of time
        if "start" not in self.params or "end" not in self.params:
            raise InvalidSearchQuery("Cannot query without a valid date range")
        start, end = self.params["start"], self.params["end"]
        # Update start to be within retention
        expired, start = outside_retention_with_modified_start(
            start, end, Organization(self.params.get("organization_id"))
        )

        # TODO: this validation should be done when we create the params dataclass instead
        assert isinstance(start, datetime) and isinstance(
            end, datetime
        ), "Both start and end params must be datetime objects"
        assert all(
            isinstance(project_id, int) for project_id in self.params.get("project_id", [])
        ), "All project id params must be ints"
        if expired:
            raise QueryOutsideRetentionError(
                "Invalid date range. Please try a more recent date range."
            )

        conditions.append(Condition(self.column("timestamp"), Op.GTE, start))
        conditions.append(Condition(self.column("timestamp"), Op.LT, end))

        if "project_id" in self.params:
            conditions.append(
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
            condition = self._environment_filter_converter(term)
            if condition:
                conditions.append(condition)

        return conditions

    def format_search_filter(self, term: SearchFilter) -> Optional[WhereType]:
        """For now this function seems a bit redundant inside QueryFilter but
        most of the logic from the existing format_search_filter hasn't been
        converted over yet
        """
        name = term.key.name

        converted_filter = self.convert_search_filter_to_condition(
            SearchFilter(
                # We want to use group_id elsewhere so shouldn't be removed from the dataset
                # but if a user has a tag with the same name we want to make sure that works
                SearchKey("tags[group_id]" if name == "group_id" else name),
                term.operator,
                term.value,
            )
        )
        return converted_filter if converted_filter else None

    def convert_aggregate_filter_to_condition(
        self, aggregate_filter: AggregateFilter
    ) -> Optional[WhereType]:
        name = aggregate_filter.key.name
        value = aggregate_filter.value.value

        if name in self.params.get("aliases", {}):
            raise NotImplementedError("Aggregate aliases not implemented in snql field parsing yet")

        value = (
            int(to_timestamp(value))
            if isinstance(value, datetime) and name != "timestamp"
            else value
        )

        if aggregate_filter.operator in {"=", "!="} and value == "":
            operator = Op.IS_NULL if aggregate_filter.operator == "=" else Op.IS_NOT_NULL
            return Condition(name, operator)

        function = self.resolve_function(name)

        return Condition(function, Op(aggregate_filter.operator), value)

    def convert_search_filter_to_condition(
        self,
        search_filter: SearchFilter,
    ) -> Optional[WhereType]:
        name = search_filter.key.name

        if name in NO_CONVERSION_FIELDS:
            return None

        converter = self.search_filter_converter.get(name, self._default_filter_converter)
        return converter(search_filter)

    def _default_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        name = search_filter.key.name
        value = search_filter.value.value

        lhs = self.resolve_column(name)

        if name in ARRAY_FIELDS:
            if search_filter.value.is_wildcard():
                # TODO: There are rare cases where this chaining don't
                # work. For example, a wildcard like '\**' will incorrectly
                # be replaced with '\%%'.
                return Condition(
                    lhs,
                    Op.LIKE if search_filter.operator == "=" else Op.NOT_LIKE,
                    # Slashes have to be double escaped so they are
                    # interpreted as a string literal.
                    search_filter.value.raw_value.replace("\\", "\\\\")
                    .replace("%", "\\%")
                    .replace("_", "\\_")
                    .replace("*", "%"),
                )
            elif name in ARRAY_FIELDS and search_filter.is_in_filter:
                return Condition(
                    Function("hasAny", [self.column(name), value]),
                    Op.EQ if search_filter.operator == "IN" else Op.NEQ,
                    1,
                )
            elif name in ARRAY_FIELDS and search_filter.value.raw_value == "":
                return Condition(
                    Function("hasAny", [self.column(name), []]),
                    Op.EQ if search_filter.operator == "=" else Op.NEQ,
                    1,
                )

        # timestamp{,.to_{hour,day}} need a datetime string
        # last_seen needs an integer
        if isinstance(value, datetime) and name not in {
            "timestamp",
            "timestamp.to_hour",
            "timestamp.to_day",
        }:
            value = int(to_timestamp(value)) * 1000

        # Validate event ids and trace ids are uuids
        if name in {"id", "trace"}:
            if search_filter.value.is_wildcard():
                raise InvalidSearchQuery(
                    f"Wildcard conditions are not permitted on `{name}` field."
                )
            elif not search_filter.value.is_event_id():
                label = "Filter ID" if name == "id" else "Filter Trace ID"
                raise InvalidSearchQuery(INVALID_ID_DETAILS.format(label))

        # Tags are never null, but promoted tags are columns and so can be null.
        # To handle both cases, use `ifNull` to convert to an empty string and
        # compare so we need to check for empty values.
        if search_filter.key.is_tag:
            name = ["ifNull", [name, "''"]]
            lhs = Function("ifNull", [lhs, ""])

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            if search_filter.key.is_tag:
                return Condition(lhs, Op(search_filter.operator), value)
            else:
                # If not a tag, we can just check that the column is null.
                return Condition(Function("isNull", [lhs]), Op(search_filter.operator), 1)

        is_null_condition = None
        # TODO(wmak): Skip this for all non-nullable keys not just event.type
        if (
            search_filter.operator in ("!=", "NOT IN")
            and not search_filter.key.is_tag
            and name != "event.type"
        ):
            # Handle null columns on inequality comparisons. Any comparison
            # between a value and a null will result to null, so we need to
            # explicitly check for whether the condition is null, and OR it
            # together with the inequality check.
            # We don't need to apply this for tags, since if they don't exist
            # they'll always be an empty string.
            is_null_condition = Condition(Function("isNull", [lhs]), Op.EQ, 1)

        if search_filter.value.is_wildcard():
            condition = Condition(
                Function("match", [lhs, f"(?i){value}"]),
                Op(search_filter.operator),
                1,
            )
        else:
            condition = Condition(lhs, Op(search_filter.operator), value)

        if is_null_condition:
            return Or(conditions=[is_null_condition, condition])
        else:
            return condition

    def _environment_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        # conditions added to env_conditions can be OR'ed
        env_conditions = []
        value = search_filter.value.value
        values = set(value if isinstance(value, (list, tuple)) else [value])
        # sorted for consistency
        values = sorted(f"{value}" for value in values)
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

    def _message_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        value = search_filter.value.value
        if search_filter.value.is_wildcard():
            # XXX: We don't want the '^$' values at the beginning and end of
            # the regex since we want to find the pattern anywhere in the
            # message. Strip off here
            value = search_filter.value.value[1:-1]
            return Condition(
                Function("match", [self.column("message"), f"(?i){value}"]),
                Op(search_filter.operator),
                1,
            )
        elif value == "":
            operator = Op.EQ if search_filter.operator == "=" else Op.NEQ
            return Condition(Function("equals", [self.column("message"), value]), operator, 1)
        else:
            # https://clickhouse.yandex/docs/en/query_language/functions/string_search_functions/#position-haystack-needle
            # positionCaseInsensitive returns 0 if not found and an index of 1 or more if found
            # so we should flip the operator here
            operator = Op.NEQ if search_filter.operator in EQUALITY_OPERATORS else Op.EQ
            if search_filter.is_in_filter:
                return Condition(
                    Function(
                        "multiSearchFirstPositionCaseInsensitive",
                        [self.column("message"), value],
                    ),
                    operator,
                    0,
                )

            # make message search case insensitive
            return Condition(
                Function("positionCaseInsensitive", [self.column("message"), value]),
                operator,
                0,
            )

    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """Convert project slugs to ids and create a filter based on those.
        This is cause we only store project ids in clickhouse.
        """
        value = search_filter.value.value

        if Op(search_filter.operator) == Op.EQ and value == "":
            raise InvalidSearchQuery(
                'Cannot query for has:project or project:"" as every event will have a project'
            )

        slugs = to_list(value)
        project_slugs: Mapping[str, int] = {
            slug: project_id for slug, project_id in self.project_slugs.items() if slug in slugs
        }
        missing: List[str] = [slug for slug in slugs if slug not in project_slugs]
        if missing and search_filter.operator in EQUALITY_OPERATORS:
            raise InvalidSearchQuery(
                f"Invalid query. Project(s) {', '.join(missing)} do not exist or are not actively selected."
            )
        # Sorted for consistent query results
        project_ids = list(sorted(project_slugs.values()))
        if project_ids:
            # Create a new search filter with the correct values
            converted_filter = self.convert_search_filter_to_condition(
                SearchFilter(
                    SearchKey("project.id"),
                    search_filter.operator,
                    SearchValue(project_ids if search_filter.is_in_filter else project_ids[0]),
                )
            )
            if converted_filter:
                if search_filter.operator in EQUALITY_OPERATORS:
                    self.projects_to_filter.update(project_ids)
                return converted_filter

        return None

    def _issue_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        operator = search_filter.operator
        value = to_list(search_filter.value.value)
        # `unknown` is a special value for when there is no issue associated with the event
        group_short_ids = [v for v in value if v and v != "unknown"]
        filter_values = ["" for v in value if not v or v == "unknown"]

        if group_short_ids and self.params and "organization_id" in self.params:
            try:
                groups = Group.objects.by_qualified_short_id_bulk(
                    self.params["organization_id"],
                    group_short_ids,
                )
            except Exception:
                raise InvalidSearchQuery(f"Invalid value '{group_short_ids}' for 'issue:' filter")
            else:
                filter_values.extend(sorted(g.id for g in groups))

        return self.convert_search_filter_to_condition(
            SearchFilter(
                SearchKey("issue.id"),
                operator,
                SearchValue(filter_values if search_filter.is_in_filter else filter_values[0]),
            )
        )

    def _transaction_status_filter_converter(
        self, search_filter: SearchFilter
    ) -> Optional[WhereType]:
        # Handle "has" queries
        if search_filter.value.raw_value == "":
            return Condition(
                self.resolve_field(search_filter.key.name),
                Op.IS_NULL if search_filter.operator == "=" else Op.IS_NOT_NULL,
            )
        if search_filter.is_in_filter:
            internal_value = [
                translate_transaction_status(val) for val in search_filter.value.raw_value
            ]
        else:
            internal_value = translate_transaction_status(search_filter.value.raw_value)
        return Condition(
            self.resolve_field(search_filter.key.name),
            Op(search_filter.operator),
            internal_value,
        )

    def _issue_id_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        name = search_filter.key.name
        value = search_filter.value.value

        lhs = self.column(name)
        rhs = value

        # Handle "has" queries
        if (
            search_filter.value.raw_value == ""
            or search_filter.is_in_filter
            and [v for v in value if not v]
        ):
            if search_filter.is_in_filter:
                rhs = [v if v else 0 for v in value]
            else:
                rhs = 0

        # Skip isNull check on group_id value as we want to
        # allow snuba's prewhere optimizer to find this condition.
        return Condition(lhs, Op(search_filter.operator), rhs)

    def _error_unhandled_filter_converter(
        self,
        search_filter: SearchFilter,
    ) -> Optional[WhereType]:
        value = search_filter.value.value
        # Treat has filter as equivalent to handled
        if search_filter.value.raw_value == "":
            output = 0 if search_filter.operator == "!=" else 1
            return Condition(Function("isHandled", []), Op.EQ, output)
        if value in ("1", 1):
            return Condition(Function("notHandled", []), Op.EQ, 1)
        if value in ("0", 0):
            return Condition(Function("isHandled", []), Op.EQ, 1)
        raise InvalidSearchQuery(
            "Invalid value for error.unhandled condition. Accepted values are 1, 0"
        )

    def _error_handled_filter_converter(
        self,
        search_filter: SearchFilter,
    ) -> Optional[WhereType]:
        value = search_filter.value.value
        # Treat has filter as equivalent to handled
        if search_filter.value.raw_value == "":
            output = 1 if search_filter.operator == "!=" else 0
            return Condition(Function("isHandled", []), Op.EQ, output)
        if value in ("1", 1):
            return Condition(Function("isHandled", []), Op.EQ, 1)
        if value in ("0", 0):
            return Condition(Function("notHandled", []), Op.EQ, 1)
        raise InvalidSearchQuery(
            "Invalid value for error.handled condition. Accepted values are 1, 0"
        )

    def _key_transaction_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        value = search_filter.value.value
        key_transaction_expr = self.resolve_field_alias(TEAM_KEY_TRANSACTION_ALIAS)

        if search_filter.value.raw_value == "":
            return Condition(
                key_transaction_expr, Op.NEQ if search_filter.operator == "!=" else Op.EQ, 0
            )
        if value in ("1", 1):
            return Condition(key_transaction_expr, Op.EQ, 1)
        if value in ("0", 0):
            return Condition(key_transaction_expr, Op.EQ, 0)

        raise InvalidSearchQuery(
            "Invalid value for key_transaction condition. Accepted values are 1, 0"
        )

    def _release_stage_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Parses a release stage search and returns a snuba condition to filter to the
        requested releases.
        """
        # TODO: Filter by project here as well. It's done elsewhere, but could critcally limit versions
        # for orgs with thousands of projects, each with their own releases (potentailly drowning out ones we care about)

        if "organization_id" not in self.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.params["organization_id"]
        project_ids: Optional[list[int]] = self.params.get("project_id")
        environment_ids: Optional[list[int]] = self.params.get("environment_id", [])
        environments = list(
            Environment.objects.filter(
                organization_id=organization_id, id__in=environment_ids
            ).values_list("name", flat=True)
        )
        qs = (
            Release.objects.filter_by_stage(
                organization_id,
                search_filter.operator,
                search_filter.value.value,
                project_ids=project_ids,
                environments=environments,
            )
            .values_list("version", flat=True)
            .order_by("date_added")[:MAX_SEARCH_RELEASES]
        )
        versions = list(qs)

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.column("release"), Op.IN, versions)

    def _semver_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Parses a semver query search and returns a snuba condition to filter to the
        requested releases.

        Since we only have semver information available in Postgres currently, we query
        Postgres and return a list of versions to include/exclude. For most customers this
        will work well, however some have extremely large numbers of releases, and we can't
        pass them all to Snuba. To try and serve reasonable results, we:
         - Attempt to query based on the initial semver query. If this returns
           MAX_SEMVER_SEARCH_RELEASES results, we invert the query and see if it returns
           fewer results. If so, we use a `NOT IN` snuba condition instead of an `IN`.
         - Order the results such that the versions we return are semantically closest to
           the passed filter. This means that when searching for `>= 1.0.0`, we'll return
           version 1.0.0, 1.0.1, 1.1.0 before 9.x.x.
        """
        if "organization_id" not in self.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.params["organization_id"]
        project_ids: Optional[list[int]] = self.params.get("project_id")
        # We explicitly use `raw_value` here to avoid converting wildcards to shell values
        version: str = search_filter.value.raw_value
        operator: str = search_filter.operator

        # Note that we sort this such that if we end up fetching more than
        # MAX_SEMVER_SEARCH_RELEASES, we will return the releases that are closest to
        # the passed filter.
        order_by = Release.SEMVER_COLS
        if operator.startswith("<"):
            order_by = list(map(_flip_field_sort, order_by))
        qs = (
            Release.objects.filter_by_semver(
                organization_id,
                parse_semver(version, operator),
                project_ids=project_ids,
            )
            .values_list("version", flat=True)
            .order_by(*order_by)[:MAX_SEARCH_RELEASES]
        )
        versions = list(qs)
        final_operator = Op.IN
        if len(versions) == MAX_SEARCH_RELEASES:
            # We want to limit how many versions we pass through to Snuba. If we've hit
            # the limit, make an extra query and see whether the inverse has fewer ids.
            # If so, we can do a NOT IN query with these ids instead. Otherwise, we just
            # do our best.
            operator = OPERATOR_NEGATION_MAP[operator]
            # Note that the `order_by` here is important for index usage. Postgres seems
            # to seq scan with this query if the `order_by` isn't included, so we
            # include it even though we don't really care about order for this query
            qs_flipped = (
                Release.objects.filter_by_semver(organization_id, parse_semver(version, operator))
                .order_by(*map(_flip_field_sort, order_by))
                .values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
            )

            exclude_versions = list(qs_flipped)
            if exclude_versions and len(exclude_versions) < len(versions):
                # Do a negative search instead
                final_operator = Op.NOT_IN
                versions = exclude_versions

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.column("release"), final_operator, versions)

    def _semver_package_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Applies a semver package filter to the search. Note that if the query returns more than
        `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
        """
        if "organization_id" not in self.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.params["organization_id"]
        project_ids: Optional[list[int]] = self.params.get("project_id")
        package: str = search_filter.value.raw_value

        versions = list(
            Release.objects.filter_by_semver(
                organization_id,
                SemverFilter("exact", [], package),
                project_ids=project_ids,
            ).values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
        )

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.column("release"), Op.IN, versions)

    def _semver_build_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Applies a semver build filter to the search. Note that if the query returns more than
        `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
        """
        if "organization_id" not in self.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.params["organization_id"]
        project_ids: Optional[list[int]] = self.params.get("project_id")
        build: str = search_filter.value.raw_value

        operator, negated = handle_operator_negation(search_filter.operator)
        versions = list(
            Release.objects.filter_by_semver_build(
                organization_id,
                OPERATOR_TO_DJANGO[operator],
                build,
                project_ids=project_ids,
                negated=negated,
            ).values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
        )

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.column("release"), Op.IN, versions)

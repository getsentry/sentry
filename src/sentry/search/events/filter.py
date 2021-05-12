from datetime import datetime

from parsimonious.exceptions import ParseError
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE

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
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project
from sentry.models.group import Group
from sentry.search.events.constants import (
    ARRAY_FIELDS,
    EQUALITY_OPERATORS,
    ERROR_UNHANDLED_ALIAS,
    ISSUE_ALIAS,
    ISSUE_ID_ALIAS,
    KEY_TRANSACTION_ALIAS,
    NO_CONVERSION_FIELDS,
    PROJECT_ALIAS,
    PROJECT_NAME_ALIAS,
    RELEASE_ALIAS,
    USER_DISPLAY_ALIAS,
)
from sentry.search.events.fields import FIELD_ALIASES, FUNCTIONS, resolve_field
from sentry.search.utils import parse_release
from sentry.utils.compat import filter
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import FUNCTION_TO_OPERATOR, OPERATOR_TO_FUNCTION, SNUBA_AND, SNUBA_OR
from sentry.utils.validators import INVALID_EVENT_DETAILS


def is_condition(term):
    return isinstance(term, (tuple, list)) and len(term) == 3 and term[1] in OPERATOR_TO_FUNCTION


def translate_transaction_status(val):
    if val not in SPAN_STATUS_NAME_TO_CODE:
        raise InvalidSearchQuery(
            f"Invalid value {val} for transaction.status condition. Accepted "
            f"values are {', '.join(SPAN_STATUS_NAME_TO_CODE.keys())}"
        )
    return SPAN_STATUS_NAME_TO_CODE[val]


def to_list(value):
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


def convert_search_filter_to_snuba_query(search_filter, key=None, params=None):
    name = search_filter.key.name if key is None else key
    value = search_filter.value.value

    # We want to use group_id elsewhere so shouldn't be removed from the dataset
    # but if a user has a tag with the same name we want to make sure that works
    if name in {"group_id"}:
        name = f"tags[{name}]"

    if name in NO_CONVERSION_FIELDS:
        return
    elif name == "environment":
        # conditions added to env_conditions are OR'd
        env_conditions = []

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
    elif name == "message":
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
    elif name in ARRAY_FIELDS and search_filter.value.is_wildcard():
        # Escape and convert meta characters for LIKE expressions.
        raw_value = search_filter.value.raw_value
        like_value = raw_value.replace("%", "\\%").replace("_", "\\_").replace("*", "%")
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
    elif name == "transaction.status":
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
    elif name == "issue.id":
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
    elif name == USER_DISPLAY_ALIAS:
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
    elif name == ERROR_UNHANDLED_ALIAS:
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
    elif name == "error.handled":
        # Treat has filter as equivalent to handled
        if search_filter.value.raw_value == "":
            output = 1 if search_filter.operator == "!=" else 0
            return [["isHandled", []], "=", output]
        # Null values and 1 are the same, and both indicate a handled error.
        if value in ("1", 1):
            return [["isHandled", []], "=", 1]
        if value in (
            "0",
            0,
        ):
            return [["notHandled", []], "=", 1]
        raise InvalidSearchQuery(
            "Invalid value for error.handled condition. Accepted values are 1, 0"
        )
    elif name == KEY_TRANSACTION_ALIAS:
        key_transaction_expr = FIELD_ALIASES[KEY_TRANSACTION_ALIAS].get_expression(params)

        if search_filter.value.raw_value == "":
            operator = "!=" if search_filter.operator == "!=" else "="
            return [key_transaction_expr, operator, 0]
        if value in ("1", 1):
            return [key_transaction_expr, "=", 1]
        if value in ("0", 0):
            return [key_transaction_expr, "=", 0]
        raise InvalidSearchQuery(
            "Invalid value for key_transaction condition. Accepted values are 1, 0"
        )
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

        # Validate event ids are uuids
        if name == "id":
            if search_filter.value.is_wildcard():
                raise InvalidSearchQuery("Wildcard conditions are not permitted on `id` field.")
            elif not search_filter.value.is_event_id():
                raise InvalidSearchQuery(INVALID_EVENT_DETAILS.format("Filter"))

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
    if SearchBoolean.is_operator(term):
        raise InvalidSearchQuery(f"Condition is missing on the right side of '{term}' operator")
    terms = new_terms

    # We put precedence on AND, which sort of counter-intuitevely means we have to split the query
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
            parsed_terms = parse_search_query(query, allow_boolean=True, params=params)
        except ParseError as e:
            raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")

    kwargs = {
        "start": None,
        "end": None,
        "conditions": [],
        "having": [],
        "user_id": None,
        "organization_id": None,
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
        # OrganizationEndpoint.get_filter() uses project_id, but eventstore.Filter uses project_ids
        if "user_id" in params:
            kwargs["user_id"] = params["user_id"]
        if "organization_id" in params:
            kwargs["organization_id"] = params["organization_id"]
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
                filter_values.extend(sorted([g.id for g in groups]))

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

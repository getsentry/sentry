import re
from typing import TypedDict

from parsimonious import NodeVisitor

from sentry.api.event_search import event_search_grammar
from sentry.discover import arithmetic
from sentry.search.events import fields
from sentry.snuba.metrics import parse_mri

APDEX_USER_MISERY_PATTERN = r"(apdex|user_misery)\((\d+)\)"


class QueryParts(TypedDict):
    selected_columns: list[str]
    query: str
    equations: list[str] | None
    orderby: list[str] | None


COLUMNS_TO_DROP = (
    "any",
    "count_miserable",
    "count_web_vitals",
    "last_seen",
    "percentile",
    "total.count",
)


def format_percentile_term(term):
    function, args, alias = fields.parse_function(term)

    percentile_replacement_function = {
        0.5: "p50",
        0.75: "p75",
        0.90: "p90",
        0.95: "p95",
        0.99: "p99",
        1.0: "p100",
    }
    try:
        translated_column = column_switcheroo(args[0])[0]
        percentile_value = args[1]
        numeric_percentile_value = float(percentile_value)
        new_function = percentile_replacement_function.get(numeric_percentile_value, function)
    except (IndexError, ValueError):
        return term

    if new_function == function:
        return term

    return f"{new_function}({translated_column})"


def drop_unsupported_columns(columns):
    final_columns = []
    dropped_columns = []
    for column in columns:
        if column.startswith(COLUMNS_TO_DROP):
            dropped_columns.append(column)
        else:
            final_columns.append(column)
    # if no columns are left, leave the original columns but keep track of the "dropped" columns
    if len(final_columns) == 0:
        return columns, dropped_columns

    return final_columns, dropped_columns


def apply_is_segment_condition(query: str) -> str:
    if query:
        return f"({query}) AND is_transaction:1"
    return "is_transaction:1"


def column_switcheroo(term):
    """Swaps out the entire column name."""
    parsed_mri = parse_mri(term)
    if parsed_mri:
        term = parsed_mri.name

    column_swap_map = {
        "transaction.duration": "span.duration",
        "http.method": "transaction.method",
        "title": "transaction",
        "url": "request.url",
        "http.url": "request.url",
        "transaction.status": "trace.status",
        "geo.city": "user.geo.city",
        "geo.country_code": "user.geo.country_code",
        "geo.region": "user.geo.region",
        "geo.subdivision": "user.geo.subdivision",
        "geo.subregion": "user.geo.subregion",
        "timestamp.to_day": "timestamp",
        "timestamp.to_hour": "timestamp",
    }

    swapped_term = column_swap_map.get(term, term)

    return swapped_term, swapped_term != term


def function_switcheroo(term):
    """Swaps out the entire function, including args."""
    swapped_term = term
    if term == "count()":
        swapped_term = "count(span.duration)"
    elif term.startswith("percentile("):
        swapped_term = format_percentile_term(term)
    elif term == "apdex()":
        swapped_term = "apdex(span.duration,300)"
    elif term == "user_misery()":
        swapped_term = "user_misery(span.duration,300)"

    match = re.match(APDEX_USER_MISERY_PATTERN, term)
    if match:
        swapped_term = f"{match.group(1)}(span.duration,{match.group(2)})"

    return swapped_term, swapped_term != term


def search_term_switcheroo(term):
    """Swaps out a single search term, both key and value."""
    swapped_term = term
    if term == "event.type:transaction":
        swapped_term = "is_transaction:1"

    return swapped_term, swapped_term != term


class TranslationVisitor(NodeVisitor):
    def __init__(self):
        super().__init__()

    def visit_raw_aggregate_param(self, node, children):
        return column_switcheroo(node.text)[0]

    def visit_aggregate_key(self, node, children):
        term, did_update = function_switcheroo(node.text)
        if did_update:
            return term

        return children or node.text

    def visit_text_filter(self, node, children):
        term, did_update = search_term_switcheroo(node.text)
        if did_update:
            return term

        return children or node.text

    def visit_key(self, node, children):
        return column_switcheroo(node.text)[0]

    def visit_value(self, node, children):
        return column_switcheroo(node.text)[0]

    def generic_visit(self, node, children):
        return children or node.text


def translate_query(query: str):
    flattened_query = []

    def _flatten(seq):
        for item in seq:
            if isinstance(item, list):
                _flatten(item)
            else:
                flattened_query.append(item)

    tree = event_search_grammar.parse(query)
    parsed = TranslationVisitor().visit(tree)
    _flatten(parsed)

    return apply_is_segment_condition("".join(flattened_query))


def translate_columns(columns):
    translated_columns = []

    for column in columns:
        match = fields.is_function(column)

        if not match:
            translated_columns.append(column_switcheroo(column)[0])
            continue

        translated_func, did_update = function_switcheroo(column)
        if did_update:
            translated_columns.append(translated_func)
            continue

        raw_function = match.group("function")
        arguments = fields.parse_arguments(raw_function, match.group("columns"))
        translated_arguments = []

        for argument in arguments:
            translated_arguments.append(column_switcheroo(argument)[0])

        new_arg = ",".join(translated_arguments)
        translated_columns.append(f"{raw_function}({new_arg})")

    # need to drop columns after they have been translated to avoid issues with percentile()
    final_columns, dropped_columns = drop_unsupported_columns(translated_columns)

    return final_columns, dropped_columns


def translate_equations(equations):
    translated_equations = []

    for equation in equations:
        if arithmetic.is_equation(equation):
            arithmetic_equation = arithmetic.strip_equation(equation)
        else:
            arithmetic_equation = equation

        # TODO: add column and function swaps to equation fields and functions
        operation, fields, functions = arithmetic.parse_arithmetic(arithmetic_equation)
        new_fields, dropped_fields = drop_unsupported_columns(fields)
        new_functions, dropped_functions = drop_unsupported_columns(functions)

        if len(dropped_fields) > 0 or len(dropped_functions) > 0:
            continue

        translated_equations.append(equation)

    return translated_equations


def translate_mep_to_eap(query_parts: QueryParts):
    """
    This is a utility used to translate transactions/metrics/mep
    queries to eap queries. It takes in event query syntax (EQS)
    as input and outputs EQS as well. This will allow us to
    translate transaction queries from the frontend on the fly
    and also allow us to migrate all our Discover/Dashboard/Alert
    datamodels to store EAP compatible EQS queries.
    """
    new_query = translate_query(query_parts["query"])
    new_columns, dropped_columns = translate_columns(query_parts["selected_columns"])
    new_equations = translate_equations(query_parts["equations"])

    eap_query = QueryParts(
        query=new_query,
        selected_columns=new_columns,
        equations=new_equations,
        orderby=query_parts["orderby"],
    )

    return eap_query

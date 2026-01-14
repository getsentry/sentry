import re
from typing import TypedDict

from parsimonious import NodeVisitor

from sentry.api.event_search import event_search_grammar
from sentry.discover import arithmetic
from sentry.search.eap.spans.attributes import SPAN_ATTRIBUTE_DEFINITIONS
from sentry.search.events import fields
from sentry.snuba.metrics import parse_mri
from sentry.utils.snuba import get_measurement_name

APDEX_USER_MISERY_PATTERN = r"(apdex|user_misery)\((\d+)\)"

INDEXED_EQUATIONS_PATTERN = r"^equation\[(\d+)\]$"


class QueryParts(TypedDict):
    selected_columns: list[str]
    query: str
    equations: list[str] | None
    orderby: list[str] | None


class DroppedFields(TypedDict):
    selected_columns: list[str]
    equations: list[dict[str, list[str]]]
    orderby: list[dict[str, str | list[str]]]


COLUMNS_TO_DROP = (
    "any",
    "count_miserable",
    "count_web_vitals",
    "last_seen",
    "total.count",
    "linear_regression",
    "corr(",
)

FIELDS_TO_DROP = ("total.count",)


def _flatten(seq, flattened_list):
    for item in seq:
        if isinstance(item, list):
            _flatten(item, flattened_list)
        else:
            flattened_list.append(item)


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
        supported_percentiles = [0.5, 0.75, 0.90, 0.95, 0.99, 1.0]
        smallest_percentile_difference = 1.0
        nearest_percentile = 0.5

        for percentile in supported_percentiles:
            percentile_difference = abs(numeric_percentile_value - percentile)
            # we're rounding up to the nearest supported percentile if it's the midpoint of two supported percentiles
            if percentile_difference <= smallest_percentile_difference:
                nearest_percentile = percentile
                smallest_percentile_difference = percentile_difference

        new_function = percentile_replacement_function.get(nearest_percentile)
    except (IndexError, ValueError, NameError):
        return term

    return f"{new_function}({translated_column})"


def drop_unsupported_columns(columns):
    final_columns = []
    dropped_columns = []
    for column in columns:
        if column.startswith(COLUMNS_TO_DROP):
            dropped_columns.append(column)
        elif match := fields.is_function(column):
            arguments = fields.parse_arguments(match.group("function"), match.group("columns"))
            should_drop = False
            for argument in arguments:
                if argument in FIELDS_TO_DROP:
                    dropped_columns.append(column)
                    should_drop = True
                    break
            if not should_drop:
                final_columns.append(column)

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


def add_equation_prefix_if_needed(term, need_equation):
    if need_equation and term.startswith(("apdex(", "user_misery(", "count_if(")):
        return f"equation|{term}"
    return term


def column_switcheroo(term):
    """Swaps out the entire column name."""
    parsed_mri = parse_mri(term)
    if parsed_mri:
        term = parsed_mri.name

    measurement_name = get_measurement_name(term)
    if measurement_name is not None and term not in SPAN_ATTRIBUTE_DEFINITIONS:
        return f"tags[{measurement_name},number]", True

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
        "platform.name": "platform",
        # parsed MRI column names that need to be swapped
        "duration": "span.duration",
        "exclusive_time": "span.self_time",
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

    def visit_numeric_filter(self, node, children):
        term, did_update = search_term_switcheroo(node.text)
        if did_update:
            return term

        _, parsed_key, _, _, _ = children
        flattened_parsed_key: list[str] = []
        _flatten(parsed_key, flattened_parsed_key)
        flattened_parsed_key_str = "".join(flattened_parsed_key)
        if flattened_parsed_key_str:
            if (
                not flattened_parsed_key_str.startswith("tags[")
                and flattened_parsed_key_str not in SPAN_ATTRIBUTE_DEFINITIONS
            ):
                new_parsed_key = [f"tags[{flattened_parsed_key_str},number]"]
                children[1] = new_parsed_key

        return children or node.text

    def visit_boolean_filter(self, node, children):
        term, did_update = search_term_switcheroo(node.text)
        if did_update:
            return term

        negation, parsed_key, sep, boolean_val = children
        flattened_parsed_key: list[str] = []
        _flatten(parsed_key, flattened_parsed_key)
        flattened_parsed_key_str = "".join(flattened_parsed_key)

        flattened_parsed_val: list[str] = []
        _flatten(boolean_val, flattened_parsed_val)
        flattened_parsed_val_str = "".join(flattened_parsed_val)
        if (
            flattened_parsed_key_str
            and not flattened_parsed_key_str.startswith("tags[")
            and flattened_parsed_key_str not in SPAN_ATTRIBUTE_DEFINITIONS
        ):
            if flattened_parsed_val_str in ["0", "1"]:
                new_parsed_key = [f"tags[{flattened_parsed_key_str},number]"]
                children[1] = new_parsed_key
                return children or node.text

            # Handle true/false values with backwards compatible OR pattern
            # Supports: tags[key,boolean], tags[key,number], and raw key formats
            if flattened_parsed_val_str.lower() in ["true", "false"]:
                flattened_parsed_val_num = (
                    "1" if flattened_parsed_val_str.lower() == "true" else "0"
                )
                if negation == "":
                    return f"(tags[{flattened_parsed_key_str},boolean]:{flattened_parsed_val_str} OR tags[{flattened_parsed_key_str},number]:{flattened_parsed_val_num} OR {flattened_parsed_key_str}:{flattened_parsed_val_str})"
                else:
                    # For negated filters, apply negation to the whole OR group
                    return f"!(tags[{flattened_parsed_key_str},boolean]:{flattened_parsed_val_str} OR tags[{flattened_parsed_key_str},number]:{flattened_parsed_val_num} OR {flattened_parsed_key_str}:{flattened_parsed_val_str})"

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


class ArithmeticTranslationVisitor(NodeVisitor):
    def __init__(self):
        self.dropped_fields = []
        super().__init__()

    def visit_field_value(self, node, children):
        if node.text in COLUMNS_TO_DROP:
            self.dropped_fields.append(node.text)
            return node.text
        return column_switcheroo(node.text)[0]

    def visit_function_value(self, node, children):
        new_functions, dropped_functions = translate_columns([node.text])
        self.dropped_fields.extend(dropped_functions)
        return new_functions[0]

    def generic_visit(self, node, children):
        return children or node.text


def translate_query(query: str):
    flattened_query: list[str] = []

    tree = event_search_grammar.parse(query)
    parsed = TranslationVisitor().visit(tree)
    _flatten(parsed, flattened_query)

    return apply_is_segment_condition("".join(flattened_query))


def translate_columns(columns, need_equation=False):
    """
    @param columns: list of columns to translate
    @param need_equation: whether to translate some of the functions to equation notation (usually if
    the function is being used in a field/orderby)
    """
    translated_columns = []

    # need to drop columns after they have been translated to avoid issues with percentile()
    final_columns, dropped_columns = drop_unsupported_columns(columns)

    for column in final_columns:
        match = fields.is_function(column)

        if not match:
            translated_columns.append(column_switcheroo(column)[0])
            continue

        translated_func, did_update = function_switcheroo(column)
        if did_update:
            translated_func = add_equation_prefix_if_needed(translated_func, need_equation)
            translated_columns.append(translated_func)
            continue

        raw_function = match.group("function")
        arguments = fields.parse_arguments(raw_function, match.group("columns"))
        translated_arguments = []

        for argument in arguments:
            translated_arguments.append(column_switcheroo(argument)[0])

        new_arg = ",".join(translated_arguments)
        new_function = add_equation_prefix_if_needed(f"{raw_function}({new_arg})", need_equation)
        translated_columns.append(new_function)

    return translated_columns, dropped_columns


def translate_equations(equations):
    """
    This is used to translate arithmetic equations to EAP compatible equations.
    It ideally takes in equations with equation notation and returns the EAP equation with equation notation.
    @param equations: list of equations to translate
    @return: (translated_equations, dropped_equations)
    """
    if equations is None:
        return None, None

    translated_equations = []
    dropped_equations = []

    for equation in equations:

        flattened_equation: list[str] = []

        # strip equation prefix
        if arithmetic.is_equation(equation):
            arithmetic_equation = arithmetic.strip_equation(equation)
        else:
            arithmetic_equation = equation

        # case where equation is empty, don't try to parse it
        if arithmetic_equation == "":
            translated_equations.append(equation)
            continue

        tree = arithmetic.arithmetic_grammar.parse(arithmetic_equation)
        translation_visitor = ArithmeticTranslationVisitor()
        parsed = translation_visitor.visit(tree)
        _flatten(parsed, flattened_equation)

        # record dropped fields and equations and skip these translations
        if len(translation_visitor.dropped_fields) > 0:
            dropped_equations.append(
                {"equation": equation, "reason": translation_visitor.dropped_fields}
            )
            continue

        # translated equations are not returned with the equation prefix
        translated_equation = "equation|" + "".join(flattened_equation)

        translated_equations.append(translated_equation)

    return translated_equations, dropped_equations


def translate_orderbys(orderbys, equations, dropped_equations, new_equations):
    """
    This is used to translate orderbys to EAP compatible orderbys.
    It ideally takes in orderbys with equation notation, function notation or fields and returns the EAP orderby with the same notation.
    @return: (translated_orderbys, dropped_orderbys)
    """
    if orderbys is None:
        return None, None

    translated_orderbys = []
    dropped_orderbys = []

    for orderby in orderbys:
        is_negated = False
        if orderby.startswith("-"):
            is_negated = True
            orderby_without_neg = orderby[1:]
        else:
            orderby_without_neg = orderby

        dropped_orderby_reason = None
        decoded_orderby = None
        # if orderby is a predefined equation (these are usually in the format equation[index])
        if re.match(INDEXED_EQUATIONS_PATTERN, orderby_without_neg):
            equation_index = int(orderby_without_neg.split("[")[1].split("]")[0])

            # checks if equation index is out of bounds
            if len(equations) < equation_index + 1:
                dropped_orderby_reason = "equation issue"

            # if there are equations
            elif len(equations) > 0:
                selected_equation = equations[equation_index]
                # if equation was dropped, drop the orderby too
                if selected_equation in dropped_equations:
                    dropped_orderby_reason = "dropped"
                    decoded_orderby = (
                        selected_equation if not is_negated else f"-{selected_equation}"
                    )
                else:
                    # check where equation is in list of new equations
                    translated_equation_list, _ = translate_equations([selected_equation])
                    try:
                        translated_equation = translated_equation_list[0]
                        new_equation_index = new_equations.index(translated_equation)
                        translated_orderby = [f"equation[{new_equation_index}]"]
                    except (IndexError, ValueError):
                        dropped_orderby_reason = "dropped"
                        decoded_orderby = (
                            selected_equation if not is_negated else f"-{selected_equation}"
                        )
            else:
                dropped_orderby_reason = "no equations"
                decoded_orderby = orderby

        # if orderby is an equation
        elif arithmetic.is_equation(orderby_without_neg):
            translated_orderby, dropped_orderby_equation = translate_equations(
                [orderby_without_neg]
            )
            if len(dropped_orderby_equation) > 0:
                dropped_orderby_reason = dropped_orderby_equation[0]["reason"]

        # if orderby is a field/function
        else:
            translated_orderby, dropped_orderby = translate_columns(
                [orderby_without_neg], need_equation=True
            )
            if len(dropped_orderby) > 0:
                dropped_orderby_reason = dropped_orderby

        # add translated orderby to the list and record dropped orderbys
        if dropped_orderby_reason is None:
            translated_orderbys.append(
                translated_orderby[0] if not is_negated else f"-{translated_orderby[0]}"
            )
        else:
            dropped_orderbys.append(
                {
                    "orderby": orderby if decoded_orderby is None else decoded_orderby,
                    "reason": dropped_orderby_reason,
                }
            )
            continue

    return translated_orderbys, dropped_orderbys


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
    new_columns, dropped_columns = translate_columns(
        query_parts["selected_columns"], need_equation=True
    )
    new_equations, dropped_equations = translate_equations(query_parts["equations"])
    equations = query_parts["equations"] if query_parts["equations"] is not None else []
    dropped_equations_without_reasons = (
        [dropped_equation["equation"] for dropped_equation in dropped_equations]
        if dropped_equations is not None
        else []
    )
    new_orderbys, dropped_orderbys = translate_orderbys(
        query_parts["orderby"], equations, dropped_equations_without_reasons, new_equations
    )

    eap_query = QueryParts(
        query=new_query,
        selected_columns=new_columns,
        equations=new_equations,
        orderby=new_orderbys,
    )

    dropped_fields = DroppedFields(
        selected_columns=dropped_columns,
        equations=dropped_equations,
        orderby=dropped_orderbys,
    )

    return eap_query, dropped_fields

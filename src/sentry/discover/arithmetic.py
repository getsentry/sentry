from typing import Any, List, Optional, Tuple, Union

from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar, NodeVisitor

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.fields import get_function_alias

SUPPORTED_OPERATORS = {"plus", "minus", "multiply", "divide"}


class ArithmeticError(Exception):
    pass


class MaxOperatorError(ArithmeticError):
    """Exceeded the maximum allowed operators"""

    pass


class ArithmeticParseError(ArithmeticError):
    """Encountered an error trying to parse an equation"""

    pass


class ArithmeticValidationError(ArithmeticError):
    """The math itself isn't valid"""

    pass


OperationSideType = Union["Operation", float, str]
JsonQueryType = List[Union[str, float, List[Any]]]


class Operation:
    __slots__ = "operator", "lhs", "rhs"

    def __init__(
        self,
        operator: str,
        lhs: Optional[OperationSideType] = None,
        rhs: Optional[OperationSideType] = None,
    ) -> None:
        self.operator = operator
        self.lhs: Optional[OperationSideType] = lhs
        self.rhs: Optional[OperationSideType] = rhs
        self.validate()

    def validate(self) -> None:
        # This shouldn't really happen, but the operator value is based on the grammar so enforcing it to be safe
        if self.operator not in SUPPORTED_OPERATORS:
            raise ArithmeticParseError(f"{self.operator} is not a supported operator")

        if self.operator == "divide" and self.rhs == 0:
            raise ArithmeticValidationError("division by 0 is not allowed")

    def to_snuba_json(self, alias: Optional[str] = None) -> JsonQueryType:
        """Convert this tree of Operations to the equivalent snuba json"""
        lhs = self.lhs.to_snuba_json() if isinstance(self.lhs, Operation) else self.lhs
        rhs = self.rhs.to_snuba_json() if isinstance(self.rhs, Operation) else self.rhs
        result = [self.operator, [lhs, rhs]]
        if alias:
            result.append(alias)
        return result

    def __repr__(self) -> str:
        return repr([self.operator, self.lhs, self.rhs])


arithmetic_grammar = Grammar(
    r"""
term                 = maybe_factor remaining_adds
remaining_adds       = add_sub*
add_sub              = add_sub_operator maybe_factor
maybe_factor         = spaces (factor / primary) spaces

factor               = primary remaining_muls
remaining_muls       = mul_div+
mul_div              = mul_div_operator primary

add_sub_operator     = spaces (plus / minus) spaces
mul_div_operator     = spaces (multiply / divide) spaces
primary              = spaces (numeric_value / function_value / field_value) spaces

# Operator names should match what's in clickhouse
plus                 = "+"
minus                = "-"
multiply             = "*"
divide               = "/"

# Minor differences in parsing means that these cannot be shared with
# api/event_search. Arithmetic can support something like duration-duration as
# subtraction, but event_search needs to treat that as a single field since `-`
# is a valid tag character, which isn't supported in Arithmetic

function_value       = function_name open_paren spaces function_args? spaces closed_paren
function_args        = function_arg (spaces comma spaces function_arg)*
# Different from a field value, since a function arg may not be a valid field
function_arg         = ~r"[a-zA-Z_\.0-9]+"
function_name        = ~r"[a-zA-Z_0-9]+"
numeric_value        = ~r"[+-]?[0-9]+\.?[0-9]*"
field_value          = ~r"[a-zA-Z_\.]+"

comma                = ","
open_paren           = "("
closed_paren         = ")"
spaces               = " "*
"""
)


class ArithmeticVisitor(NodeVisitor):
    DEFAULT_MAX_OPERATORS = 10

    # Don't wrap in VisitationErrors
    unwrapped_exceptions = (ArithmeticError,)

    field_allowlist = {
        "transaction.duration",
        "spans.http",
        "spans.db",
        "spans.resource",
        "spans.browser",
        "spans.total.time",
        "measurements.fp",
        "measurements.fcp",
        "measurements.lcp",
        "measurements.fid",
        "measurements.ttfb",
        "measurements.ttfb.requesttime",
    }
    function_allowlist = {
        "count",
        "count_unique",
        "failure_count",
        "min",
        "max",
        "avg",
        "sum",
        "p50",
        "p75",
        "p95",
        "p99",
        "p100",
        "percentile",
        "apdex",
        "user_misery",
        "eps",
        "epm",
        "count_miserable",
    }

    def __init__(self, max_operators):
        super().__init__()
        self.operators: int = 0
        self.terms: int = 0
        self.max_operators = max_operators if max_operators else self.DEFAULT_MAX_OPERATORS
        self.fields: set[str] = set()
        self.functions: set[str] = set()

    def flatten(self, remaining):
        """Take all the remaining terms and reduce them to a single tree"""
        term = remaining.pop(0)
        while remaining:
            next_term = remaining.pop(0)
            if next_term.lhs is None:
                next_term.lhs = term
            term = next_term
        return term

    def visit_term(self, _, children):
        maybe_factor, remaining_adds = children
        maybe_factor = maybe_factor[0]
        # remaining_adds is either a list containing an Operation, or a Node
        if isinstance(remaining_adds, list):
            # Update the operation with lhs and continue
            remaining_adds[0].lhs = maybe_factor
            return self.flatten(remaining_adds)
        else:
            # if remaining is a node lhs contains a factor so just return that
            return maybe_factor

    def visit_factor(self, _, children):
        primary, remaining_muls = children
        remaining_muls[0].lhs = primary
        return self.flatten(remaining_muls)

    def visited_operator(self):
        """We visited an operator, increment the count and error if we exceed max"""
        self.operators += 1
        if self.operators > self.max_operators:
            raise MaxOperatorError("Exceeded maximum number of operations")

    def visit_add_sub(self, _, children):
        add_sub_operator, maybe_factor = children
        self.visited_operator()
        return Operation(add_sub_operator, rhs=maybe_factor[0])

    def visit_mul_div(self, _, children):
        mul_div_operator, primary = children
        self.visited_operator()
        return Operation(mul_div_operator, rhs=primary)

    @staticmethod
    def strip_spaces(children):
        """Visitor for a `spaces foo spaces` node"""
        _, value, _ = children

        return value

    def visit_maybe_factor(self, _, children):
        return self.strip_spaces(children)

    def visit_primary(self, _, children):
        # Return the 0th element since this is a (numeric/function/field)
        self.terms += 1
        return self.strip_spaces(children)[0]

    @staticmethod
    def parse_operator(operator):
        # operator is a list since the pattern is (a/b) but we'll only ever want the first value
        return operator[0].expr_name

    def visit_add_sub_operator(self, _, children):
        return self.parse_operator(self.strip_spaces(children))

    def visit_mul_div_operator(self, _, children):
        return self.parse_operator(self.strip_spaces(children))

    def visit_numeric_value(self, node, _):
        return float(node.text)

    def visit_field_value(self, node, _):
        field = node.text
        if field not in self.field_allowlist:
            raise ArithmeticValidationError(f"{field} not allowed in arithmetic")
        self.fields.add(field)
        return field

    def visit_function_value(self, node, children):
        function_node, *_ = children
        function_name = function_node.text
        field = node.text
        if function_name not in self.function_allowlist:
            raise ArithmeticValidationError(f"{function_name} not allowed in arithmetic")
        self.functions.add(field)
        # use the alias to reference the function in arithmetic
        return get_function_alias(field)

    def generic_visit(self, node, children):
        return children or node


def parse_arithmetic(
    equation: str, max_operators: Optional[int] = None
) -> Tuple[Operation, List[str], List[str]]:
    """Given a string equation try to parse it into a set of Operations"""
    try:
        tree = arithmetic_grammar.parse(equation)
    except ParseError:
        raise ArithmeticParseError(
            "Unable to parse your equation, make sure it is well formed arithmetic"
        )
    visitor = ArithmeticVisitor(max_operators)
    result = visitor.visit(tree)
    if len(visitor.fields) > 0 and len(visitor.functions) > 0:
        raise ArithmeticValidationError("Cannot mix functions and fields in arithmetic")
    if visitor.terms <= 1:
        raise ArithmeticValidationError("Arithmetic expression must contain at least 2 terms")
    return result, list(visitor.fields), list(visitor.functions)


def resolve_equation_list(equations: List[str], selected_columns: List[str]) -> List[JsonQueryType]:
    """Given a list of equation strings, resolve them to their equivalent snuba json query formats"""
    resolved_equations = []
    for index, equation in enumerate(equations):
        # only supporting 1 operation for now
        parsed_equation, fields, functions = parse_arithmetic(equation, max_operators=1)
        for field in fields:
            if field not in selected_columns:
                raise InvalidSearchQuery(f"{field} used in an equation but is not a selected field")
        for function in functions:
            if function not in selected_columns:
                raise InvalidSearchQuery(
                    f"{function} used in an equation but is not a selected function"
                )
        # We just jam everything into resolved_equations because the json format can't take arithmetic in the aggregates
        # field, but can do the aliases in the selected_columns field
        # TODO(snql): we can do better
        resolved_equations.append(parsed_equation.to_snuba_json(f"equation[{index}]"))
    return resolved_equations

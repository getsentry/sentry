from typing import Optional

from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar, NodeVisitor


class ArithmeticError(Exception):
    pass


class MaxOperatorError(ArithmeticError):
    """ Exceeded the maximum allowed operators """

    pass


class ArithmeticParseError(ArithmeticError):
    """ Encountered an error trying to parse an equation """

    pass


class Operation:
    __slots__ = "operator", "lhs", "rhs"

    def __init__(self, operator, lhs=None, rhs=None):
        self.operator = operator
        self.lhs = lhs
        self.rhs = rhs

    def __repr__(self):
        return repr([self.operator, repr(self.lhs), repr(self.rhs)])


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
# TODO(wmak) allow variables
primary              = spaces numeric_value spaces

# Operator names should match what's in clickhouse
plus                 = "+"
minus                = "-"
multiply             = "*"
divide               = "/"

# TODO(wmak) share these with api/event_search and support decimals
numeric_value        = ~r"[+-]?[0-9]+"
spaces               = ~r"\ *"
"""
)


class ArithmeticVisitor(NodeVisitor):
    DEFAULT_MAX_OPERATORS = 10

    # Don't wrap in VisitationErrors
    unwrapped_exceptions = (MaxOperatorError,)

    def __init__(self, max_operators):
        super().__init__()
        self.operators = 0
        self.max_operators = max_operators if max_operators else self.DEFAULT_MAX_OPERATORS

    def flatten(self, terms):
        *remaining, term = terms
        if term.lhs is None:
            term.lhs = remaining[0]
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
        """ We visited an operator, increment the count and error if we exceed max """
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
        """ Visitor for a `spaces foo spaces` node """
        _, value, _ = children

        return value

    def visit_maybe_factor(self, _, children):
        return self.strip_spaces(children)

    def visit_primary(self, _, children):
        return self.strip_spaces(children)

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

    def generic_visit(self, node, children):
        return children or node


def parse_arithmetic(equation: str, max_operators: Optional[int] = None) -> Operation:
    """ Given a string equation try to parse it into a set of Operations """
    try:
        tree = arithmetic_grammar.parse(equation)
    except ParseError:
        raise ArithmeticParseError(
            "Unable to parse your equation, make sure it is well formed arithmetic"
        )
    return ArithmeticVisitor(max_operators).visit(tree)

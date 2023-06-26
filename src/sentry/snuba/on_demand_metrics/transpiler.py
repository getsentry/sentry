from collections import namedtuple
from enum import Enum

from sentry.api.event_search import ParenExpression, parse_search_query
from sentry.discover.arithmetic import parse_arithmetic


class Expression(namedtuple("Expression", "left op right")):
    pass


class Precedence(Enum):
    LOWER = 0
    OR = 1
    AND = 2


PRECEDENCE_MAP = {"OR": Precedence.OR, "AND": Precedence.AND}


class Parser:
    def __init__(self, elements):
        self.current_position = 0
        self.peek_position = 1
        self.elements = elements

    def current_token(self):
        if self.current_position >= len(self.elements):
            return None

        return self.elements[self.current_position]

    def peek_token(self):
        if self.peek_position >= len(self.elements):
            return None

        return self.elements[self.peek_position]

    def current_precedence(self):
        return self.precedence(self.current_token())

    def peek_precedence(self):
        return self.precedence(self.peek_token())

    @staticmethod
    def precedence(token):
        if token is None:
            return Precedence.LOWER.value

        return PRECEDENCE_MAP.get(token, Precedence.LOWER).value

    def next_token(self):
        self.current_position += 1
        self.peek_position += 1

    def parse(self, precedence=Precedence.LOWER.value):
        left_exp = self.parse_prefix()

        while self.peek_token() is not None and precedence < self.peek_precedence():
            self.next_token()

            left_exp = self.parse_infix(left_exp)

        return left_exp

    def parse_prefix(self):
        return self.current_token()

    def parse_infix(self, left_exp):
        precedence = self.current_precedence()
        op = self.current_token()

        self.next_token()

        right_exp = self.parse(precedence)

        return Expression(left=left_exp, op=op, right=right_exp)


class SearchQueryVisitor:
    def __init__(self, ast):
        self.ast = ast

    def to_json(self):
        node = self.ast

        if isinstance(node, ParenExpression):
            return

    def paren_expression_to_json(self, paren_expression):
        pass


class MetricsTranspiler:
    def __init__(self, field, filters):
        self.field = field
        self.filters = filters

    def transpile_fields(self):
        return parse_arithmetic(self.field)

    def transpile_filters(self):
        parsed_query = parse_search_query(self.filters)
        expression = Parser(parsed_query).parse()
        return expression

    def to_relay_json(self):
        return ""

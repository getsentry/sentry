from typing import Any, Literal, Sequence, TypedDict

from parsimonious.exceptions import IncompleteParseError
from parsimonious.grammar import Grammar
from parsimonious.nodes import Node, NodeVisitor

from sentry.exceptions import InvalidSearchQuery


class Condition(TypedDict):
    column: str
    operator: Literal["="]
    value: str | float | int


class OrderBy(TypedDict):
    column: str
    direction: Literal["ASC", "DESC"]


class ParsedQuery(TypedDict):
    fields: list[str]
    dataset: str
    where: list[Condition]
    orderby: list[OrderBy]


# Heavily borrowed from Snuba's SnQL Grammar
sql_grammar = Grammar(
    r"""
    query_exp             = select_clause dataset_clause where_clause? having_clause? order_by_clause? limit_clause? offset_clause? space*

    select_clause         = space* "SELECT" space+ select_list
    dataset_clause        = space+ "FROM" space+ dataset_name
    where_clause          = space+ "WHERE" space+ or_expression
    having_clause         = space+ "HAVING" space+ or_expression
    order_by_clause       = space+ "ORDER BY" space+ order_list
    limit_clause          = space+ "LIMIT" space+ integer_literal
    offset_clause         = space+ "OFFSET" space+ integer_literal

    and_expression        = space* condition and_tuple*
    or_expression         = space* and_expression or_tuple*
    and_tuple             = space+ "AND" condition
    or_tuple              = space+ "OR" and_expression
    condition             = main_condition / parenthesized_cdn

    main_condition        = selected_expression space* condition_op space* (function_call / simple_term)
    condition_op          = "!=" / ">=" / ">" / "<=" / "<" / "=" / "NOT IN" / "NOT LIKE" / "IN" / "LIKE"
    unary_op              = "IS NULL" / "IS NOT NULL"
    parenthesized_cdn     = space* open_paren or_expression close_paren

    select_list           = select_columns* (selected_expression)
    select_columns        = selected_expression space* comma
    selected_expression   = space* (aliased_tag_column / aliased_column_name / term)

    order_list            = order_columns* term space+ order_direction
    order_columns         = term space+ order_direction space* comma space*
    order_direction       = ("ASC"/"DESC")?

    term                  = space* (function_call / tag_column / simple_term)

    param_expression      = quoted_literal / identifier
    parameters_list       = parameter* (param_expression)
    parameter             = param_expression space* comma space*
    function_call         = function_name open_paren parameters_list? close_paren (open_paren parameters_list? close_paren)? (space+ "AS" space+ (quoted_alias_literal / alias_literal))?

    aliased_tag_column    = tag_column space+ "AS" space+ (quoted_alias_literal / alias_literal)
    aliased_column_name   = column_name space+ "AS" space+ (quoted_alias_literal / alias_literal)

    simple_term           = quoted_literal / numeric_literal / null_literal / boolean_literal / column_name
    quoted_literal        = ~r"(?<!\\)'(?:(?<!\\)(?:\\{2})*\\'|[^'])*(?<!\\)(?:\\{2})*'"
    string_literal        = ~r"[a-zA-Z0-9_\.\+\*\/:\-]*"
    alias_literal         = ~r"[a-zA-Z0-9_\.\+\*\/:\-\[\]]*"
    quoted_alias_literal  = backtick ~r"[a-zA-Z0-9_\.\+\*\/:\-\[\]\(\)\@]*" backtick
    numeric_literal       = ~r"-?[0-9]+(\.[0-9]+)?(e[\+\-][0-9]+)?"
    integer_literal       = ~r"-?[0-9]+"
    boolean_literal       = true_literal / false_literal
    true_literal          = ~r"TRUE"i
    false_literal         = ~r"FALSE"i
    null_literal          = ~r"NULL"i
    column_name           = ~r"[a-zA-Z_][a-zA-Z0-9_\.:@/]*"
    tag_column            = "tags" open_square tag_name close_square
    tag_name              = ~r"[^\[\]]*"
    identifier            = backtick ~r"[a-zA-Z_][a-zA-Z0-9_]*" backtick
    function_name         = ~r"[a-zA-Z_][a-zA-Z0-9_]*"
    dataset_name           = ~r"[a-zA-Z_]+"
    open_brace            = "{"
    close_brace           = "}"
    open_paren            = "("
    close_paren           = ")"
    open_square           = "["
    close_square          = "]"
    space                 = ~r"\s"
    comma                 = ","
    colon                 = ":"
    backtick              = "`"
    dot                   = "."
"""
)


class SqlVisitor(NodeVisitor[ParsedQuery]):
    def visit_query_exp(self, node: Node, visited_children: Sequence[Any]) -> ParsedQuery:
        select_clause, dataset_clause, where_clause, _, order_by_clause, _, _, _ = visited_children
        return ParsedQuery(
            fields=select_clause,
            dataset=dataset_clause,
            where=where_clause[0]
            if isinstance(where_clause, list) and len(where_clause) > 0
            else [],
            orderby=order_by_clause[0]
            if isinstance(order_by_clause, list) and len(order_by_clause) > 0
            else [],
        )

    def visit_select_clause(self, node: Node, visited_children: Sequence[Any]) -> list[str]:
        _, _, _, selected_columns = visited_children
        return selected_columns

    def visit_dataset_clause(self, node: Node, visited_children: Sequence[Any]) -> str:
        _, _, _, dataset_literal = visited_children
        return dataset_literal

    def visit_where_clause(self, node: Node, visited_children: Sequence[Any]) -> list[Condition]:
        _, _, _, or_condition = visited_children
        return or_condition

    def visit_order_by_clause(self, node: Node, visited_children: Sequence[Any]) -> list[OrderBy]:
        _, _, _, order_list = visited_children
        return order_list

    def visit_order_list(self, node: Node, visited_children: Sequence[Any]) -> list[OrderBy]:
        order_list, orderby, _, direction = visited_children
        last_orderby = OrderBy(column=orderby, direction=direction)

        if isinstance(order_list, list):
            order_list.append(last_orderby)
        else:
            order_list = [last_orderby]
        return order_list

    def visit_order_columns(self, node: Node, visited_children: Sequence[Any]) -> OrderBy:
        orderby, _, direction, _, _, _ = visited_children
        return OrderBy(column=orderby, direction=direction)

    def visit_order_direction(self, node: Node, visited_children: Sequence[Any]) -> str:
        return node.text.strip()

    def visit_selected_expression(self, node: Node, visited_children: Sequence[Any]) -> str:
        return node.text.strip()

    def visit_select_list(self, node: Node, visited_children: Sequence[Any]) -> list[str]:
        columns = []
        column_list, right_column = visited_children
        if isinstance(column_list, list):
            columns.extend(column_list)
        columns.append(right_column)
        return columns

    def visit_select_columns(self, node: Node, visited_children: Sequence[Any]) -> list[str]:
        selected_expression, _, _ = visited_children
        return selected_expression

    def generic_visit(self, node: Node, visited_children: Sequence[Any]) -> Sequence[Any]:
        return visited_children

    """and_condition and or_condition are not properly implemented for more than one condition yet"""

    def visit_and_expression(self, node: Node, visited_children: Sequence[Any]) -> Condition:
        _, left_condition, and_condition = visited_children
        return left_condition

    def visit_or_expression(self, node: Node, visited_children: Sequence[Any]) -> Condition:
        _, left_condition, or_condition = visited_children
        return left_condition

    def visit_main_condition(self, node: Node, visited_children: Sequence[Any]) -> Condition:
        exp, _, op, _, literal = visited_children
        return Condition(column=exp, operator=op, value=literal[0])

    def visit_condition_op(self, node: Node, visited_children: Sequence[Any]) -> str:
        return node.text.strip()

    def visit_term(self, node: Node, visited_children: Sequence[Any]) -> str:
        return node.text.strip()

    def visit_simple_term(self, node: Node, visited_children: Sequence[Any]) -> str:
        return node.text.strip()

    def visit_dataset_name(self, node: Node, visited_children: Sequence[Any]) -> str:
        return node.text.strip()


def parse_sql_query(query: str) -> ParsedQuery:
    try:
        tree = sql_grammar.parse(query)
    except IncompleteParseError as e:
        idx = e.column()
        suffix = query[idx - 1 : (idx + 10)]
        raise InvalidSearchQuery(f"Parse error at '{suffix}' (column {e.column():d}).")

    return SqlVisitor().visit(tree)

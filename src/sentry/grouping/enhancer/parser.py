from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, TypeVar

from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar
from parsimonious.nodes import Node
from parsimonious.nodes import NodeVisitor as BaseNodeVisitor
from parsimonious.nodes import RegexNode

from sentry.utils.strings import unescape_string

from .actions import EnhancementAction, FlagAction, VarAction
from .exceptions import InvalidEnhancerConfig
from .matchers import CalleeMatch, CallerMatch, EnhancementMatch, FrameMatch
from .rules import EnhancementRule

if TYPE_CHECKING:
    NodeVisitor = BaseNodeVisitor[list[EnhancementRule]]
else:
    NodeVisitor = BaseNodeVisitor

T = TypeVar("T")

# Grammar is defined in EBNF syntax.
enhancements_grammar = Grammar(
    r"""

enhancements = line*

line = _ (comment / rule / empty) newline?

rule = _ matchers actions


matchers         = caller_matcher? frame_matcher+ callee_matcher?
frame_matcher    = _ negation? matcher_type sep argument
matcher_type     = ident / quoted_ident
caller_matcher   = _ "[" _ frame_matcher _ "]" _ "|"
callee_matcher   = _ "|" _ "[" _ frame_matcher _ "]"

actions          = action+
action           = flag_action / var_action
var_action       = _ var_name _ "=" _ ident
var_name         = "max-frames" / "min-frames" / "category"
flag_action      = _ range? flag flag_action_name
flag_action_name = "group" / "app"
flag             = "+" / "-"
range            = "^" / "v"

ident            = ~r"[a-zA-Z0-9_\.-]+"
quoted_ident     = ~r"\"([a-zA-Z0-9_\.:-]+)\""

comment          = ~r"#[^\r\n]*"

argument         = quoted / unquoted
quoted           = ~r'"([^"\\]*(?:\\.[^"\\]*)*)"'
unquoted         = ~r"\S+"

sep      = ":"
space    = " "
empty    = ""
negation = "!"
newline  = ~r"[\r\n]"
_        = space*

"""
)


class EnhancementsVisitor(NodeVisitor):
    visit_comment = visit_empty = lambda *a: None
    unwrapped_exceptions = (InvalidEnhancerConfig,)

    def visit_enhancements(
        self, node: Node, children: list[EnhancementRule | Any]
    ) -> list[EnhancementRule]:
        rules = []
        for child in children:
            if not isinstance(child, str) and child is not None:
                rules.append(child)

        return rules

    def visit_line(
        self, node: Node, children: tuple[Any, list[EnhancementRule | Any], Any]
    ) -> EnhancementRule | None:
        _, line, _ = children
        comment_or_rule_or_empty = line[0]
        if comment_or_rule_or_empty:
            return comment_or_rule_or_empty
        return None

    def visit_rule(
        self, node: Node, children: tuple[Any, list[EnhancementMatch], list[EnhancementAction]]
    ) -> EnhancementRule:
        _, matcher, actions = children
        return EnhancementRule(matcher, actions)

    def visit_matchers(
        self, node: Node, children: tuple[list[CallerMatch], list[FrameMatch], list[CalleeMatch]]
    ) -> list[EnhancementMatch]:
        caller_matcher, frame_matchers, callee_matcher = children
        return [*caller_matcher, *frame_matchers, *callee_matcher]

    def visit_caller_matcher(
        self, node: Node, children: tuple[Any, Any, Any, FrameMatch, Any, Any, Any, Any]
    ) -> CallerMatch:
        _, _, _, inner, _, _, _, _ = children
        return CallerMatch(inner)

    def visit_callee_matcher(
        self, node: Node, children: tuple[Any, Any, Any, Any, Any, FrameMatch, Any, Any]
    ) -> CalleeMatch:
        _, _, _, _, _, inner, _, _ = children
        return CalleeMatch(inner)

    def visit_frame_matcher(
        self, node: Node, children: tuple[Any, bool, str, Any, str]
    ) -> FrameMatch:
        _, negation, ty, _, argument = children
        return FrameMatch.from_key(ty, argument, bool(negation))

    def visit_matcher_type(self, node: Node, children: Sequence[Any]) -> str:
        return node.text

    def visit_argument(self, node: Node, children: Sequence[Any]) -> str:
        return children[0]

    def visit_action(
        self, node: Node, children: list[FlagAction | VarAction]
    ) -> FlagAction | VarAction:
        return children[0]

    def visit_flag_action(
        self, node: Node, children: tuple[Any, list[str] | Any, bool, str]
    ) -> FlagAction:
        _, rng, flag, action_name = children
        return FlagAction(action_name, flag, rng[0] if rng else None)

    def visit_flag_action_name(self, node: Node, children: Sequence[Any]) -> str:
        return node.text

    def visit_var_action(
        self, node: Node, children: tuple[Any, str, Any, Any, Any, str]
    ) -> VarAction:
        _, var_name, _, _, _, arg = children
        return VarAction(var_name, arg)

    def visit_var_name(self, node: Node, children: Sequence[Any]) -> str:
        return node.text

    def visit_flag(self, node: Node, children: Sequence[Any]) -> bool:
        return node.text == "+"

    def visit_range(self, node: Node, children: Sequence[Any]) -> str:
        if node.text == "^":
            return "up"
        return "down"

    def visit_quoted(self, node: Node, children: Sequence[Any]) -> str:
        return unescape_string(node.text[1:-1])

    def visit_unquoted(self, node: Node, children: Sequence[Any]) -> str:
        return node.text

    def generic_visit[T](self, node: Node, children: T) -> T:
        return children

    def visit_ident(self, node: Node, children: Sequence[Any]) -> str:
        return node.text

    def visit_quoted_ident(self, node: RegexNode, children: Sequence[Any]) -> str:
        # leading ! are used to indicate negation. make sure they don't appear.
        return node.match.groups()[0].lstrip("!")


def parse_enhancements(s: str) -> list[EnhancementRule]:
    try:
        tree = enhancements_grammar.parse(s)
        return EnhancementsVisitor().visit(tree)
    except ParseError as e:
        context = e.text[e.pos : e.pos + 33]
        if len(context) == 33:
            context = context[:-1] + "..."
        raise InvalidEnhancerConfig(
            f'Invalid syntax near "{context}" (line {e.line()}, column {e.column()})'
        )

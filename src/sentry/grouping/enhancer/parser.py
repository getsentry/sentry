from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar
from parsimonious.nodes import NodeVisitor

from sentry.utils.strings import unescape_string

from .actions import FlagAction, VarAction
from .exceptions import InvalidEnhancerConfig
from .matchers import CalleeMatch, CallerMatch, FrameMatch
from .rules import EnhancementRule

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

    def visit_enhancements(self, node, children) -> list[EnhancementRule]:
        rules = []
        for child in children:
            if not isinstance(child, str) and child is not None:
                rules.append(child)

        return rules

    def visit_line(self, node, children):
        _, line, _ = children
        comment_or_rule_or_empty = line[0]
        if comment_or_rule_or_empty:
            return comment_or_rule_or_empty

    def visit_rule(self, node, children):
        _, matcher, actions = children
        return EnhancementRule(matcher, actions)

    def visit_matchers(self, node, children):
        caller_matcher, frame_matchers, callee_matcher = children
        return caller_matcher + frame_matchers + callee_matcher

    def visit_caller_matcher(self, node, children):
        _, _, _, inner, _, _, _, _ = children
        return CallerMatch(inner)

    def visit_callee_matcher(self, node, children):
        _, _, _, _, _, inner, _, _ = children
        return CalleeMatch(inner)

    def visit_frame_matcher(self, node, children):
        _, negation, ty, _, argument = children
        return FrameMatch.from_key(ty, argument, bool(negation))

    def visit_matcher_type(self, node, children):
        return node.text

    def visit_argument(self, node, children):
        return children[0]

    def visit_action(self, node, children):
        return children[0]

    def visit_flag_action(self, node, children):
        _, rng, flag, action_name = children
        return FlagAction(action_name, flag, rng[0] if rng else None)

    def visit_flag_action_name(self, node, children):
        return node.text

    def visit_var_action(self, node, children):
        _, var_name, _, _, _, arg = children
        return VarAction(var_name, arg)

    def visit_var_name(self, node, children):
        return node.text

    def visit_flag(self, node, children):
        return node.text == "+"

    def visit_range(self, node, children):
        if node.text == "^":
            return "up"
        return "down"

    def visit_quoted(self, node, children):
        return unescape_string(node.text[1:-1])

    def visit_unquoted(self, node, children):
        return node.text

    def generic_visit(self, node, children):
        return children

    def visit_ident(self, node, children):
        return node.text

    def visit_quoted_ident(self, node, children):
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

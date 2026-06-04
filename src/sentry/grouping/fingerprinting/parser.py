from __future__ import annotations

import logging
from typing import TypeVar

from parsimonious.grammar import Grammar
from parsimonious.nodes import Node, NodeVisitor, RegexNode

from sentry.grouping.fingerprinting.exceptions import InvalidFingerprintingConfig
from sentry.grouping.fingerprinting.matchers import FingerprintMatcher
from sentry.grouping.fingerprinting.rules import FingerprintRule
from sentry.grouping.fingerprinting.types import (
    FingerprintRuleAttributes,
    FingerprintWithAttributes,
)
from sentry.grouping.fingerprinting.utils import (
    DEFAULT_FINGERPRINT_VARIABLE,
    is_default_fingerprint_var,
)
from sentry.utils.strings import unescape_string

logger = logging.getLogger("sentry.events.grouping")

T = TypeVar("T")

# Grammar is defined in EBNF syntax.
fingerprinting_grammar = Grammar(
    r"""

fingerprinting_rules = line*

line = _ (comment / rule / empty) newline?

rule = _ matchers _ follow _ fingerprint

matchers       = matcher+
matcher        = _ negation? matcher_type sep argument
matcher_type   = key / quoted_key
argument       = quoted / unquoted

key                  = ~r"[a-zA-Z0-9_\.-]+"
quoted_key           = ~r"\"([a-zA-Z0-9_\.:-]+)\""

fingerprint    = fp_value+
fp_value        = _ fp_argument _ ","?
fp_argument    = fp_attribute / quoted / unquoted_no_comma
fp_attribute   = key "=" quoted

comment        = ~r"#[^\r\n]*"

quoted         = ~r'"([^"\\]*(?:\\.[^"\\]*)*)"'
unquoted       = ~r"\S+"
unquoted_no_comma = ~r"((?:\{\{\s*\S+\s*\}\})|(?:[^\s\{,]+))"

follow   = "->"
sep      = ":"
space    = " "
empty    = ""
negation = "!"
newline  = ~r"[\r\n]"
_        = space*

"""
)


class FingerprintingVisitor(NodeVisitor[list[FingerprintRule]]):
    visit_empty = lambda *a: None
    unwrapped_exceptions = (InvalidFingerprintingConfig,)

    # a note on the typing of `children`
    # these are actually lists of sub-lists of the various types
    # so instead typed as tuples so unpacking works

    def visit_comment(self, node: Node, _: object) -> str:
        return node.text

    def visit_fingerprinting_rules(
        self, _: object, children: list[str | FingerprintRule | None]
    ) -> list[FingerprintRule]:
        return [child for child in children if not isinstance(child, str) and child is not None]

    def visit_line(
        self, _: object, children: tuple[object, list[FingerprintRule | str | None], object]
    ) -> FingerprintRule | str | None:
        _, line, _ = children
        comment_or_rule_or_empty = line[0]
        if comment_or_rule_or_empty:
            return comment_or_rule_or_empty
        return None

    def visit_rule(
        self,
        _: object,
        children: tuple[
            object, list[FingerprintMatcher], object, object, object, FingerprintWithAttributes
        ],
    ) -> FingerprintRule:
        _, matcher, _, _, _, (fingerprint, attributes) = children
        return FingerprintRule(matcher, fingerprint, attributes)

    def visit_matcher(
        self, _: object, children: tuple[object, list[str], str, object, str]
    ) -> FingerprintMatcher:
        _, negation, key, _, pattern = children
        return FingerprintMatcher(key, pattern, bool(negation))

    def visit_matcher_type(self, _: object, children: list[str]) -> str:
        return children[0]

    def visit_argument(self, _: object, children: list[str]) -> str:
        return children[0]

    visit_fp_argument = visit_argument

    def visit_fingerprint(
        self, _: object, children: list[str | tuple[str, str]]
    ) -> FingerprintWithAttributes:
        fingerprint = []
        attributes: FingerprintRuleAttributes = {}
        for item in children:
            if isinstance(item, tuple):
                # This should always be true, because otherwise an error would have been raised when
                # we visited the child node in `visit_fp_attribute`
                if item[0] == "title":
                    attributes["title"] = item[1]
            else:
                fingerprint.append(item)
        return FingerprintWithAttributes(fingerprint, attributes)

    def visit_fp_value(self, _: object, children: tuple[object, str, object, object]) -> str:
        _, argument, _, _ = children
        # Normalize variations of `{{ default }}`
        if isinstance(argument, str) and is_default_fingerprint_var(argument):
            return DEFAULT_FINGERPRINT_VARIABLE
        return argument

    def visit_fp_attribute(self, _: object, children: tuple[str, object, str]) -> tuple[str, str]:
        key, _, value = children
        if key != "title":
            raise InvalidFingerprintingConfig("Unknown attribute '%s'" % key)
        return (key, value)

    def visit_quoted(self, node: Node, _: object) -> str:
        return unescape_string(node.text[1:-1])

    def visit_unquoted(self, node: Node, _: object) -> str:
        return node.text

    visit_unquoted_no_comma = visit_unquoted

    def generic_visit(self, _: object, children: T) -> T:
        return children

    def visit_key(self, node: Node, _: object) -> str:
        return node.text

    def visit_quoted_key(self, node: RegexNode, _: object) -> str:
        # leading ! are used to indicate negation. make sure they don't appear.
        return node.match.groups()[0].lstrip("!")

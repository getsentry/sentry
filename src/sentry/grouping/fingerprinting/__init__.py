from __future__ import annotations

import logging
from collections.abc import Generator, Mapping, Sequence
from pathlib import Path
from typing import Any, NamedTuple, NotRequired, Self, TypedDict, TypeVar

from django.conf import settings
from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar
from parsimonious.nodes import Node, NodeVisitor, RegexNode

from sentry.grouping.fingerprinting.exceptions import InvalidFingerprintingConfig
from sentry.grouping.fingerprinting.matchers import FingerprintMatcher
from sentry.grouping.fingerprinting.utils import EventDatastore
from sentry.grouping.utils import DEFAULT_FINGERPRINT_VARIABLE, is_default_fingerprint_var
from sentry.utils.strings import unescape_string

logger = logging.getLogger(__name__)

T = TypeVar("T")

VERSION = 1

CONFIGS_DIR: Path = Path(__file__).with_name("configs")
DEFAULT_GROUPING_FINGERPRINTING_BASES: list[str] = []


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


class FingerprintRuleAttributes(TypedDict):
    title: NotRequired[str]


class FingerprintWithAttributes(NamedTuple):
    fingerprint: list[str]
    attributes: FingerprintRuleAttributes


class FingerprintRuleConfig(TypedDict):
    # Each matcher is a list of [<name of event attribute to match>, <value to match>]
    matchers: list[list[str]]
    fingerprint: list[str]
    attributes: NotRequired[FingerprintRuleAttributes]
    is_builtin: NotRequired[bool]


# This is just `FingerprintRuleConfig` with an extra `text` entry and with `attributes` required
# rather than optional. (Unfortunately, you can't overwrite lack of required-ness when subclassing a
# TypedDict, so we have to create the full type independently.)
class FingerprintRuleJSON(TypedDict):
    text: str
    # Each matcher is a list of [<name of event attribute to match>, <value to match>]
    matchers: list[list[str]]
    fingerprint: list[str]
    attributes: FingerprintRuleAttributes
    is_builtin: NotRequired[bool]


class FingerprintRuleMatch(NamedTuple):
    matched_rule: FingerprintRule
    fingerprint: list[str]
    attributes: FingerprintRuleAttributes


class FingerprintingRules:
    def __init__(
        self,
        rules: Sequence[FingerprintRule],
        version: int | None = None,
        bases: Sequence[str] | None = None,
    ) -> None:
        if version is None:
            version = VERSION
        self.version = version
        self.rules = rules
        self.bases = bases or []

    def iter_rules(self, include_builtin: bool = True) -> Generator[FingerprintRule]:
        if self.rules:
            yield from self.rules
        if include_builtin:
            for base in self.bases:
                base_rules = FINGERPRINTING_BASES.get(base, [])
                yield from base_rules

    def get_fingerprint_values_for_event(
        self, event: Mapping[str, object]
    ) -> None | FingerprintRuleMatch:
        if not (self.bases or self.rules):
            return None
        event_datastore = EventDatastore(event)
        for rule in self.iter_rules():
            match = rule.test_for_match_with_event(event_datastore)
            if match is not None:
                return FingerprintRuleMatch(rule, match.fingerprint, match.attributes)
        return None

    @classmethod
    def _from_config_structure(
        cls, data: dict[str, Any], bases: Sequence[str] | None = None
    ) -> Self:
        version = data.get("version", VERSION)
        if version != VERSION:
            raise ValueError("Unknown version")
        return cls(
            rules=[FingerprintRule._from_config_structure(x) for x in data["rules"]],
            version=version,
            bases=bases,
        )

    def _to_config_structure(self, include_builtin: bool = False) -> dict[str, Any]:
        rules = self.iter_rules(include_builtin=include_builtin)

        return {"version": self.version, "rules": [x._to_config_structure() for x in rules]}

    def to_json(self, include_builtin: bool = False) -> dict[str, Any]:
        return self._to_config_structure(include_builtin=include_builtin)

    @classmethod
    def from_json(cls, value: dict[str, object], bases: Sequence[str] | None = None) -> Self:
        try:
            return cls._from_config_structure(value, bases=bases)
        except (LookupError, AttributeError, TypeError, ValueError) as e:
            raise ValueError("invalid fingerprinting config: %s" % e)

    @classmethod
    def from_config_string(cls, s: Any, bases: Sequence[str] | None = None) -> FingerprintingRules:
        try:
            tree = fingerprinting_grammar.parse(s)
        except ParseError as e:
            context = e.text[e.pos : e.pos + 33]
            if len(context) == 33:
                context = context[:-1] + "..."
            raise InvalidFingerprintingConfig(
                f'Invalid syntax near "{context}" (line {e.line()}, column {e.column()})'
            )

        rules = FingerprintingVisitor().visit(tree)

        return cls(rules=rules, bases=bases)


class BuiltInFingerprintingRules(FingerprintingRules):
    """
    A FingerprintingRules object that marks all of its rules as built-in
    """

    @classmethod
    def from_config_string(cls, s: str, bases: Sequence[str] | None = None) -> FingerprintingRules:
        fingerprinting_rules = FingerprintingRules.from_config_string(s, bases=bases)
        for r in fingerprinting_rules.rules:
            r.is_builtin = True
        return fingerprinting_rules

    @classmethod
    def _from_config_structure(
        cls, data: dict[str, object], bases: Sequence[str] | None = None
    ) -> Self:
        fingerprinting_rules = super()._from_config_structure(data, bases=bases)
        for r in fingerprinting_rules.rules:
            r.is_builtin = True
        return fingerprinting_rules


class FingerprintRule:
    def __init__(
        self,
        matchers: Sequence[FingerprintMatcher],
        fingerprint: list[str],
        attributes: FingerprintRuleAttributes,
        is_builtin: bool = False,
    ) -> None:
        self.matchers = matchers
        self.fingerprint = fingerprint
        self.attributes = attributes
        self.is_builtin = is_builtin

    def test_for_match_with_event(
        self, event_datastore: EventDatastore
    ) -> None | FingerprintWithAttributes:
        matchers_by_match_type: dict[str, list[FingerprintMatcher]] = {}
        for matcher in self.matchers:
            matchers_by_match_type.setdefault(matcher.match_type, []).append(matcher)

        for match_type, matchers in matchers_by_match_type.items():
            for event_values in event_datastore.get_values(match_type):
                if all(matcher.matches(event_values) for matcher in matchers):
                    break
            else:
                return None

        return FingerprintWithAttributes(self.fingerprint, self.attributes)

    def _to_config_structure(self) -> FingerprintRuleJSON:
        config_structure: FingerprintRuleJSON = {
            "text": self.text,
            "matchers": [x._to_config_structure() for x in self.matchers],
            "fingerprint": self.fingerprint,
            "attributes": self.attributes,
        }

        # only adding this key if it's true to avoid having to change in a bazillion asserts
        if self.is_builtin:
            config_structure["is_builtin"] = True
        return config_structure

    @classmethod
    def _from_config_structure(cls, config: FingerprintRuleConfig | FingerprintRuleJSON) -> Self:
        return cls(
            [FingerprintMatcher._from_config_structure(x) for x in config["matchers"]],
            config["fingerprint"],
            config.get("attributes") or {},
            config.get("is_builtin") or False,
        )

    def to_json(self) -> FingerprintRuleJSON:
        return self._to_config_structure()

    @classmethod
    def from_json(cls, json: FingerprintRuleConfig | FingerprintRuleJSON) -> Self:
        return cls._from_config_structure(json)

    @property
    def text(self) -> str:
        return (
            '%s -> "%s" %s'
            % (
                " ".join(x.text for x in self.matchers),
                "".join(x for x in self.fingerprint),
                " ".join(f'{k}="{v}"' for (k, v) in sorted(self.attributes.items())),
            )
        ).rstrip()


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


def _load_configs() -> dict[str, list[FingerprintRule]]:
    if not CONFIGS_DIR.exists():
        logger.error(
            "Failed to load Fingerprinting Configs, invalid _config_dir: %s",
            CONFIGS_DIR,
        )
        if settings.DEBUG:
            raise Exception(
                f"Failed to load Fingerprinting Configs, invalid _config_dir: '{CONFIGS_DIR}'"
            )

    configs: dict[str, list[FingerprintRule]] = {}

    for config_file_path in sorted(CONFIGS_DIR.glob("**/*.txt")):
        config_name = config_file_path.parent.name
        configs.setdefault(config_name, [])

        try:
            with open(config_file_path) as config_file:
                str_conf = config_file.read().rstrip()
                configs[config_name].extend(
                    BuiltInFingerprintingRules.from_config_string(str_conf).rules
                )
        except InvalidFingerprintingConfig:
            logger.exception(
                "Fingerprinting Config %s Invalid",
                config_file_path,
            )
            if settings.DEBUG:
                raise
        except Exception:
            logger.exception(
                "Failed to load Fingerprinting Config %s",
                config_file_path,
            )
            if settings.DEBUG:
                raise

    return configs


FINGERPRINTING_BASES = _load_configs()

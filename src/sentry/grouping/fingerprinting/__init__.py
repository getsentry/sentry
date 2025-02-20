from __future__ import annotations

import inspect
import logging
from collections.abc import Generator, Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, NamedTuple, NotRequired, Self, TypedDict, TypeVar

from django.conf import settings
from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar
from parsimonious.nodes import Node, NodeVisitor, RegexNode

from sentry.grouping.utils import (
    DEFAULT_FINGERPRINT_VARIABLE,
    bool_from_string,
    is_default_fingerprint_var,
)
from sentry.stacktraces.functions import get_function_name_for_frame
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.event_frames import find_stack_frames
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path
from sentry.utils.strings import unescape_string
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

logger = logging.getLogger(__name__)

T = TypeVar("T")

VERSION = 1

CONFIGS_DIR: Path = Path(__file__).with_name("configs")

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


class InvalidFingerprintingConfig(Exception):
    pass


class _MessageInfo(TypedDict):
    message: str


class _LogInfo(TypedDict):
    logger: NotRequired[str]
    level: NotRequired[str]


class _ExceptionInfo(TypedDict):
    type: str | None
    value: str | None


class _FrameInfo(TypedDict):
    function: str
    abs_path: str | None
    filename: str | None
    module: str | None
    package: str | None
    app: bool | None


class _SdkInfo(TypedDict):
    sdk: str


class _FamilyInfo(TypedDict):
    family: str


class _ReleaseInfo(TypedDict):
    release: str | None


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


class EventDatastore:
    def __init__(self, event: Mapping[str, Any]) -> None:
        self.event = event
        self._exceptions: list[_ExceptionInfo] | None = None
        self._frames: list[_FrameInfo] | None = None
        self._messages: list[_MessageInfo] | None = None
        self._log_info: list[_LogInfo] | None = None
        self._toplevel: list[_MessageInfo | _ExceptionInfo] | None = None
        self._tags: list[dict[str, str]] | None = None
        self._sdk: list[_SdkInfo] | None = None
        self._family: list[_FamilyInfo] | None = None
        self._release: list[_ReleaseInfo] | None = None

    def _get_messages(self) -> list[_MessageInfo]:
        if self._messages is None:
            self._messages = []
            message = get_path(self.event, "logentry", "formatted", filter=True)
            if message:
                self._messages.append({"message": message})
        return self._messages

    def _get_log_info(self) -> list[_LogInfo]:
        if self._log_info is None:
            log_info: _LogInfo = {}
            logger = get_path(self.event, "logger", filter=True)
            if logger:
                log_info["logger"] = logger
            level = get_path(self.event, "level", filter=True)
            if level:
                log_info["level"] = level
            if log_info:
                self._log_info = [log_info]
            else:
                self._log_info = []
        return self._log_info

    def _get_exceptions(self) -> list[_ExceptionInfo]:
        if self._exceptions is None:
            self._exceptions = []
            for exc in get_path(self.event, "exception", "values", filter=True) or ():
                self._exceptions.append(
                    {
                        "type": exc.get("type"),
                        "value": exc.get("value"),
                    }
                )
        return self._exceptions

    def _get_frames(self) -> list[_FrameInfo]:
        if self._frames is None:
            self._frames = frames = []

            def _push_frame(frame: dict[str, object]) -> None:
                platform = frame.get("platform") or self.event.get("platform")
                func = get_function_name_for_frame(frame, platform)
                frames.append(
                    {
                        "function": func or "<unknown>",
                        "abs_path": frame.get("abs_path") or frame.get("filename"),
                        "filename": frame.get("filename"),
                        "module": frame.get("module"),
                        "package": frame.get("package"),
                        "app": frame.get("in_app"),
                    }
                )

            find_stack_frames(self.event, _push_frame)
        return self._frames

    def _get_toplevel(self) -> list[_MessageInfo | _ExceptionInfo]:
        if self._toplevel is None:
            self._toplevel = [*self._get_messages(), *self._get_exceptions()]
        return self._toplevel

    def _get_tags(self) -> list[dict[str, str]]:
        if self._tags is None:
            self._tags = [
                {"tags.%s" % k: v for (k, v) in get_path(self.event, "tags", filter=True) or ()}
            ]
        return self._tags

    def _get_sdk(self) -> list[_SdkInfo]:
        if self._sdk is None:
            self._sdk = [{"sdk": normalized_sdk_tag_from_event(self.event)}]
        return self._sdk

    def _get_family(self) -> list[_FamilyInfo]:
        self._family = self._family or [
            {"family": get_behavior_family_for_platform(self.event.get("platform"))}
        ]
        return self._family

    def _get_release(self) -> list[_ReleaseInfo]:
        self._release = self._release or [{"release": self.event.get("release")}]
        return self._release

    def get_values(self, match_type: str) -> list[dict[str, Any]]:
        """
        Pull values from all the spots in the event appropriate to the given match type.
        """
        return getattr(self, "_get_" + match_type)()


class FingerprintingRules:
    def __init__(
        self,
        rules: Sequence[FingerprintRule],
        changelog: Sequence[object] | None = None,
        version: int | None = None,
        bases: Sequence[str] | None = None,
    ) -> None:
        if version is None:
            version = VERSION
        self.version = version
        self.rules = rules
        self.changelog = changelog
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

    @staticmethod
    def from_config_string(s: Any, bases: Sequence[str] | None = None) -> Any:
        try:
            tree = fingerprinting_grammar.parse(s)
        except ParseError as e:
            context = e.text[e.pos : e.pos + 33]
            if len(context) == 33:
                context = context[:-1] + "..."
            raise InvalidFingerprintingConfig(
                f'Invalid syntax near "{context}" (line {e.line()}, column {e.column()})'
            )
        return FingerprintingVisitor(bases=bases).visit(tree)


if TYPE_CHECKING:
    NodeVisitorBase = NodeVisitor[FingerprintingRules]
else:
    NodeVisitorBase = NodeVisitor


class BuiltInFingerprintingRules(FingerprintingRules):
    """
    A FingerprintingRules object that marks all of its rules as built-in
    """

    @staticmethod
    def from_config_string(s: str, bases: Sequence[str] | None = None) -> FingerprintingRules:
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


MATCHERS = {
    # discover field names
    "error.type": "type",
    "error.value": "value",
    "stack.module": "module",
    "stack.abs_path": "path",
    "stack.package": "package",
    "stack.function": "function",
    "message": "message",
    "logger": "logger",
    "level": "level",
    # fingerprinting shortened fields
    "type": "type",
    "value": "value",
    "module": "module",
    "path": "path",
    "package": "package",
    "function": "function",
    # fingerprinting specific fields
    "family": "family",
    "app": "app",
    "sdk": "sdk",
    "release": "release",
}


class FingerprintMatcher:
    def __init__(
        self,
        key: str,  # The event attribute on which to match
        pattern: str,  # The value to match (or to not match, depending on `negated`)
        negated: bool = False,  # If True, match when `event[key]` does NOT equal `pattern`
    ) -> None:
        if key.startswith("tags."):
            self.key = key
        else:
            try:
                self.key = MATCHERS[key]
            except KeyError:
                raise InvalidFingerprintingConfig("Unknown matcher '%s'" % key)
        self.pattern = pattern
        self.negated = negated

    @property
    def match_type(self) -> str:
        if self.key == "message":
            return "toplevel"
        if self.key in ("logger", "level"):
            return "log_info"
        if self.key in ("type", "value"):
            return "exceptions"
        if self.key.startswith("tags."):
            return "tags"
        if self.key == "sdk":
            return "sdk"
        if self.key == "family":
            return "family"
        if self.key == "release":
            return "release"
        return "frames"

    def matches(self, values: dict[str, Any]) -> bool:
        match_found = self._positive_match(values)
        return not match_found if self.negated else match_found

    def _positive_path_match(self, value: str | None) -> bool:
        if value is None:
            return False
        if glob_match(value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True):
            return True
        if not value.startswith("/") and glob_match(
            "/" + value, self.pattern, ignorecase=True, doublestar=True, path_normalize=True
        ):
            return True
        return False

    def _positive_match(self, values: dict[str, Any]) -> bool:
        # Handle cases where `self.key` isn't 1-to-1 with the corresponding key in `values`
        if self.key == "path":
            return any(
                self._positive_path_match(value)
                # Use a set so that if the values match, we don't needlessly check both
                for value in {values.get("abs_path"), values.get("filename")}
            )

        if self.key == "message":
            return any(
                value is not None and glob_match(value, self.pattern, ignorecase=True)
                # message tests against exception value also, as this is what users expect
                for value in [values.get("message"), values.get("value")]
            )

        # For the rest, `self.key` matches the key in `values`
        value = values.get(self.key)

        if value is None:
            return False

        if self.key in ["package", "release"]:
            return self._positive_path_match(value)

        if self.key in ["family", "sdk"]:
            flags = self.pattern.split(",")
            return "all" in flags or value in flags

        if self.key == "app":
            return value == bool_from_string(self.pattern)

        if self.key in ["level", "value"]:
            return glob_match(value, self.pattern, ignorecase=True)

        return glob_match(value, self.pattern, ignorecase=False)

    def _to_config_structure(self) -> list[str]:
        key = self.key
        if self.negated:
            key = "!" + key
        return [key, self.pattern]

    @classmethod
    def _from_config_structure(cls, matcher: list[str]) -> Self:
        key, pattern = matcher

        negated = key.startswith("!")
        key = key.lstrip("!")

        return cls(key, pattern, negated)

    @property
    def text(self) -> str:
        return '{}{}:"{}"'.format(
            "!" if self.negated else "",
            self.key,
            self.pattern,
        )


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
            for values in event_datastore.get_values(match_type):
                if all(x.matches(values) for x in matchers):
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


class FingerprintingVisitor(NodeVisitorBase):
    visit_empty = lambda *a: None
    unwrapped_exceptions = (InvalidFingerprintingConfig,)

    def __init__(self, bases: Sequence[str] | None) -> None:
        self.bases = bases

    # a note on the typing of `children`
    # these are actually lists of sub-lists of the various types
    # so instead typed as tuples so unpacking works

    def visit_comment(self, node: Node, _: object) -> str:
        return node.text

    def visit_fingerprinting_rules(
        self, _: object, children: list[str | FingerprintRule | None]
    ) -> FingerprintingRules:
        changelog = []
        rules = []
        in_header = True
        for child in children:
            if isinstance(child, str):
                if in_header and child.startswith("##"):
                    changelog.append(child[2:].rstrip())
                else:
                    in_header = False
            elif child is not None:
                rules.append(child)
                in_header = False
        return FingerprintingRules(
            rules=rules,
            changelog=inspect.cleandoc("\n".join(changelog)).rstrip() or None,
            bases=self.bases,
        )

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

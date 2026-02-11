from __future__ import annotations

from typing import TYPE_CHECKING, NamedTuple, NotRequired, TypedDict

if TYPE_CHECKING:
    from sentry.grouping.fingerprinting.rules import FingerprintRule


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


class FingerprintInfo(TypedDict):
    client_fingerprint: NotRequired[list[str]]
    matched_rule: NotRequired[FingerprintRuleJSON]

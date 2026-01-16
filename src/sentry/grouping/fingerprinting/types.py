from __future__ import annotations

from typing import NamedTuple, NotRequired, TypedDict


class FingerprintRuleAttributes(TypedDict):
    title: NotRequired[str]


class FingerprintWithAttributes(NamedTuple):
    fingerprint: list[str]
    attributes: FingerprintRuleAttributes

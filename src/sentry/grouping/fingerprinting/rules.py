from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Self

from sentry.grouping.fingerprinting.matchers import FingerprintMatcher
from sentry.grouping.fingerprinting.types import (
    FingerprintRuleAttributes,
    FingerprintRuleConfig,
    FingerprintRuleJSON,
    FingerprintWithAttributes,
)
from sentry.grouping.fingerprinting.utils import EventDatastore

logger = logging.getLogger("sentry.events.grouping")


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

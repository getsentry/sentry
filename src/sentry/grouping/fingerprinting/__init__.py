from __future__ import annotations

import logging
from collections.abc import Generator, Mapping, Sequence
from pathlib import Path
from typing import Any, Self

from django.conf import settings
from parsimonious.exceptions import ParseError

from sentry.grouping.fingerprinting.exceptions import InvalidFingerprintingConfig
from sentry.grouping.fingerprinting.parser import FingerprintingVisitor, fingerprinting_grammar
from sentry.grouping.fingerprinting.rules import FingerprintRule
from sentry.grouping.fingerprinting.types import FingerprintRuleMatch
from sentry.grouping.fingerprinting.utils import EventDatastore

logger = logging.getLogger(__name__)

VERSION = 1

CONFIGS_DIR: Path = Path(__file__).with_name("configs")
DEFAULT_GROUPING_FINGERPRINTING_BASES: list[str] = []


class FingerprintingConfig:
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
        cls,
        data: dict[str, Any],
        bases: Sequence[str] | None = None,
        mark_as_built_in: bool = False,
    ) -> Self:
        version = data.get("version", VERSION)
        if version != VERSION:
            raise ValueError("Unknown version")

        if mark_as_built_in:
            for rule_config in data["rules"]:
                rule_config["is_builtin"] = True

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
    def from_config_string(
        cls, s: Any, bases: Sequence[str] | None = None, mark_as_built_in: bool = False
    ) -> FingerprintingConfig:
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

        if mark_as_built_in:
            for rule in rules:
                rule.is_builtin = True

        return cls(rules=rules, bases=bases)


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
                    FingerprintingConfig.from_config_string(str_conf, mark_as_built_in=True).rules
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

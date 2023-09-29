from __future__ import annotations

from collections import defaultdict
from typing import Generator

from sentry.rules.base import RuleBase


class RuleRegistry:
    def __init__(self) -> None:
        self._rules: dict[str, list[type[RuleBase]]] = defaultdict(list)
        self._map: dict[str, type[RuleBase]] = {}

    def __contains__(self, rule_id: int) -> bool:
        return rule_id in self._map

    def __iter__(self) -> Generator[tuple[str, type[RuleBase]], None, None]:
        for rule_type, rule_list in self._rules.items():
            for rule in rule_list:
                yield rule_type, rule

    def add(self, rule: type[RuleBase]) -> None:
        self._map[rule.id] = rule
        self._rules[rule.rule_type].append(rule)

    def get(self, rule_id: str, type: str | None = None) -> type[RuleBase] | None:
        cls = self._map.get(rule_id)
        if type is not None and cls not in self._rules[type]:
            return None
        return cls

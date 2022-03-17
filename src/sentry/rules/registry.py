from __future__ import annotations

from collections import defaultdict
from typing import Generator, List, MutableMapping, Tuple

from sentry.models import Rule


class RuleRegistry:
    def __init__(self) -> None:
        self._rules: MutableMapping[str, List[Rule]] = defaultdict(list)
        self._map: MutableMapping[int, Rule] = {}

    def __contains__(self, rule_id: int) -> bool:
        return rule_id in self._map

    def __iter__(self) -> Generator[Tuple[str, List[Rule]], None, None]:
        for rule_type, rule_list in self._rules.items():
            for rule in rule_list:
                yield rule_type, rule

    def add(self, rule: Rule) -> None:
        self._map[rule.id] = rule
        self._rules[rule.rule_type].append(rule)

    def get(self, rule_id: int, type: str | None = None) -> Rule | None:
        cls = self._map.get(rule_id)
        if type is not None and cls not in self._rules[type]:
            return None
        return cls

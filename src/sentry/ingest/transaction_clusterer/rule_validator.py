from typing import Optional, Set

from .base import ReplacementRule


class RuleValidator:
    def __init__(self, rule: ReplacementRule, *, char_domain: Optional[str] = None) -> None:
        self._rule = rule
        self._char_domain: Set[str] = set(char_domain) if char_domain else set("*/")

    def is_valid(self) -> bool:
        if self._is_all_stars():
            return False
        return True

    def _is_all_stars(self) -> bool:
        return set(self._rule) <= self._char_domain

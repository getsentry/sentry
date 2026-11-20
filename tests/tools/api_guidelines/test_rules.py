from __future__ import annotations

from tools.api_guidelines.rules import RULES, ApiRule


def test_every_rule_has_a_config() -> None:
    assert set(RULES) == set(ApiRule)

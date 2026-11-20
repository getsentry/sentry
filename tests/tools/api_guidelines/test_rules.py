from __future__ import annotations

from tools.api_guidelines.rules import RULE_SUMMARIES, ApiRule


def test_every_rule_has_a_summary() -> None:
    assert set(RULE_SUMMARIES) == set(ApiRule)

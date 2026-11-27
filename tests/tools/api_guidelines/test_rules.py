from __future__ import annotations

import ast
import re
from pathlib import Path

from tools import flake8_plugin
from tools.api_guidelines.rules import RULES, ApiRule, RuleSource

# API rules that only report as flake text so far. ENG-9063 moves them to get_api_violations
NOT_YET_STRUCTURED = frozenset({ApiRule.S021, ApiRule.S022, ApiRule.S023, ApiRule.S034})

# the smallest endpoint that makes each structured rule fire
TRIGGERS: dict[ApiRule, str] = {
    ApiRule.S025: """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
""",
    ApiRule.S026: """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get("id")
""",
    ApiRule.S027: """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get(some_name)
""",
    ApiRule.S028: """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        return helper(request.data)
""",
}


def _plugin_codes() -> set[str]:
    """Every S-code tools/flake8_plugin.py mentions, so a message that writes its code out instead of
    building it from GeneralRule or ApiRule is still caught
    """
    return set(re.findall(r"\bS\d{3}\b", Path(flake8_plugin.__file__).read_text()))


def test_every_rule_has_a_config() -> None:
    assert set(RULES) == set(ApiRule)


def test_every_plugin_code_is_registered() -> None:
    unregistered: set[str] = set()
    for code in _plugin_codes():
        if code not in flake8_plugin.GeneralRule and code not in ApiRule:
            unregistered.add(code)
    assert not unregistered, (
        f"{sorted(unregistered)} are in tools/flake8_plugin.py but not registered. Add each to "
        "ApiRule and RULES in tools/api_guidelines/rules.py, or to GeneralRule in "
        "tools/flake8_plugin.py if it isn't an API rule, and build its message from that enum"
    )


def test_plugin_codes_dont_collide_with_other_sources() -> None:
    taken: set[str] = set()
    for code in _plugin_codes():
        if code in ApiRule and RULES[ApiRule(code)].source != RuleSource.FLAKE8:
            taken.add(code)
    assert not taken, (
        f"{sorted(taken)} are in tools/flake8_plugin.py but already used by another rule source "
        "in tools/api_guidelines/rules.py. Pick the next free code for the flake8 rule"
    )


def test_api_rules_and_general_rules_dont_overlap() -> None:
    overlap: set[str] = set()
    for rule in ApiRule:
        if rule in flake8_plugin.GeneralRule:
            overlap.add(str(rule))
    assert not overlap, (
        f"{sorted(overlap)} are in both ApiRule and GeneralRule. Keep each in only the one that "
        "matches the kind of rule it is"
    )


def test_every_rule_has_a_summary() -> None:
    missing: list[str] = []
    for rule, config in RULES.items():
        if not config.summary.strip():
            missing.append(str(rule))
    assert not missing, (
        f"{missing} have no summary. Add a one-line summary to their RuleConfig in "
        "tools/api_guidelines/rules.py, since the report card, Slack post and PR comment show it"
    )


def test_every_structured_rule_has_a_trigger() -> None:
    missing: list[str] = []
    for rule, config in RULES.items():
        # only flake rules report through get_api_violations
        if config.source != RuleSource.FLAKE8:
            continue
        if rule not in NOT_YET_STRUCTURED and rule not in TRIGGERS:
            missing.append(str(rule))
    assert not missing, (
        f"{missing} have no entry in TRIGGERS. Add the smallest endpoint that fires each to "
        "TRIGGERS in this test, or to NOT_YET_STRUCTURED if it only reports as flake8 text"
    )


def test_every_trigger_reports_through_get_api_violations() -> None:
    unreported: list[str] = []
    for rule, trigger in TRIGGERS.items():
        reported: set[ApiRule] = set()
        tree = ast.parse(trigger)
        for violation in flake8_plugin.get_api_violations(tree, "src/sentry/api/endpoints/t.py"):
            reported.add(violation.rule)
        if rule not in reported:
            unreported.append(str(rule))
    assert not unreported, (
        f"{unreported} don't report through get_api_violations for their TRIGGERS endpoint. "
        "Record them as ApiInputViolation in tools/flake8_plugin.py"
    )

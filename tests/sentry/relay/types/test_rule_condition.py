from typing import Any

import pytest
from sentry_relay.processing import validate_rule_condition

from sentry.relay.types.rule_condition import (
    AllCondition,
    AndCondition,
    AnyCondition,
    CidrCondition,
    EqCondition,
    GlobCondition,
    GtCondition,
    GteCondition,
    LtCondition,
    LteCondition,
    NotCondition,
    OrCondition,
    ReleaseCondition,
    RuleCondition,
)
from sentry.utils import json


@pytest.mark.parametrize(
    ("condition", "expected"),
    [
        pytest.param(
            EqCondition("event.environment", "prod"),
            {"op": "eq", "name": "event.environment", "value": "prod"},
            id="eq",
        ),
        pytest.param(
            EqCondition("event.environment", ["prod", "staging"], ignore_case=True),
            {
                "op": "eq",
                "name": "event.environment",
                "value": ["prod", "staging"],
                "options": {"ignoreCase": True},
            },
            id="eq_ignore_case",
        ),
        pytest.param(
            EqCondition("event.user.id", None),
            {"op": "eq", "name": "event.user.id", "value": None},
            id="eq_null",
        ),
        pytest.param(
            GtCondition("event.duration", 10),
            {"op": "gt", "name": "event.duration", "value": 10},
            id="gt",
        ),
        pytest.param(
            GteCondition("event.duration", 10.5),
            {"op": "gte", "name": "event.duration", "value": 10.5},
            id="gte",
        ),
        pytest.param(
            LtCondition("event.duration", 10),
            {"op": "lt", "name": "event.duration", "value": 10},
            id="lt",
        ),
        pytest.param(
            LteCondition("event.duration", 10),
            {"op": "lte", "name": "event.duration", "value": 10},
            id="lte",
        ),
        pytest.param(
            GlobCondition("event.release", ["1.*", "2.0.?"]),
            {"op": "glob", "name": "event.release", "value": ["1.*", "2.0.?"]},
            id="glob",
        ),
        pytest.param(
            CidrCondition("envelope.client_ip", ["127.0.0.1", "10.0.0.0/8"]),
            {"op": "cidr", "name": "envelope.client_ip", "value": ["127.0.0.1", "10.0.0.0/8"]},
            id="cidr",
        ),
        pytest.param(
            ReleaseCondition("event.release", "gte", "myapp@1.2.0"),
            {
                "op": "release",
                "name": "event.release",
                "comparator": "gte",
                "value": "myapp@1.2.0",
            },
            id="release",
        ),
        pytest.param(
            AnyCondition("event.exception.values", GlobCondition("ty", ["TypeError"])),
            {
                "op": "any",
                "name": "event.exception.values",
                "inner": {"op": "glob", "name": "ty", "value": ["TypeError"]},
            },
            id="any",
        ),
        pytest.param(
            AllCondition("event.exception.values", GlobCondition("ty", ["TypeError"])),
            {
                "op": "all",
                "name": "event.exception.values",
                "inner": {"op": "glob", "name": "ty", "value": ["TypeError"]},
            },
            id="all",
        ),
        pytest.param(
            AndCondition(
                [
                    GlobCondition("event.release", ["1.*"]),
                    EqCondition("event.environment", "prod"),
                ]
            ),
            {
                "op": "and",
                "inner": [
                    {"op": "glob", "name": "event.release", "value": ["1.*"]},
                    {"op": "eq", "name": "event.environment", "value": "prod"},
                ],
            },
            id="and",
        ),
        pytest.param(
            OrCondition(
                [
                    GlobCondition("event.release", ["1.*"]),
                    EqCondition("event.environment", "prod"),
                ]
            ),
            {
                "op": "or",
                "inner": [
                    {"op": "glob", "name": "event.release", "value": ["1.*"]},
                    {"op": "eq", "name": "event.environment", "value": "prod"},
                ],
            },
            id="or",
        ),
        pytest.param(
            NotCondition(GlobCondition("event.release", ["1.*"])),
            {"op": "not", "inner": {"op": "glob", "name": "event.release", "value": ["1.*"]}},
            id="not",
        ),
        pytest.param(
            OrCondition(
                [
                    AnyCondition(
                        "event.exception.values",
                        AndCondition(
                            [GlobCondition("ty", ["TypeError"]), GlobCondition("value", ["*x*"])]
                        ),
                    ),
                    NotCondition(ReleaseCondition("event.release", "lt", "2.0.0")),
                ]
            ),
            {
                "op": "or",
                "inner": [
                    {
                        "op": "any",
                        "name": "event.exception.values",
                        "inner": {
                            "op": "and",
                            "inner": [
                                {"op": "glob", "name": "ty", "value": ["TypeError"]},
                                {"op": "glob", "name": "value", "value": ["*x*"]},
                            ],
                        },
                    },
                    {
                        "op": "not",
                        "inner": {
                            "op": "release",
                            "name": "event.release",
                            "comparator": "lt",
                            "value": "2.0.0",
                        },
                    },
                ],
            },
            id="nested",
        ),
    ],
)
def test_serialize(condition: RuleCondition, expected: dict[str, Any]) -> None:
    serialized = condition.serialize()

    assert serialized == expected
    # Raises if Relay's rule parser reads the condition as invalid or unsupported.
    validate_rule_condition(json.dumps(serialized))


def test_serialize_copies_the_patterns() -> None:
    patterns = ["1.*"]
    condition = GlobCondition("event.release", patterns)

    serialized = condition.serialize()
    serialized["value"].append("2.*")

    assert condition.patterns == ["1.*"]

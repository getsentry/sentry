from unittest.mock import patch

from sentry.dynamic_sampling.logging import should_log_rules_change
from sentry.dynamic_sampling.utils import get_rule_hash


@patch(
    "sentry.dynamic_sampling.logging.active_rules",
    new={
        1: {
            get_rule_hash(
                {
                    "active": True,
                    "condition": {"inner": [], "op": "and"},
                    "id": 1000,
                    "sampleRate": 0.1,
                    "type": "trace",
                },
            ): 0.1
        }
    },
)
def test_should_not_log_rules_if_unchanged():
    new_rules = [
        {
            "active": True,
            "condition": {"inner": [], "op": "and"},
            "id": 1000,
            "sampleRate": 0.1,
            "type": "trace",
        },
    ]

    assert not should_log_rules_change(1, new_rules)


@patch(
    "sentry.dynamic_sampling.logging.active_rules",
    new={
        1: {
            get_rule_hash(
                {
                    "active": True,
                    "condition": {"inner": [], "op": "and"},
                    "id": 1000,
                    "sampleRate": 0.1,
                    "type": "trace",
                },
            ): 0.1
        }
    },
)
def test_should_not_log_rules_if_unchanged_and_different_order():
    new_rules = [
        {
            "sampleRate": 0.1,
            "condition": {"op": "and", "inner": []},
            "id": 1000,
            "type": "trace",
            "active": True,
        },
    ]

    assert not should_log_rules_change(1, new_rules)


@patch(
    "sentry.dynamic_sampling.logging.active_rules",
    new={
        1: {
            get_rule_hash(
                {
                    "sampleRate": 1,
                    "type": "trace",
                    "condition": {
                        "op": "or",
                        "inner": [
                            {
                                "op": "glob",
                                "name": "trace.environment",
                                "value": ["*dev*", "*test*"],
                                "options": {"ignoreCase": True},
                            }
                        ],
                    },
                    "active": True,
                    "id": 1001,
                },
            ): 1.0
        }
    },
)
def test_should_log_rules_if_new_rule_added():
    new_rules = [
        {
            "sampleRate": 1,
            "type": "trace",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "glob",
                        "name": "trace.environment",
                        "value": ["*dev*", "*test*"],
                        "options": {"ignoreCase": True},
                    }
                ],
            },
            "active": True,
            "id": 1001,
        },
        {
            "sampleRate": 0.5,
            "type": "trace",
            "active": True,
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                    {"op": "eq", "name": "trace.environment", "value": "dev"},
                ],
            },
            "id": 1501,
            "timeRange": {"start": "2022-10-21 18:50:25+00:00", "end": "2022-10-21 20:03:03+00:00"},
        },
    ]

    assert should_log_rules_change(1, new_rules)


@patch(
    "sentry.dynamic_sampling.logging.active_rules",
    new={
        1: {
            get_rule_hash(
                {
                    "sampleRate": 0.7,
                    "type": "trace",
                    "condition": {
                        "op": "or",
                        "inner": [
                            {
                                "op": "glob",
                                "name": "trace.environment",
                                "value": ["*dev*", "*test*"],
                                "options": {"ignoreCase": True},
                            }
                        ],
                    },
                    "active": True,
                    "id": 1001,
                },
            ): 0.7
        }
    },
)
def test_should_log_rules_if_same_rule_has_different_sample_rate():
    new_rules = [
        {
            "sampleRate": 0.5,
            "type": "trace",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "glob",
                        "name": "trace.environment",
                        "value": ["*dev*", "*test*"],
                        "options": {"ignoreCase": True},
                    }
                ],
            },
            "active": True,
            "id": 1001,
        },
    ]

    assert should_log_rules_change(1, new_rules)


@patch(
    "sentry.dynamic_sampling.logging.active_rules",
    new={
        1: {
            get_rule_hash(
                {
                    "sampleRate": 0.7,
                    "type": "trace",
                    "condition": {
                        "op": "or",
                        "inner": [
                            {
                                "op": "glob",
                                "name": "trace.environment",
                                "value": ["*dev*", "*test*"],
                                "options": {"ignoreCase": True},
                            }
                        ],
                    },
                    "active": True,
                    "id": 1001,
                },
            ): 0.7,
            get_rule_hash(
                {
                    "sampleRate": 0.5,
                    "type": "trace",
                    "active": True,
                    "condition": {
                        "op": "and",
                        "inner": [
                            {"op": "eq", "name": "trace.release", "value": ["1.0"]},
                            {"op": "eq", "name": "trace.environment", "value": "dev"},
                        ],
                    },
                    "id": 1501,
                    "timeRange": {
                        "start": "2022-10-21 18:50:25+00:00",
                        "end": "2022-10-21 20:03:03+00:00",
                    },
                },
            ): 0.5,
        }
    },
)
def test_should_log_rules_if_rule_is_deleted():
    new_rules = [
        {
            "sampleRate": 0.7,
            "type": "trace",
            "condition": {
                "op": "or",
                "inner": [
                    {
                        "op": "glob",
                        "name": "trace.environment",
                        "value": ["*dev*", "*test*"],
                        "options": {"ignoreCase": True},
                    }
                ],
            },
            "active": True,
            "id": 1001,
        },
    ]

    assert should_log_rules_change(1, new_rules)

from datetime import datetime

from sentry.dynamic_sampling.rules.biases.custom_rule_bias import to_order_independent_string


def test_to_order_independent_string():
    """
    tests that the hash value returns the same value for equivalent objects

    """
    v1 = {
        "a": 1,
        "b": [3, 1, 2],
        "c": {"x": datetime(2020, 1, 1), "z": "abc", "y": ["a", "b", "c"]},
        "d": {},
        "e": [],
    }

    v2 = {
        "b": [1, 3, 2],
        "c": {"x": datetime(2020, 1, 1), "y": ["c", "a", "b"], "z": "abc"},
        "a": 1,
        "e": [],
        "d": {},
    }

    assert to_order_independent_string(v1) == to_order_independent_string(v2)


def test_to_order_independent_string_different_value():
    """
    tests that the hash value returns different values for different objects
    """
    v1 = {
        "a": {"b": ["x", "y", "z"]},
    }

    v2 = {
        "a": {"b": ["x", "y", "w"]},
    }
    assert to_order_independent_string(v1) != to_order_independent_string(v2)

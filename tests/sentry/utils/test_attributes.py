from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest

from sentry.utils import attributes as attributes_module
from sentry.utils.attributes import AttributeValueKind, get_attribute_value


@pytest.mark.parametrize(
    "attributes,key,kind,expected",
    [
        ({"http.method": "POST"}, "http.request.method", None, "POST"),
        ({"http.request.method": "GET", "http.method": "POST"}, "http.method", None, "GET"),
        ({"method": "POST"}, "http.request_method", "string", "POST"),
        ([{"name": "http.method", "value": "POST"}], "http.request.method", None, "POST"),
        (
            [{"name": "http.method", "value": "POST"}, {"name": "http.method", "value": "GET"}],
            "http.request.method",
            None,
            "POST",
        ),
        ({"custom": {"value": False, "type": "boolean"}}, "custom", "boolean", False),
        ({"custom": 42}, "custom", "int", 42),
        ({"custom": 0}, "custom", "int", 0),
        ({"custom": 1.0}, "custom", "int", None),
        ({"custom": 1.25}, "custom", "int", None),
        ({"custom": True}, "custom", "int", None),
        ({"custom": "42"}, "custom", "int", None),
        ({"custom": 42}, "custom", "number", 42),
        ({"custom": 1.25}, "custom", "number", 1.25),
        ({"custom": "1.25"}, "custom", "number", None),
        ({"custom": True}, "custom", "number", None),
        ({"custom": [True]}, "custom", "number[]", None),
        ({"custom": [1, 2.5]}, "custom", "number[]", [1, 2.5]),
        ({"custom": ["a"]}, "custom", "string[]", ["a"]),
        ({"custom": [False]}, "custom", "boolean[]", [False]),
        ({"custom": ["a", 1]}, "custom", None, None),
        ({"custom": []}, "custom", None, []),
        ({"custom": "value"}, "custom", None, "value"),
        ({"http.request.method": None, "http.method": "POST"}, "http.request.method", None, None),
        ({"http.request.method": 42, "http.method": "POST"}, "http.request.method", "string", None),
        ({}, "custom", None, None),
        (None, "custom", None, None),
    ],
)
def test_get_attribute_value(
    attributes: Any, key: str, kind: AttributeValueKind | None, expected: Any
) -> None:
    assert get_attribute_value(attributes, key, kind) == expected


def test_build_attribute_keys_preserves_precedence() -> None:
    first_keys = ("canonical.first", "canonical.second", "shared.alias")
    second_keys = ("canonical.second", "shared.alias", "second.alias")
    with patch.object(
        attributes_module,
        "ATTRIBUTE_METADATA",
        {
            "canonical.first": SimpleNamespace(keys=first_keys),
            "canonical.second": SimpleNamespace(keys=second_keys),
        },
    ):
        keys = attributes_module._build_attribute_keys()

    assert keys == {
        "canonical.first": first_keys,
        "canonical.second": second_keys,
        "shared.alias": first_keys,
        "second.alias": second_keys,
    }


def test_custom_attribute_names_do_not_grow_alias_lookup() -> None:
    original_keys = attributes_module._ATTRIBUTE_KEYS.copy()
    attributes = {f"custom.{index}": index for index in range(10_000)}

    assert [get_attribute_value(attributes, key) for key in attributes] == list(attributes.values())
    assert attributes_module._ATTRIBUTE_KEYS == original_keys

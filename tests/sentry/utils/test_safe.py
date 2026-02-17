from __future__ import annotations

from collections.abc import MutableMapping
from functools import partial
from typing import Any

import pytest

from sentry.utils.safe import (
    get_path,
    safe_execute,
    safe_urlencode,
    set_path,
    setdefault_path,
    trim,
)

a_very_long_string = "a" * 1024


# Trim tests
def test_trim_simple_string() -> None:
    assert trim(a_very_long_string) == a_very_long_string[:509] + "..."


def test_trim_list_of_strings() -> None:
    assert trim([a_very_long_string, a_very_long_string]) == [a_very_long_string[:507] + "..."]


def test_trim_nonascii() -> None:
    assert trim({"x": "\xc3\xbc"}) == {"x": "\xc3\xbc"}
    assert trim(["x", "\xc3\xbc"]) == ["x", "\xc3\xbc"]


def test_trim_idempotent() -> None:
    trm = partial(trim, max_depth=2)
    a = {"a": {"b": {"c": {"d": 1}}}}
    assert trm(a) == {"a": {"b": {"c": '{"d":1}'}}}
    assert trm(trm(trm(trm(a)))) == trm(a)


def test_trim_sorted() -> None:
    # Trim should always trim the keys in alpha order
    # regardless of the original order.
    alpha = {"a": "12345", "z": "12345"}
    reverse = {"z": "12345", "a": "12345"}
    trm = partial(trim, max_size=12)
    expected = {"a": "12345", "z": "1..."}

    assert trm(alpha) == expected
    assert trm(reverse) == expected


def test_trim_max_depth() -> None:
    trm = partial(trim, max_depth=2)
    a: dict[str, Any] = {"a": {"b": {"c": "d"}}}
    assert trm(a) == a

    a = {"a": {"b": {"c": "d"}}}
    assert trm(a) == {"a": {"b": {"c": "d"}}}

    a = {"a": {"b": {"c": {"d": "e"}}}}
    assert trm(a) == {"a": {"b": {"c": '{"d":"e"}'}}}

    a = {"a": {"b": {"c": []}}}
    assert trm(a) == {"a": {"b": {"c": "[]"}}}


# SafeExecute tests
def test_safe_execute_with_nameless_function() -> None:
    assert safe_execute(lambda a: a, 1) == 1
    assert safe_execute(lambda: eval("a")) is None


def test_safe_execute_with_simple_function() -> None:
    def simple(a):
        return a

    assert safe_execute(simple, 1) == 1


def test_safe_execute_with_simple_function_raising_exception() -> None:
    def simple(a):
        raise Exception()

    assert safe_execute(simple, 1) is None


def test_safe_execute_with_instance_method() -> None:
    class Foo:
        def simple(self, a):
            return a

    assert safe_execute(Foo().simple, 1) == 1


def test_safe_execute_with_instance_method_raising_exception() -> None:
    class Foo:
        def simple(self, a):
            raise Exception()

    assert safe_execute(Foo().simple, 1) is None


# GetPath tests
def test_get_path_none() -> None:
    assert get_path(None, "foo") is None
    assert get_path("foo", "foo") is None
    assert get_path(42, "foo") is None  # type: ignore[arg-type]
    assert get_path(ValueError(), "foo") is None  # type: ignore[arg-type]
    assert get_path(True, "foo") is None  # type: ignore[arg-type]


def test_get_path_dict() -> None:
    assert get_path({}, "a") is None
    assert get_path({"a": 2}, "a") == 2
    assert get_path({"a": 2}, "b") is None
    assert get_path({"a": {"b": []}}, "a", "b") == []
    assert get_path({"a": []}, "a", "b") is None


def test_get_path_default() -> None:
    assert get_path({"a": 2}, "b", default=1) == 1
    assert get_path({"a": 2}, "a", default=1) == 2
    assert get_path({"a": None}, "a", default=1) == 1


def test_get_path_list() -> None:
    arr = [1, 2]
    assert get_path(arr, 1) == 2
    assert get_path(arr, -1) == 2
    assert get_path(arr, 2) is None
    assert get_path(arr, "1") is None
    assert get_path([], 1) is None
    assert get_path({"items": [2]}, "items", 0) == 2


def test_get_path_filter_list() -> None:
    data = {"a": [False, 1, None]}
    assert get_path(data, "a", filter=True) == [False, 1]
    assert get_path(data, "a", filter=lambda x: x) == [1]


def test_get_path_filter_tuple() -> None:
    data = {"a": (False, 1, None)}
    assert get_path(data, "a", filter=True) == [False, 1]
    assert get_path(data, "a", filter=lambda x: x) == [1]


def test_get_path_filter_other() -> None:
    assert get_path({"a": 42}, "a", filter=True) == 42
    assert get_path({"a": True}, "a", filter=True) is True
    assert get_path({"a": {"b": 42}}, "a", filter=True) == {"b": 42}
    assert get_path({"a": 42}, "b", filter=True) is None

    # We use get_path to process Event's Http's query_strings to remove Nones
    # (which can occur as a result of normalization and datascrubbing).
    assert get_path([["foo", "bar"], None], filter=True) == [["foo", "bar"]]


def test_get_path_kwargs() -> None:
    with pytest.raises(TypeError):
        get_path({}, "foo", unknown=True)


# SetPath tests
def test_set_path_none() -> None:
    assert not set_path(None, "foo", value=42)
    assert not set_path("foo", "foo", value=42)
    assert not set_path(42, "foo", value=42)
    assert not set_path(ValueError(), "foo", value=42)
    assert not set_path(True, "foo", value=42)


def test_set_path_dict() -> None:
    data: MutableMapping[str, Any] = {}
    assert set_path(data, "a", value=42)
    assert data == {"a": 42}

    data = {"a": 2}
    assert set_path(data, "a", value=42)
    assert data == {"a": 42}

    data = {}
    assert set_path(data, "a", "b", value=42)
    assert data == {"a": {"b": 42}}


def test_set_path_default() -> None:
    data = {"a": {"b": 2}}
    assert not setdefault_path(data, "a", "b", value=42)
    assert data == {"a": {"b": 2}}

    data = {}
    assert setdefault_path(data, "a", "b", value=42)
    assert data == {"a": {"b": 42}}


def test_set_path_kwargs() -> None:
    with pytest.raises(TypeError):
        set_path({}, "foo")

    with pytest.raises(TypeError):
        set_path({}, "foo", value=1, unknown=True)


# SafeUrlencode tests
def test_safe_urlencode_dict() -> None:
    d = {"1": None, "3": "4"}
    assert safe_urlencode(d) == "1=&3=4"
    assert d == {"1": None, "3": "4"}
    d = {"1": "2", "3": "4"}
    assert safe_urlencode(d) == "1=2&3=4"


def test_safe_urlencode_pair_sequence() -> None:
    d = [["1", None], ["3", "4"]]
    assert safe_urlencode(d) == "1=&3=4"
    assert d == [["1", None], ["3", "4"]]
    d = [["1", "2"], ["3", "4"]]
    assert safe_urlencode(d) == "1=2&3=4"

from __future__ import annotations

import unittest
from functools import partial
from typing import Any, MutableMapping
from unittest.mock import Mock, patch

import pytest

from sentry.testutils.cases import TestCase
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.safe import (
    get_path,
    safe_execute,
    safe_urlencode,
    set_path,
    setdefault_path,
    trim,
)

a_very_long_string = "a" * 1024


class TrimTest(unittest.TestCase):
    def test_simple_string(self):
        assert trim(a_very_long_string) == a_very_long_string[:509] + "..."

    def test_list_of_strings(self):
        assert trim([a_very_long_string, a_very_long_string]) == [a_very_long_string[:507] + "..."]

    def test_nonascii(self):
        assert trim({"x": "\xc3\xbc"}) == {"x": "\xc3\xbc"}
        assert trim(["x", "\xc3\xbc"]) == ["x", "\xc3\xbc"]

    def test_idempotent(self):
        trm = partial(trim, max_depth=2)
        a = {"a": {"b": {"c": {"d": 1}}}}
        assert trm(a) == {"a": {"b": {"c": '{"d":1}'}}}
        assert trm(trm(trm(trm(a)))) == trm(a)

    def test_sorted_trim(self):
        # Trim should always trim the keys in alpha order
        # regardless of the original order.
        alpha = {"a": "12345", "z": "12345"}
        reverse = {"z": "12345", "a": "12345"}
        trm = partial(trim, max_size=12)
        expected = {"a": "12345", "z": "1..."}

        assert trm(alpha) == expected
        assert trm(reverse) == expected

    def test_max_depth(self):
        trm = partial(trim, max_depth=2)
        a: dict[str, Any] = {"a": {"b": {"c": "d"}}}
        assert trm(a) == a

        a = {"a": {"b": {"c": "d"}}}
        assert trm(a) == {"a": {"b": {"c": "d"}}}

        a = {"a": {"b": {"c": {"d": "e"}}}}
        assert trm(a) == {"a": {"b": {"c": '{"d":"e"}'}}}

        a = {"a": {"b": {"c": []}}}
        assert trm(a) == {"a": {"b": {"c": "[]"}}}


class SafeExecuteTest(TestCase):
    def test_with_nameless_function(self):
        assert safe_execute(lambda a: a, 1) == 1
        assert safe_execute(lambda: eval("a")) is None

    def test_with_simple_function(self):
        def simple(a):
            return a

        assert safe_execute(simple, 1) == 1

    def test_with_simple_function_raising_exception(self):
        def simple(a):
            raise Exception()

        assert safe_execute(simple, 1) is None

    def test_with_instance_method(self):
        class Foo:
            def simple(self, a):
                return a

        assert safe_execute(Foo().simple, 1) == 1

    def test_with_instance_method_raising_exception(self):
        class Foo:
            def simple(self, a):
                raise Exception()

        assert safe_execute(Foo().simple, 1) is None

    @patch("sentry.utils.safe.logging.getLogger")
    def test_with_expected_errors(self, mock_get_logger):
        mock_log = Mock()
        mock_get_logger.return_value = mock_log

        def simple(a):
            raise ValueError()

        assert safe_execute(simple, 1, expected_errors=(ValueError,)) is None
        assert mock_log.info.called
        assert mock_log.error.called is False


class GetPathTest(unittest.TestCase):
    def test_get_none(self):
        assert get_path(None, "foo") is None
        assert get_path("foo", "foo") is None
        assert get_path(42, "foo") is None  # type: ignore[arg-type]
        assert get_path(ValueError(), "foo") is None  # type: ignore[arg-type]
        assert get_path(True, "foo") is None  # type: ignore[arg-type]

    def test_get_path_dict(self):
        assert get_path({}, "a") is None
        assert get_path({"a": 2}, "a") == 2
        assert get_path({"a": 2}, "b") is None
        assert get_path({"a": {"b": []}}, "a", "b") == []
        assert get_path({"a": []}, "a", "b") is None
        assert get_path(CanonicalKeyDict({"a": 2}), "a") == 2

    def test_get_default(self):
        assert get_path({"a": 2}, "b", default=1) == 1
        assert get_path({"a": 2}, "a", default=1) == 2
        assert get_path({"a": None}, "a", default=1) == 1

    def test_get_path_list(self):
        arr = [1, 2]
        assert get_path(arr, 1) == 2
        assert get_path(arr, -1) == 2
        assert get_path(arr, 2) is None
        assert get_path(arr, "1") is None
        assert get_path([], 1) is None
        assert get_path({"items": [2]}, "items", 0) == 2

    def test_filter_list(self):
        data = {"a": [False, 1, None]}
        assert get_path(data, "a", filter=True) == [False, 1]
        assert get_path(data, "a", filter=lambda x: x) == [1]

    def test_filter_tuple(self):
        data = {"a": (False, 1, None)}
        assert get_path(data, "a", filter=True) == [False, 1]
        assert get_path(data, "a", filter=lambda x: x) == [1]

    def test_filter_other(self):
        assert get_path({"a": 42}, "a", filter=True) == 42
        assert get_path({"a": True}, "a", filter=True) is True
        assert get_path({"a": {"b": 42}}, "a", filter=True) == {"b": 42}
        assert get_path({"a": 42}, "b", filter=True) is None

        # We use get_path to process Event's Http's query_strings to remove Nones
        # (which can occur as a result of normalization and datascrubbing).
        assert get_path([["foo", "bar"], None], filter=True) == [["foo", "bar"]]

    def test_kwargs(self):
        with pytest.raises(TypeError):
            get_path({}, "foo", unknown=True)


class SetPathTest(unittest.TestCase):
    def test_set_none(self):
        assert not set_path(None, "foo", value=42)
        assert not set_path("foo", "foo", value=42)
        assert not set_path(42, "foo", value=42)
        assert not set_path(ValueError(), "foo", value=42)
        assert not set_path(True, "foo", value=42)

    def test_set_dict(self):
        data: MutableMapping[str, Any] = {}
        assert set_path(data, "a", value=42)
        assert data == {"a": 42}

        data = {"a": 2}
        assert set_path(data, "a", value=42)
        assert data == {"a": 42}

        data = {}
        assert set_path(data, "a", "b", value=42)
        assert data == {"a": {"b": 42}}

        data = CanonicalKeyDict({})
        assert set_path(data, "a", value=42)
        assert data == {"a": 42}

    def test_set_default(self):
        data = {"a": {"b": 2}}
        assert not setdefault_path(data, "a", "b", value=42)
        assert data == {"a": {"b": 2}}

        data = {}
        assert setdefault_path(data, "a", "b", value=42)
        assert data == {"a": {"b": 42}}

    def test_kwargs(self):
        with pytest.raises(TypeError):
            set_path({}, "foo")

        with pytest.raises(TypeError):
            set_path({}, "foo", value=1, unknown=True)


class SafeUrlencodeTest(unittest.TestCase):
    def test_dict(self):
        d = {"1": None, "3": "4"}
        assert safe_urlencode(d) == "1=&3=4"
        assert d == {"1": None, "3": "4"}
        d = {"1": "2", "3": "4"}
        assert safe_urlencode(d) == "1=2&3=4"

    def test_pair_sequence(self):
        d = [["1", None], ["3", "4"]]
        assert safe_urlencode(d) == "1=&3=4"
        assert d == [["1", None], ["3", "4"]]
        d = [["1", "2"], ["3", "4"]]
        assert safe_urlencode(d) == "1=2&3=4"

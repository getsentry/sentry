from __future__ import annotations

import unittest
from collections.abc import MutableMapping
from functools import partial
from typing import Any

import pytest

from sentry.testutils.cases import TestCase
from sentry.utils.safe import (
    get_json_bytes,
    get_path,
    safe_execute,
    safe_urlencode,
    set_path,
    setdefault_path,
    strict_trim,
    trim,
)

a_very_long_string = "a" * 1024


class TrimTest(unittest.TestCase):
    def test_simple_string(self) -> None:
        assert trim(a_very_long_string) == a_very_long_string[:509] + "..."

    def test_list_of_strings(self) -> None:
        assert trim([a_very_long_string, a_very_long_string]) == [a_very_long_string[:507] + "..."]

    def test_nonascii(self) -> None:
        assert trim({"x": "\xc3\xbc"}) == {"x": "\xc3\xbc"}
        assert trim(["x", "\xc3\xbc"]) == ["x", "\xc3\xbc"]

    def test_idempotent(self) -> None:
        trm = partial(trim, max_depth=2)
        a = {"a": {"b": {"c": {"d": 1}}}}
        assert trm(a) == {"a": {"b": {"c": '{"d":1}'}}}
        assert trm(trm(trm(trm(a)))) == trm(a)

    def test_sorted_trim(self) -> None:
        # Trim should always trim the keys in alpha order
        # regardless of the original order.
        alpha = {"a": "12345", "z": "12345"}
        reverse = {"z": "12345", "a": "12345"}
        trm = partial(trim, max_size=12)
        expected = {"a": "12345", "z": "1..."}

        assert trm(alpha) == expected
        assert trm(reverse) == expected

    def test_max_depth(self) -> None:
        trm = partial(trim, max_depth=2)
        a: dict[str, Any] = {"a": {"b": {"c": "d"}}}
        assert trm(a) == a

        a = {"a": {"b": {"c": "d"}}}
        assert trm(a) == {"a": {"b": {"c": "d"}}}

        a = {"a": {"b": {"c": {"d": "e"}}}}
        assert trm(a) == {"a": {"b": {"c": '{"d":"e"}'}}}

        a = {"a": {"b": {"c": []}}}
        assert trm(a) == {"a": {"b": {"c": "[]"}}}


class StrictTrimTest(unittest.TestCase):
    def test_leaves_values_which_already_fit_alone(self) -> None:
        limit = 100

        for orig in (
            {"dog": "maisey"},
            ["maisey", "charlie"],
            ("maisey", "charlie"),
            "maisey",
            13,
            None,
        ):
            # This value does indeed fit under the limit
            assert get_json_bytes(orig) < limit

            trimmed = strict_trim(orig, max_bytes=limit)
            assert trimmed == orig

    def test_trims_dicts_to_fit(self) -> None:
        limit = 200
        orig = {f"dog_{i}": "very good" for i in range(100)}

        trimmed = strict_trim(orig, max_bytes=limit)

        for i in range(10):
            assert f"dog_{i}" in trimmed
        for i in range(10, 100):
            assert f"dog_{i}" not in trimmed

        assert get_json_bytes(trimmed) <= limit
        assert 0 < len(trimmed) < len(orig)

    def test_trims_lists_to_fit(self) -> None:
        limit = 200
        orig = [f"dog_{i}" for i in range(100)]

        trimmed = strict_trim(orig, max_bytes=limit)

        assert get_json_bytes(orig) > limit
        assert get_json_bytes(trimmed) <= limit
        assert len(trimmed) < len(orig)

    def test_keeps_tuples_as_tuples(self) -> None:
        limit = 200
        orig = ("adopt", "don't shop") * 100

        trimmed = strict_trim(orig, max_bytes=limit)

        assert isinstance(orig, tuple)
        assert isinstance(trimmed, tuple)
        assert get_json_bytes(orig) > limit
        assert get_json_bytes(trimmed) <= limit

    def test_keeps_or_removes_but_does_not_trim_non_string_constants(self) -> None:
        # Numbers, booleans and `None` have no JSON representation shorter than their full one, so
        # they're either kept whole or dropped.
        limit = 75
        orig = {
            "id": 1121121231124151390813,
            "num_dogs": 2,
            "dogs_are_great": True,
            "bad_dogs": None,
        }
        orig_w_shorter_id = {**orig, "id": 1121}

        trimmed = strict_trim(orig, max_bytes=limit)
        trimmed_shorter_int = strict_trim(orig_w_shorter_id, max_bytes=limit)

        assert trimmed != orig
        assert trimmed_shorter_int == orig_w_shorter_id

        # The `id` entry was removed rather than trimmed, even though trimming it would have made it
        # fit under the limit
        assert "id" in trimmed_shorter_int
        assert "id" not in trimmed

        assert get_json_bytes(orig) > limit
        assert get_json_bytes(trimmed) <= limit

    def test_stringifies_values_nested_deeper_than_the_max_depth(self) -> None:
        limit = 100
        orig = {"dogs": {"are": {"great": {"co_best_dogs": ["maisey", "charlie"]}}}}

        trimmed = strict_trim(orig, max_bytes=limit, max_recursion_depth=2)

        assert trimmed == {"dogs": {"are": {"great": '{"co_best_dogs":["maisey","charlie"]}'}}}

    def test_string_trimming_requires_room_for_at_least_one_orig_character(self) -> None:
        orig_ascii = "charlie"

        assert get_json_bytes("c...") == 6

        # The smallest limit which doesn't lead to returning the empty string
        assert strict_trim(orig_ascii, max_bytes=6) == "c..."
        # Go one smaller and it drops to just the empty string
        assert strict_trim(orig_ascii, max_bytes=5) == ""

        orig_with_non_ascii = "𝜌ll over"

        assert get_json_bytes("𝜌...") == 17

        # The smallest limit which doesn't lead to returning the empty string
        assert strict_trim(orig_with_non_ascii, max_bytes=17) == "𝜌..."
        # Go one smaller and it drops to just the empty string
        assert strict_trim(orig_with_non_ascii, max_bytes=16) == ""

    def test_omits_list_entries_trimmed_to_nothing(self) -> None:
        orig = ["maisey", "charlie"]

        assert get_json_bytes(["maisey", "c..."]) == 17
        assert get_json_bytes(["maisey", ""]) == 13
        assert get_json_bytes(["maisey"]) == 10

        # The smallest limit which doesn't lead to omitting the second element
        assert strict_trim(orig, max_bytes=17) == ["maisey", "c..."]
        # Go one smaller and it drops to just `["maisey"]`, even though we can see from the sizes
        # above that we would have room for an empty second element
        assert strict_trim(orig, max_bytes=16) == ["maisey"]

    def test_omits_dict_entries_with_values_trimmed_to_nothing(self) -> None:
        orig = {"cat": "piper", "dog": "maisey"}

        assert get_json_bytes({"cat": "piper", "dog": "m..."}) == 28
        assert get_json_bytes({"cat": "piper", "dog": ""}) == 24
        assert get_json_bytes({"cat": "piper"}) == 15

        # The smallest limit which doesn't lead to omitting the second entry
        assert strict_trim(orig, max_bytes=28) == {"cat": "piper", "dog": "m..."}
        # Go one smaller and it drops to just `{"cat": "piper"}`, even though we can see from the
        # sizes above that we would have room for an empty value for "dog"
        assert strict_trim(orig, max_bytes=27) == {"cat": "piper"}

    def test_recursively_omits_values_trimmed_to_nothing(self) -> None:
        orig = [["maisey"], ["charlie"]]

        assert get_json_bytes([["maisey"], ["c..."]]) == 21
        assert get_json_bytes([["maisey"], [""]]) == 17
        assert get_json_bytes([["maisey"], []]) == 15
        assert get_json_bytes([["maisey"]]) == 12

        # The smallest limit which doesn't lead to omitting empty values
        assert strict_trim(orig, max_bytes=21) == [["maisey"], ["c..."]]
        # Go one smaller and it drops to just `[["maisey"]]`, even though we can see from the sizes
        # above that we would have room for both empty values
        assert strict_trim(orig, max_bytes=20) == [["maisey"]]

    def test_keeps_values_which_were_already_empty(self) -> None:
        # Values which start out empty carry as much information as they ever did, so as long as
        # they fit, they're kept
        limit = 100

        assert strict_trim(["maisey", ""], max_bytes=limit) == ["maisey", ""]
        assert strict_trim({"dog": "maisey", "cat": ""}, max_bytes=limit) == {
            "dog": "maisey",
            "cat": "",
        }
        assert strict_trim([["maisey"], []], max_bytes=limit) == [["maisey"], []]

    def test_accounts_for_dict_keys(self) -> None:
        limit = 40
        orig = {
            "dogs" * 50: "are great",
            "adopt" * 50: "don't shop",
            "best_dogs": ["maisey", "charlie"],
        }

        un_strict_trimmed = trim(orig, max_size=limit)
        strict_trimmed = strict_trim(orig, max_bytes=limit)

        # `trim` only accounts for a dict's values, not its keys, so it has no effect on `orig`,
        # even though it's more than 10x bigger than the limit
        assert un_strict_trimmed == orig
        assert get_json_bytes(un_strict_trimmed) > limit * 10

        # Strict trimming accounts for this, and only keeps the entry with the short key
        assert strict_trimmed == {"best_dogs": ["maisey", "charlie"]}
        assert get_json_bytes(strict_trimmed) <= limit

    def test_never_exceeds_the_limit(self) -> None:
        limit = 75
        orig = {
            "dogs": " ".join(["are great"] * 100),
            "adopt" * 50: " ".join(["don't shop"] * 50),
            "best_dogs": ["maisey", "charlie"],
        }

        un_strict_trimmed = trim(orig, max_size=limit)
        strict_trimmed = strict_trim(orig, max_bytes=limit)

        # The `adopt: don't shop` entry is what puts the trimmed result over the edge, but `trim`
        # includes it anyway, whereas when `strict_trim` does not
        assert set(un_strict_trimmed.keys()) == {"best_dogs", "adopt" * 50}
        assert set(strict_trimmed.keys()) == {"best_dogs"}

        assert get_json_bytes(un_strict_trimmed) > limit * 4
        assert get_json_bytes(strict_trimmed) <= limit

    def test_measures_jsonified_size_instead_of_string_length(self) -> None:
        limit = 50
        orig = {"trick": " ".join(["𝜌ll over"] * 100)}

        un_strict_trimmed = trim(orig, max_size=limit)
        strict_trimmed = strict_trim(orig, max_bytes=limit)

        # Every '𝜌' (rho) in `orig`'s `trick` value becomes `\\ud835\\udf0c` when JSONified, but
        # `trim` still only counts it as 1 character, making the final result way too big
        assert get_json_bytes(un_strict_trimmed) > limit * 2
        assert get_json_bytes(strict_trimmed) <= limit


class SafeExecuteTest(TestCase):
    def test_with_nameless_function(self) -> None:
        assert safe_execute(lambda a: a, 1) == 1
        assert safe_execute(lambda: eval("a")) is None

    def test_with_simple_function(self) -> None:
        def simple(a):
            return a

        assert safe_execute(simple, 1) == 1

    def test_with_simple_function_raising_exception(self) -> None:
        def simple(a):
            raise Exception()

        assert safe_execute(simple, 1) is None

    def test_with_instance_method(self) -> None:
        class Foo:
            def simple(self, a):
                return a

        assert safe_execute(Foo().simple, 1) == 1

    def test_with_instance_method_raising_exception(self) -> None:
        class Foo:
            def simple(self, a):
                raise Exception()

        assert safe_execute(Foo().simple, 1) is None


class GetPathTest(unittest.TestCase):
    def test_get_none(self) -> None:
        assert get_path(None, "foo") is None
        assert get_path("foo", "foo") is None
        assert get_path(42, "foo") is None  # type: ignore[arg-type]
        assert get_path(ValueError(), "foo") is None  # type: ignore[arg-type]
        assert get_path(True, "foo") is None  # type: ignore[arg-type]

    def test_get_path_dict(self) -> None:
        assert get_path({}, "a") is None
        assert get_path({"a": 2}, "a") == 2
        assert get_path({"a": 2}, "b") is None
        assert get_path({"a": {"b": []}}, "a", "b") == []
        assert get_path({"a": []}, "a", "b") is None

    def test_get_default(self) -> None:
        assert get_path({"a": 2}, "b", default=1) == 1
        assert get_path({"a": 2}, "a", default=1) == 2
        assert get_path({"a": None}, "a", default=1) == 1

    def test_get_path_list(self) -> None:
        arr = [1, 2]
        assert get_path(arr, 1) == 2
        assert get_path(arr, -1) == 2
        assert get_path(arr, 2) is None
        assert get_path(arr, "1") is None
        assert get_path([], 1) is None
        assert get_path({"items": [2]}, "items", 0) == 2

    def test_filter_list(self) -> None:
        data = {"a": [False, 1, None]}
        assert get_path(data, "a", filter=True) == [False, 1]
        assert get_path(data, "a", filter=lambda x: x) == [1]

    def test_filter_tuple(self) -> None:
        data = {"a": (False, 1, None)}
        assert get_path(data, "a", filter=True) == [False, 1]
        assert get_path(data, "a", filter=lambda x: x) == [1]

    def test_filter_other(self) -> None:
        assert get_path({"a": 42}, "a", filter=True) == 42
        assert get_path({"a": True}, "a", filter=True) is True
        assert get_path({"a": {"b": 42}}, "a", filter=True) == {"b": 42}
        assert get_path({"a": 42}, "b", filter=True) is None

        # We use get_path to process Event's Http's query_strings to remove Nones
        # (which can occur as a result of normalization and datascrubbing).
        assert get_path([["foo", "bar"], None], filter=True) == [["foo", "bar"]]

    def test_kwargs(self) -> None:
        with pytest.raises(TypeError):
            get_path({}, "foo", unknown=True)


class SetPathTest(unittest.TestCase):
    def test_set_none(self) -> None:
        assert not set_path(None, "foo", value=42)
        assert not set_path("foo", "foo", value=42)
        assert not set_path(42, "foo", value=42)
        assert not set_path(ValueError(), "foo", value=42)
        assert not set_path(True, "foo", value=42)

    def test_set_dict(self) -> None:
        data: MutableMapping[str, Any] = {}
        assert set_path(data, "a", value=42)
        assert data == {"a": 42}

        data = {"a": 2}
        assert set_path(data, "a", value=42)
        assert data == {"a": 42}

        data = {}
        assert set_path(data, "a", "b", value=42)
        assert data == {"a": {"b": 42}}

    def test_set_default(self) -> None:
        data = {"a": {"b": 2}}
        assert not setdefault_path(data, "a", "b", value=42)
        assert data == {"a": {"b": 2}}

        data = {}
        assert setdefault_path(data, "a", "b", value=42)
        assert data == {"a": {"b": 42}}

    def test_kwargs(self) -> None:
        with pytest.raises(TypeError):
            set_path({}, "foo")

        with pytest.raises(TypeError):
            set_path({}, "foo", value=1, unknown=True)


class SafeUrlencodeTest(unittest.TestCase):
    def test_dict(self) -> None:
        d = {"1": None, "3": "4"}
        assert safe_urlencode(d) == "1=&3=4"
        assert d == {"1": None, "3": "4"}
        d = {"1": "2", "3": "4"}
        assert safe_urlencode(d) == "1=2&3=4"

    def test_pair_sequence(self) -> None:
        d = [["1", None], ["3", "4"]]
        assert safe_urlencode(d) == "1=&3=4"
        assert d == [["1", None], ["3", "4"]]
        d = [["1", "2"], ["3", "4"]]
        assert safe_urlencode(d) == "1=2&3=4"

    def test_none(self) -> None:
        assert safe_urlencode(None) == ""

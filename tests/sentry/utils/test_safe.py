from __future__ import absolute_import

from collections import OrderedDict
from functools import partial
import pytest
import unittest

from sentry.utils.compat.mock import patch, Mock
from sentry.testutils import TestCase
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.safe import safe_execute, trim, trim_dict, get_path, set_path, setdefault_path

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
        alpha = OrderedDict([("a", "12345"), ("z", "12345")])
        reverse = OrderedDict([("z", "12345"), ("a", "12345")])
        trm = partial(trim, max_size=12)
        expected = {"a": "12345", "z": "1..."}

        assert trm(alpha) == expected
        assert trm(reverse) == expected

    def test_max_depth(self):
        trm = partial(trim, max_depth=2)
        a = {"a": {"b": {"c": "d"}}}
        assert trm(a) == a

        a = {"a": {"b": {"c": u"d"}}}
        assert trm(a) == {"a": {"b": {"c": "d"}}}

        a = {"a": {"b": {"c": {u"d": u"e"}}}}
        assert trm(a) == {"a": {"b": {"c": '{"d":"e"}'}}}

        a = {"a": {"b": {"c": []}}}
        assert trm(a) == {"a": {"b": {"c": "[]"}}}


class TrimDictTest(unittest.TestCase):
    def test_large_dict(self):
        value = dict((k, k) for k in range(500))
        trim_dict(value)
        assert len(value) == 50


class SafeExecuteTest(TestCase):
    def test_with_nameless_function(self):
        assert safe_execute(lambda a: a, 1) == 1
        assert safe_execute(lambda: a) is None  # NOQA

    def test_with_simple_function(self):
        def simple(a):
            return a

        assert safe_execute(simple, 1) == 1

        def simple(a):
            raise Exception()

        assert safe_execute(simple, 1) is None

    def test_with_instance_method(self):
        class Foo(object):
            def simple(self, a):
                return a

        assert safe_execute(Foo().simple, 1) == 1

        class Foo(object):
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
        assert get_path(42, "foo") is None
        assert get_path(ValueError(), "foo") is None
        assert get_path(True, "foo") is None

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
        data = {}
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

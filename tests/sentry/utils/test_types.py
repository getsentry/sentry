# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.types import InvalidTypeError, Any, Bool, Int, Float, String, Dict, Sequence
from unittest import TestCase


class OptionsTypesTest(TestCase):
    def test_any(self):
        assert Any("foo") == "foo"
        assert Any(1) == 1
        assert Any(None) is None
        assert Any() is None
        assert Any.test(None)
        assert Any.test("foo")
        assert Any.test("bar")

    def test_bool(self):
        assert Bool(True) is True
        assert Bool(1) is True
        assert Bool("y") is True
        assert Bool("YES") is True
        assert Bool("t") is True
        assert Bool("true") is True
        assert Bool("1") is True
        assert Bool("on") is True
        assert Bool(False) is False
        assert Bool(0) is False
        assert Bool("n") is False
        assert Bool("NO") is False
        assert Bool("f") is False
        assert Bool("false") is False
        assert Bool("0") is False
        assert Bool("off") is False
        assert Bool() is False
        assert Bool.test(None) is False
        assert Bool(True) is True
        assert Bool.test("foo") is False
        with self.assertRaises(InvalidTypeError):
            Bool("foo")

    def test_int(self):
        assert Int(1) == 1
        assert Int("1") == 1
        assert Int("-1") == -1
        assert Int() == 0
        with self.assertRaises(InvalidTypeError):
            Int("foo")
        with self.assertRaises(InvalidTypeError):
            Int("1.1")

    def test_float(self):
        assert Float(1.0) == 1.0
        assert Float("1") == 1.0
        assert Float("-1.1") == -1.1
        assert Float(1) == 1.0
        assert Float() == 0.0
        with self.assertRaises(InvalidTypeError):
            Float("foo")

    def test_string(self):
        assert String("foo") == "foo"
        assert String(u"foo") == u"foo"
        assert String() == u""
        with self.assertRaises(InvalidTypeError):
            String(0)

    def test_dict(self):
        assert Dict({}) == {}
        assert Dict({"foo": "bar"}) == {"foo": "bar"}
        assert Dict("{foo: bar}") == {"foo": "bar"}

        assert Dict() == {}
        with self.assertRaises(InvalidTypeError):
            assert Dict("[]")
        with self.assertRaises(InvalidTypeError):
            assert Dict([])
        with self.assertRaises(InvalidTypeError):
            assert Dict("")
        with self.assertRaises(InvalidTypeError):
            # malformed yaml/json (a plain scalar, "b: ar", cannot contain ": ")
            assert Dict("{foo: b: ar}")

    def test_sequence(self):
        assert Sequence(()) == ()
        assert Sequence([]) == []
        assert Sequence((1, 2, 3)) == (1, 2, 3)
        assert Sequence([1, 2, 3]) == [1, 2, 3]
        assert Sequence("[1,2,3]") == (1, 2, 3)
        with self.assertRaises(InvalidTypeError):
            Sequence("{}")
        with self.assertRaises(InvalidTypeError):
            Sequence({})
        with self.assertRaises(InvalidTypeError):
            Sequence("")
        with self.assertRaises(InvalidTypeError):
            # malformed yaml/json
            Sequence("[1,")

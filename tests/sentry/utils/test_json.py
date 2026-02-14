import datetime
import uuid
from enum import Enum
from unittest import TestCase

from django.utils.translation import gettext_lazy as _

from sentry.utils import json


class JSONSerializationTest(TestCase):
    def test_uuid(self) -> None:
        res = uuid.uuid4()
        self.assertEqual(json.dumps(res), '"%s"' % res.hex)

    def test_datetime(self) -> None:
        res = datetime.datetime(day=1, month=1, year=2011, hour=1, minute=1, second=1)
        self.assertEqual(json.dumps(res), '"2011-01-01T01:01:01.000000Z"')

    def test_set(self) -> None:
        res = {"foo"}
        self.assertEqual(json.dumps(res), '["foo"]')

    def test_frozenset(self) -> None:
        res = frozenset(["foo"])
        self.assertEqual(json.dumps(res), '["foo"]')

    def test_escape(self) -> None:
        res = "<script>alert('&');</script>"
        assert json.dumps(res) == "\"<script>alert('&');</script>\""
        assert (
            json.dumps(res, escape=True).encode("utf-8")
            == b'"\\u003cscript\\u003ealert(\\u0027\\u0026\\u0027);\\u003c/script\\u003e"'
        )
        assert (
            json.dumps_htmlsafe(res).encode("utf-8")
            == b'"\\u003cscript\\u003ealert(\\u0027\\u0026\\u0027);\\u003c/script\\u003e"'
        )

    def test_inf(self) -> None:
        res = float("inf")
        self.assertEqual(json.dumps(res), "null")

    def test_enum(self) -> None:
        EnumFoo = Enum("EnumFoo", "a b c")
        res = EnumFoo.a
        self.assertEqual(json.dumps(res), "1")

    def test_translation(self) -> None:
        self.assertEqual(json.dumps(_("word")), '"word"')

    def test_sort_keys(self) -> None:
        res = {"z": 1, "a": 2, "m": 3}
        self.assertEqual(json.dumps(res, sort_keys=True), '{"a":2,"m":3,"z":1}')


class JSONHelpersTest(TestCase):
    def test_prune_empty_keys_simple(self) -> None:
        assert json.prune_empty_keys(
            {
                "dogs_are_great": True,
                "good_dogs": "all",
                "bad_dogs": None,
            }
        ) == {
            "dogs_are_great": True,
            "good_dogs": "all",
        }

    def test_prune_empty_keys_keeps_falsy_values(self) -> None:
        assert json.prune_empty_keys(
            {
                "empty_string": "",
                "empty_list": [],
                "empty_dict": {},
                "empty_set": set(),
                "empty_tuple": tuple(),
                "false": False,
                "zero": 0,
                "zero_point_zero": 0.0,
                "none": None,
            }
        ) == {
            "empty_string": "",
            "empty_list": [],
            "empty_dict": {},
            "empty_set": set(),
            "empty_tuple": tuple(),
            "false": False,
            "zero": 0,
            "zero_point_zero": 0.0,
        }

    def test_prune_empty_keys_none_input(self) -> None:
        assert json.prune_empty_keys(None) is None

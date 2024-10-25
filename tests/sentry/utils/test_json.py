import datetime
import uuid
from enum import Enum
from unittest import TestCase

from django.utils.translation import gettext_lazy as _

from sentry.utils import json


class JSONSerializationTest(TestCase):
    def test_uuid(self):
        res = uuid.uuid4()
        self.assertEqual(json.dumps(res), '"%s"' % res.hex)

    def test_datetime(self):
        res = datetime.datetime(day=1, month=1, year=2011, hour=1, minute=1, second=1)
        self.assertEqual(json.dumps(res), '"2011-01-01T01:01:01.000000Z"')

    def test_set(self):
        res = {"foo"}
        self.assertEqual(json.dumps(res), '["foo"]')

    def test_frozenset(self):
        res = frozenset(["foo"])
        self.assertEqual(json.dumps(res), '["foo"]')

    def test_escape(self):
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

    def test_inf(self):
        res = float("inf")
        self.assertEqual(json.dumps(res), "null")

    def test_enum(self):
        EnumFoo = Enum("EnumFoo", "a b c")
        res = EnumFoo.a
        self.assertEqual(json.dumps(res), "1")

    def test_translation(self):
        self.assertEqual(json.dumps(_("word")), '"word"')


class JSONHelpersTest(TestCase):
    def test_prune_empty_keys_simple(self):
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

    def test_prune_empty_keys_keeps_falsy_values(self):
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

    def test_prune_empty_keys_none_input(self):
        assert json.prune_empty_keys(None) is None

    def test_apply_key_filter_with_key_list(self):
        dog_data = {
            "dogs_are_great": True,
            "good_dogs": "all",
            "bad_dogs": None,
        }
        keep_keys = ["dogs_are_great", "good_dogs"]

        assert json.apply_key_filter(
            dog_data,
            keep_keys=keep_keys,
        ) == {
            "dogs_are_great": True,
            "good_dogs": "all",
        }

    def test_apply_key_filter_with_callback(self):
        dog_data = {
            "dogs_are_great": True,
            "good_dogs": "all",
            "bad_dogs": None,
        }
        keep_keys = ["dogs_are_great", "good_dogs"]

        assert json.apply_key_filter(
            dog_data,
            key_filter=lambda key: key in keep_keys,
        ) == {
            "dogs_are_great": True,
            "good_dogs": "all",
        }

    def test_apply_key_filter_no_filter(self):
        dog_data = {
            "dogs_are_great": True,
            "good_dogs": "all",
            "bad_dogs": None,
        }

        assert json.apply_key_filter(
            dog_data,
        ) == {
            "dogs_are_great": True,
            "good_dogs": "all",
            "bad_dogs": None,
        }

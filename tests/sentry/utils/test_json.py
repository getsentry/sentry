import datetime
import uuid
from enum import Enum

from django.utils.translation import gettext_lazy as _

from sentry.utils import json


def test_uuid() -> None:
    res = uuid.uuid4()
    assert json.dumps(res) == '"%s"' % res.hex


def test_datetime() -> None:
    res = datetime.datetime(day=1, month=1, year=2011, hour=1, minute=1, second=1)
    assert json.dumps(res) == '"2011-01-01T01:01:01.000000Z"'


def test_set() -> None:
    res = {"foo"}
    assert json.dumps(res) == '["foo"]'


def test_frozenset() -> None:
    res = frozenset(["foo"])
    assert json.dumps(res) == '["foo"]'


def test_escape() -> None:
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


def test_inf() -> None:
    res = float("inf")
    assert json.dumps(res) == "null"


def test_enum() -> None:
    EnumFoo = Enum("EnumFoo", "a b c")
    res = EnumFoo.a
    assert json.dumps(res) == "1"


def test_translation() -> None:
    assert json.dumps(_("word")) == '"word"'


def test_sort_keys() -> None:
    res = {"z": 1, "a": 2, "m": 3}
    assert json.dumps(res, sort_keys=True) == '{"a":2,"m":3,"z":1}'


def test_prune_empty_keys_simple() -> None:
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


def test_prune_empty_keys_keeps_falsy_values() -> None:
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


def test_prune_empty_keys_none_input() -> None:
    assert json.prune_empty_keys(None) is None

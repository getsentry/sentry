import datetime
import uuid
from enum import Enum
from unittest import TestCase
from unittest.mock import patch

from django.utils.translation import gettext_lazy as _

from sentry.utils import json


class JSONTest(TestCase):
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
        enum = Enum("foo", "a b c")
        res = enum.a
        self.assertEqual(json.dumps(res), "1")

    def test_translation(self):
        self.assertEqual(json.dumps(_("word")), '"word"')

    @patch("sentry_sdk.start_span")
    def test_loads_with_sdk_trace(self, start_span_mock):
        json.loads('{"test": "message"}')
        start_span_mock.assert_called_once()

    @patch("sentry_sdk.start_span")
    def test_loads_without_sdk_trace(self, start_span_mock):
        json.loads('{"test": "message"}', skip_trace=True)
        start_span_mock.assert_not_called()

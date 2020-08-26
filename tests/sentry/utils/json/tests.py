# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import uuid

from django.utils.translation import ugettext_lazy as _
from enum import Enum

from unittest import TestCase
from sentry.utils import json


class JSONTest(TestCase):
    def test_uuid(self):
        res = uuid.uuid4()
        self.assertEquals(json.dumps(res), '"%s"' % res.hex)

    def test_datetime(self):
        res = datetime.datetime(day=1, month=1, year=2011, hour=1, minute=1, second=1)
        self.assertEquals(json.dumps(res), '"2011-01-01T01:01:01.000000Z"')

    def test_set(self):
        res = set(["foo"])
        self.assertEquals(json.dumps(res), '["foo"]')

    def test_frozenset(self):
        res = frozenset(["foo"])
        self.assertEquals(json.dumps(res), '["foo"]')

    def test_escape(self):
        res = "<script>alert('&');</script>"
        assert json.dumps(res) == "\"<script>alert('&');</script>\""
        assert (
            json.dumps(res, escape=True).encode("utf-8")
            == b'"\\u003cscript\\u003ealert(\\u0027\u0026\\u0027);\\u003c/script\\u003e"'
        )
        assert (
            json.dumps_htmlsafe(res).encode("utf-8")
            == b'"\\u003cscript\\u003ealert(\\u0027\u0026\\u0027);\\u003c/script\\u003e"'
        )

    def test_inf(self):
        res = float("inf")
        self.assertEquals(json.dumps(res), "null")

    def test_enum(self):
        enum = Enum("foo", "a b c")
        res = enum.a
        self.assertEquals(json.dumps(res), "1")

    def test_translation(self):
        self.assertEquals(json.dumps(_("word")), u'"word"')

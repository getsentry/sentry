# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pickle

from sentry.interfaces import Interface

from tests.base import TestCase


class InterfaceTests(TestCase):

    def test_init_sets_attrs(self):
        obj = Interface(foo=1)
        self.assertEqual(obj.attrs, ['foo'])

    def test_setstate_sets_attrs(self):
        data = pickle.dumps(Interface(foo=1))
        obj = pickle.loads(data)
        self.assertEqual(obj.attrs, ['foo'])

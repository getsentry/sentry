# -*- coding: utf-8 -*-

from __future__ import absolute_import

from tests.base import TestCase


class SentryPluginTest(TestCase):
    def test_registration(self):
        from sentry.plugins import Plugin
        self.assertEquals(len(Plugin.plugins), 3)

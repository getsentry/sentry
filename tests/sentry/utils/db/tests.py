# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.db import get_db_engine
from sentry.testutils import TestCase


class GetDbEngineTest(TestCase):
    def test_with_dotted_path(self):
        with self.settings(DATABASES={'default': {'ENGINE': 'blah.sqlite3'}}):
            self.assertEquals(get_db_engine(), 'sqlite3')

    def test_no_path(self):
        with self.settings(DATABASES={'default': {'ENGINE': 'mysql'}}):
            self.assertEquals(get_db_engine(), 'mysql')

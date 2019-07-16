# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.db import get_db_engine
from sentry.testutils import TestCase


class GetDbEngineTest(TestCase):
    def test_with_dotted_path(self):
        with self.settings(DATABASES={'default': {'ENGINE': 'blah.postgres'}}):
            self.assertEquals(get_db_engine(), 'postgres')

    def test_no_path(self):
        with self.settings(DATABASES={'default': {'ENGINE': 'postgres'}}):
            self.assertEquals(get_db_engine(), 'postgres')

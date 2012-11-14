# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry import app
from sentry.testutils import TestCase


class AppTest(TestCase):
    def test_buffer_is_a_buffer(self):
        from sentry.buffer.base import Buffer
        self.assertEquals(type(app.buffer), Buffer)

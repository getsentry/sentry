# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.hashlib import md5, sha1
from sentry.testutils import TestCase


class HashlibTest(TestCase):
    def test_simple(self):
        md5('x').hexdigest() == '9dd4e461268c8034f5c8564e155c67a6'
        sha1('x').hexdigest() == '11f6ad8ec52a2984abaafd7c3b516503785c2072'

    def test_unicode(self):
        md5(u'ü').hexdigest() == 'c03410a5204b21cd8229ff754688d743'
        sha1(u'ü').hexdigest() == '94a759fd37735430753c7b6b80684306d80ea16e'

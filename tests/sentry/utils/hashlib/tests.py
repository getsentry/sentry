# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest
import six

from sentry.utils.hashlib import md5_text, sha1_text, hash_values
from sentry.testutils import TestCase


HASHLIB_VALUES_TESTS = (
    ('seed', None, '44689bafd59f4b1f0b0a152062b6dede'),
    ('seed', True, '453224968c982a58ff5782853607f47f'),
    ('seed', False, 'a65e1fcf12a02cee799b0591b060ce0b'),
    ('seed', 42, 'c2fa989f1320b70f5c597a7358ce3a5a'),
    ('seed', six.binary_type('test'), '008b2c3fd625055c3132bc72ea4a6f5e'),
    ('seed', six.text_type('test'), '0ea4106eb2e5bcd3269be5cd7f8f3912'),
    ('seed', (4, 2), '026ebc18a8e27193bc0ed80a18d0a7c1'),
    ('seed', {'test': 42}, '6cd8da40ed2dd728b74cdcffa30b72d4'),
)


@pytest.mark.parametrize('seed,value,hash', HASHLIB_VALUES_TESTS)
def test_hash_values(seed, value, hash):
    assert hash_values(seed, [value]) == hash


class HashlibTest(TestCase):
    def test_simple(self):
        md5_text('x').hexdigest() == '9dd4e461268c8034f5c8564e155c67a6'
        sha1_text('x').hexdigest() == '11f6ad8ec52a2984abaafd7c3b516503785c2072'

    def test_unicode(self):
        md5_text(u'ü').hexdigest() == 'c03410a5204b21cd8229ff754688d743'
        sha1_text(u'ü').hexdigest() == '94a759fd37735430753c7b6b80684306d80ea16e'

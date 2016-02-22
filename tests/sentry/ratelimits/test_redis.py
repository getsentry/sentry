# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.ratelimits.redis import RedisRateLimiter
from sentry.testutils import TestCase


class RedisRateLimiterTest(TestCase):
    def setUp(self):
        self.backend = RedisRateLimiter()

    def test_integration(self):
        assert not self.backend.is_limited(self.project, 'foo', 1)
        assert self.backend.is_limited(self.project, 'foo', 1)

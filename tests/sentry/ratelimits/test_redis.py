# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.conf import settings
from sentry.ratelimits.redis import RedisRateLimiter
from sentry.testutils import TestCase


class RedisRateLimiterTest(TestCase):
    def setUp(self):
        options = settings.SENTRY_REDIS_OPTIONS
        self.backend = RedisRateLimiter(hosts=options['hosts'])

    def test_integration(self):
        assert not self.backend.is_limited(self.project, 'foo', 1)
        assert self.backend.is_limited(self.project, 'foo', 1)

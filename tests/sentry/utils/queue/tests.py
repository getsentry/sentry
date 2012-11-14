from __future__ import absolute_import

from sentry.utils.queue import can_queue
from sentry.testutils import TestCase


def test_func():
    pass


class CanQueueTest(TestCase):
    def test_disabled(self):
        with self.Settings(SENTRY_USE_QUEUE=False):
            self.assertFalse(can_queue(test_func))

    def test_empty_whitelist(self):
        with self.Settings(SENTRY_USE_QUEUE=()):
            self.assertFalse(can_queue(test_func))

    def test_enabled(self):
        with self.Settings(SENTRY_USE_QUEUE=True):
            self.assertTrue(can_queue(test_func))

    def test_in_whitelist(self):
        with self.Settings(SENTRY_USE_QUEUE=('%s.test_func' % (__name__,))):
            self.assertTrue(can_queue(test_func))

    def test_not_in_whitelist(self):
        with self.Settings(SENTRY_USE_QUEUE=('%s.foo' % (__name__,))):
            self.assertFalse(can_queue(test_func))

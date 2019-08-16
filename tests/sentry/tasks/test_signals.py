from __future__ import absolute_import

from sentry.tasks.signals import signal
from sentry.testutils import TestCase


class SignalTest(TestCase):
    def test_task_persistent_name(self):
        assert signal.name == "sentry.tasks.signal"

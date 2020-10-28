from __future__ import absolute_import

from sentry.utils.compat import mock

from unittest import TestCase
from sentry.utils.retries import TimedRetryPolicy, RetryException


class TimedRetryPolicyTestCase(TestCase):
    def test_policy_success(self):
        bomb = Exception("Boom!")
        callable = mock.MagicMock(side_effect=[bomb, mock.sentinel.OK])

        retry = TimedRetryPolicy(0.3, delay=lambda i: 0.1)
        retry.clock = mock.Mock()
        retry.clock.sleep = mock.MagicMock()
        retry.clock.time = mock.MagicMock(side_effect=[0, 0.15])

        assert retry(callable) is mock.sentinel.OK
        assert callable.call_count == 2

    def test_policy_failure(self):
        bomb = Exception("Boom!")
        callable = mock.MagicMock(side_effect=bomb)

        retry = TimedRetryPolicy(0.3, delay=lambda i: 0.1)
        retry.clock = mock.Mock()
        retry.clock.sleep = mock.MagicMock()
        retry.clock.time = mock.MagicMock(side_effect=[0, 0.15, 0.25])

        try:
            retry(callable)
        except RetryException as exception:
            assert exception.exception is bomb
        else:
            self.fail(u"Expected {!r}!".format(RetryException))

        assert callable.call_count == 2

    def test_decorator(self):
        bomb = Exception("Boom!")
        callable = mock.MagicMock(side_effect=[bomb, mock.sentinel.OK])

        @TimedRetryPolicy.wrap(0.3, delay=lambda i: 0.1)
        def retrying_func():
            return callable()

        retrying_func.clock = mock.Mock()
        retrying_func.clock.sleep = mock.MagicMock()
        retrying_func.clock.time = mock.MagicMock(side_effect=[0, 0.15, 0.25])

        assert retrying_func() is mock.sentinel.OK
        assert callable.call_count == 2

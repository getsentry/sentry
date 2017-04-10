from __future__ import absolute_import

import mock

from sentry.testutils import TestCase
from sentry.utils.retries import TimedRetryPolicy, RetryException


class TimedRetryPolicyTestCase(TestCase):
    def test_policy_success(self):
        bomb = Exception('Boom!')
        callable = mock.MagicMock(side_effect=[bomb, mock.sentinel.OK])

        retry = TimedRetryPolicy(30, delay=lambda i: 10)
        retry.clock = mock.Mock()
        retry.clock.sleep = mock.MagicMock()
        retry.clock.time = mock.MagicMock(side_effect=[0, 15])

        assert retry(callable) is mock.sentinel.OK
        assert callable.call_count == 2

    def test_policy_failure(self):
        bomb = Exception('Boom!')
        callable = mock.MagicMock(side_effect=bomb)

        retry = TimedRetryPolicy(30, delay=lambda i: 10)
        retry.clock = mock.Mock()
        retry.clock.sleep = mock.MagicMock()
        retry.clock.time = mock.MagicMock(side_effect=[0, 15, 25])

        try:
            retry(callable)
        except RetryException as exception:
            assert exception.exception is bomb
        else:
            self.fail('Expected {!r}!'.format(RetryException))

        assert callable.call_count == 2

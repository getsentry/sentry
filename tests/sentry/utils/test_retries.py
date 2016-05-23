import itertools
import mock
import pytest

from sentry.utils.retries import TimedRetryPolicy, RetryException
from sentry.testutils import TestCase


class TimedRetryPolicyTestCase(TestCase):
    def test_policy_success(self):
        bomb = Exception('Boom!')
        callable = mock.MagicMock(side_effect=[bomb, mock.sentinel.OK])

        retry = TimedRetryPolicy(30, delay=lambda i: 10)
        with mock.patch('time.sleep'), mock.patch('time.time', side_effect=[0, 15]):
            assert retry(callable) is mock.sentinel.OK
            assert callable.call_count == 2

    def test_policy_failure(self):
        bomb = Exception('Boom!')
        callable = mock.MagicMock(side_effect=bomb)

        retry = TimedRetryPolicy(30, delay=lambda i: 10)
        with mock.patch('time.sleep'), mock.patch('time.time', side_effect=[0, 15, 25]):
            try:
                retry(callable)
            except RetryException as exception:
                assert exception.exception is bomb
            else:
                self.fail('Expected {!r}!'.format(RetryException))

            assert callable.call_count == 2

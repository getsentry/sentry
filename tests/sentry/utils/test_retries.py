from unittest import TestCase, mock

import pytest

from sentry.utils.retries import ConditionalRetryPolicy, RetryException, TimedRetryPolicy


class ConditionalRetryPolicyTestCase(TestCase):
    bomb = Exception("Boom!")

    def test_policy_success(self) -> None:
        callable = mock.MagicMock(side_effect=[self.bomb, mock.sentinel.OK])

        always_retry = lambda i, e: True
        assert ConditionalRetryPolicy(always_retry)(callable) is mock.sentinel.OK
        assert callable.call_count == 2

    def test_poilcy_failure(self) -> None:
        callable = mock.MagicMock(side_effect=self.bomb)

        never_retry = lambda i, e: False
        with pytest.raises(Exception) as e:
            ConditionalRetryPolicy(never_retry)(callable)

        assert callable.call_count == 1
        assert e.value is self.bomb

    def test_policy_counter(self) -> None:
        callable = mock.MagicMock(side_effect=self.bomb)

        retry_once = lambda i, e: i < 2
        with pytest.raises(Exception) as e:
            ConditionalRetryPolicy(retry_once)(callable)

        assert callable.call_count == 2
        assert e.value is self.bomb

    def test_policy_exception_filtering(self) -> None:
        errors = [Exception(), Exception(), Exception()]
        callable = mock.MagicMock(side_effect=errors)

        sometimes_retry = lambda i, e: e is not errors[-1]
        with pytest.raises(Exception) as e:
            ConditionalRetryPolicy(sometimes_retry)(callable)

        assert e.value is errors[-1]
        assert callable.call_count == 3


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

        with pytest.raises(RetryException) as excinfo:
            retry(callable)
        assert excinfo.value.exception is bomb

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

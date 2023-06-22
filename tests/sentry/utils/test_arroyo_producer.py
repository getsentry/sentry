from unittest.mock import Mock

from sentry.utils.arroyo_producer import SingletonProducer


def test_track_futures():
    def dummy_producer():
        raise AssertionError("no producer")

    producer = SingletonProducer(dummy_producer, max_futures=2)

    first_future_mock = Mock()
    first_future_mock.result = Mock()

    second_future_mock = Mock()
    second_future_mock.result = Mock()

    producer._track_futures(first_future_mock)
    first_future_mock.result.assert_not_called()
    producer._track_futures(second_future_mock)
    first_future_mock.result.assert_called_once_with()
    second_future_mock.assert_not_called()
